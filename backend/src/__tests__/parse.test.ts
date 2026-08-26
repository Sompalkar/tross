import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseProfileHtml, parsePublicPhoto } from "../linkedin/parse.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.resolve(here, "../../fixtures/profile.html"), "utf8");

const profile = parseProfileHtml(html, "ada-lovelace");

describe("parseProfileHtml", () => {
  it("reads the basics", () => {
    assert.equal(profile.fullName, "Ada Lovelace");
    assert.equal(profile.firstName, "Ada");
    assert.equal(profile.lastName, "Lovelace");
    assert.equal(profile.headline, "Principal Engineer at Analytical Engines");
    assert.equal(profile.profileUrl, "https://www.linkedin.com/in/ada-lovelace");
    assert.ok(profile.summary?.startsWith("I design and ship"));
  });

  it("separates the location from the counts sharing its element", () => {
    assert.equal(profile.location.full, "London, England, United Kingdom");
    assert.equal(profile.location.country, "United Kingdom");
    assert.equal(profile.followersCount, 4208);
    assert.equal(profile.connectionsCount, 500);
  });

  it("takes the background image but not the grey placeholder avatar", () => {
    assert.ok(profile.backgroundPicture?.original?.includes("displaybackgroundimage"));
    // The top-card avatar is a static.licdn.com ghost, which is not a photo.
    assert.equal(profile.profilePicture, null);
  });

  it("maps experience, including current roles and durations", () => {
    assert.equal(profile.experience.length, 2);
    const [current, previous] = profile.experience;

    assert.equal(current?.title, "Principal Engineer");
    assert.equal(current?.companyName, "Analytical Engines");
    assert.equal(current?.employmentType, "Full-time");
    assert.equal(current?.location, "London, United Kingdom");
    assert.equal(
      current?.companyLinkedInUrl,
      "https://www.linkedin.com/company/analytical-engines",
    );
    assert.ok(current?.companyLogo?.original?.includes("company-logo_100_100"));
    assert.equal(current?.companyLogo?.sizes[0]?.width, 100);
    assert.equal(current?.dateRange?.isCurrent, true);
    assert.equal(current?.dateRange?.text, "Mar 2021 - Present · 5 yrs 6 mos");
    assert.equal(current?.dateRange?.durationMonths, 66);
    assert.ok(current?.description?.startsWith("Lead the platform team"));

    assert.equal(previous?.dateRange?.isCurrent, false);
    assert.equal(previous?.dateRange?.end?.text, "Feb 2021");
    assert.equal(previous?.employmentType, null);
  });

  it("splits the degree from the field of study", () => {
    const [education] = profile.education;
    assert.equal(education?.schoolName, "University of London");
    assert.equal(education?.degreeName, "Master of Science");
    assert.equal(education?.fieldOfStudy, "Computer Science");
    assert.equal(education?.grade, "Distinction");
    assert.equal(education?.dateRange?.text, "Sep 2013 - Jun 2015");
    assert.equal(
      education?.schoolLinkedInUrl,
      "https://www.linkedin.com/school/university-of-london/",
    );
  });

  it("reads skills and the accomplishment sub-sections", () => {
    assert.deepEqual(profile.skills.map((s) => s.name), [
      "TypeScript",
      "Node.js",
      "Distributed Systems",
      "PostgreSQL",
    ]);
    assert.equal(profile.certifications.length, 1);
    assert.equal(profile.certifications[0]?.name, "AWS Certified Solutions Architect");
    assert.equal(profile.certifications[0]?.authority, "Amazon Web Services (AWS)");
    assert.deepEqual(profile.languages, [
      { name: "English", proficiency: "Native or bilingual proficiency" },
      { name: "French", proficiency: "Professional working proficiency" },
    ]);
    assert.equal(profile.projects[0]?.title, "OpenTrace");
  });

  it("survives a page with no profile content", () => {
    const empty = parseProfileHtml("<html><body></body></html>", "someone");
    assert.equal(empty.fullName, null);
    assert.equal(empty.headline, null);
    assert.deepEqual(empty.experience, []);
    assert.deepEqual(empty.skills, []);
    assert.equal(empty.profilePicture, null);
    assert.equal(empty.publicIdentifier, "someone");
  });
});

describe("parsePublicPhoto", () => {
  const photoUrl =
    "https://media.licdn.com/dms/image/v2/EXAMPLE/profile-displayphoto-shrink_200_200/0/1?e=1&amp;v=beta";

  it("reads the avatar from the public page's Open Graph tag", () => {
    const image = parsePublicPhoto(`<meta property="og:image" content="${photoUrl}">`);
    assert.ok(image);
    assert.equal(image.sizes[0]?.width, 200);
    assert.ok(!image.original?.includes("&amp;"), "HTML entities should be decoded");
  });

  it("ignores anything that is not a member photo", () => {
    assert.equal(parsePublicPhoto(null), null);
    assert.equal(parsePublicPhoto("<html></html>"), null);
    assert.equal(
      parsePublicPhoto('<meta property="og:image" content="https://static.licdn.com/logo.png">'),
      null,
    );
  });
});
