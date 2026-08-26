import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeProfile, parseImage } from "../linkedin/normalize.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(path.resolve(here, "../../fixtures/profile-view.json"), "utf8"),
) as Record<string, unknown>;

const profile = normalizeProfile({
  publicIdentifier: "ada-lovelace",
  profileView: fixture,
});

describe("normalizeProfile", () => {
  it("reads the basics", () => {
    assert.equal(profile.fullName, "Ada Lovelace");
    assert.equal(profile.publicIdentifier, "ada-lovelace");
    assert.equal(profile.profileUrl, "https://www.linkedin.com/in/ada-lovelace");
    assert.equal(profile.location.full, "London, England, United Kingdom");
    assert.equal(profile.location.countryCode, "GB");
    assert.equal(profile.industry, "Software Development");
    assert.ok(profile.summary?.startsWith("I design and ship"));
  });

  it("builds image URLs from rootUrl + artifact segment", () => {
    const picture = profile.profilePicture;
    assert.ok(picture);
    assert.equal(picture.sizes.length, 4);
    // Sorted smallest -> largest, and `original` is the largest.
    assert.equal(picture.sizes[0]?.width, 100);
    assert.equal(picture.original, picture.sizes[3]?.url);
    assert.ok(picture.original?.includes("profile-displayphoto-shrink_800_800"));
  });

  it("returns null for a missing image", () => {
    assert.equal(parseImage(undefined), null);
    assert.equal(parseImage({}), null);
  });

  it("maps experience, including current roles and durations", () => {
    assert.equal(profile.experience.length, 2);
    const [current, previous] = profile.experience;

    assert.equal(current?.title, "Principal Engineer");
    assert.equal(current?.companyName, "Analytical Engines");
    assert.equal(
      current?.companyLinkedInUrl,
      "https://www.linkedin.com/company/analytical-engines",
    );
    assert.equal(current?.dateRange?.isCurrent, true);
    assert.ok(current?.dateRange?.text?.includes("Mar 2021 - Present"));
    assert.ok(current?.companyLogo?.original);

    assert.equal(previous?.dateRange?.isCurrent, false);
    assert.equal(previous?.dateRange?.text, "Jun 2017 - Feb 2021 · 3 yrs 9 mos");
  });

  it("maps education", () => {
    const [education] = profile.education;
    assert.equal(education?.schoolName, "University of London");
    assert.equal(education?.degreeName, "MSc");
    assert.equal(education?.fieldOfStudy, "Computer Science");
    // Year-only ranges must not claim a month-precise duration.
    assert.equal(education?.dateRange?.text, "2013 - 2015");
  });

  it("maps the remaining sections", () => {
    assert.deepEqual(
      profile.skills.map((skill) => skill.name).slice(0, 3),
      ["TypeScript", "Node.js", "Distributed Systems"],
    );
    assert.equal(profile.certifications[0]?.authority, "Amazon Web Services (AWS)");
    assert.deepEqual(profile.languages[0], {
      name: "English",
      proficiency: "Native or bilingual",
    });
    assert.equal(profile.projects[0]?.title, "OpenTrace");
    assert.deepEqual(profile.publications[0]?.authors, ["Ada Lovelace"]);
    assert.equal(profile.volunteerExperience[0]?.cause, "Science and technology");
    assert.equal(profile.honors[0]?.date?.text, "Dec 2022");
    assert.equal(profile.courses[0]?.number, "CS6161");
    assert.equal(profile.organizations[0]?.name, "ACM");
    assert.deepEqual(profile.patents, []);
  });

  it("survives an almost empty profile", () => {
    const sparse = normalizeProfile({
      publicIdentifier: "someone",
      profileView: { profile: { firstName: "Sam" } },
    });
    assert.equal(sparse.fullName, "Sam");
    assert.equal(sparse.headline, null);
    assert.deepEqual(sparse.experience, []);
    assert.deepEqual(sparse.skills, []);
    assert.equal(sparse.profilePicture, null);
  });
});
