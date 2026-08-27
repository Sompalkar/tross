import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type {
  Certification,
  Course,
  DateParts,
  DateRange,
  Education,
  Honor,
  ImageSet,
  Language,
  LinkedInProfile,
  Organization,
  Position,
  Project,
  Publication,
  Skill,
  TestScore,
  VolunteerExperience,
} from "../types/profile.js";
import { profileUrlFor } from "./url.js";

/**
 * Turns a LinkedIn mwlite profile page into our schema.
 *
 * The page is server-rendered HTML, so every section is already text. The
 * risk with HTML is brittleness, so this parser leans on the most stable
 * things on the page — semantic container classes such as
 * `.experience-container` and `.skills-list`, and LinkedIn's own
 * `data-tracking-control-name` attributes — rather than on element order or
 * on styling classes, which change with every design tweak.
 */

type El = ReturnType<CheerioAPI>;

/* ────────────────────────── small helpers ────────────────────────── */

const clean = (value: string | undefined | null): string | null => {
  if (!value) return null;
  // mwlite is full of soft hyphens, non-breaking spaces and stray newlines.
  const text = value.replace(/ /g, " ").replace(/­/g, "").replace(/\s+/g, " ").trim();
  return text.length ? text : null;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** True for text that looks like a date or a date range. */
const looksLikeDate = (text: string): boolean =>
  /\b(19|20)\d{2}\b/.test(text) || /\bPresent\b/i.test(text);

/** "Mar 2021" or "2013" -> structured parts. */
function parseDateText(text: string): DateParts | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const monthMatch = /([A-Za-z]{3,})\s+((?:19|20)\d{2})/.exec(trimmed);
  if (monthMatch) {
    const month = MONTHS[monthMatch[1]!.slice(0, 3).toLowerCase()] ?? null;
    const year = Number(monthMatch[2]);
    return {
      month,
      year,
      text: month ? `${monthMatch[1]!.slice(0, 3)} ${year}` : String(year),
    };
  }

  const yearMatch = /\b((?:19|20)\d{2})\b/.exec(trimmed);
  if (yearMatch) return { month: null, year: Number(yearMatch[1]), text: yearMatch[1]! };

  return null;
}

/**
 * mwlite writes ranges as "Mar 2021 - Present · 3 yrs 5 mos". LinkedIn has
 * already worked out the duration, so we keep its wording rather than
 * recomputing it and risking a different answer.
 */
function parseDateRange(raw: string | null): DateRange | null {
  const text = clean(raw);
  if (!text || !looksLikeDate(text)) return null;

  // LinkedIn shows "Mar 2021 - Present · 3 yrs 5 mos", but the "·" is drawn by
  // CSS, so the text we get is "Mar 2021 - Present 3 yrs 5 mos". Peel the
  // duration off the end by its shape rather than by a separator.
  const durationMatch = /((?:\d+\s*yrs?)?\s*(?:\d+\s*mos?)?)\s*$/.exec(text);
  const durationPart = durationMatch?.[1]?.trim() || null;
  const rangePart = (
    durationPart ? text.slice(0, text.length - durationPart.length) : text
  )
    .replace(/[·|]\s*$/, "")
    .trim();
  const halves = rangePart.split(/\s*[-–—]\s*/);

  const start = parseDateText(halves[0] ?? "");
  const endRaw = halves[1] ?? "";
  const isCurrent = /present/i.test(endRaw);
  const end = isCurrent ? null : parseDateText(endRaw);

  if (!start && !end) return null;

  const durationMonths = durationToMonths(durationPart);

  return {
    start,
    end,
    isCurrent,
    // Re-insert the separator LinkedIn only draws visually.
    text: durationPart ? `${rangePart} · ${durationPart}` : rangePart,
    durationMonths,
  };
}

/** "3 yrs 5 mos" -> 41 */
function durationToMonths(text: string | null): number | null {
  if (!text) return null;
  const years = Number(/(\d+)\s*yr/i.exec(text)?.[1] ?? 0);
  const months = Number(/(\d+)\s*mo/i.exec(text)?.[1] ?? 0);
  const total = years * 12 + months;
  return total > 0 ? total : null;
}

/**
 * mwlite lazy-loads images: the real URL sits in `data-delayed-url`, and
 * `src`/`data-ghost-url` hold a grey placeholder served from static.licdn.com.
 * Only media.licdn.com URLs are real member images.
 */
function parseImage($: CheerioAPI, element: El | undefined): ImageSet | null {
  if (!element || element.length === 0) return null;

  const url =
    element.attr("data-delayed-url") ?? element.attr("src") ?? element.attr("data-src");
  if (!url || !url.includes("media.licdn.com")) return null;

  const decoded = url.replace(/&amp;/g, "&");
  // LinkedIn encodes the rendered size in the path, e.g. company-logo_100_100.
  const size = /_(\d{2,4})_(\d{2,4})/.exec(decoded);

  return {
    original: decoded,
    sizes: [
      {
        url: decoded,
        width: size ? Number(size[1]) : null,
        height: size ? Number(size[2]) : null,
      },
    ],
  };
}

/**
 * Reads one list entry into its raw parts. Every section on the page uses the
 * same lockup, so each parser below only has to decide what the parts mean.
 */
interface Entry {
  heading: string | null;
  lines: string[];
  description: string | null;
  image: ImageSet | null;
  link: string | null;
}

function readEntry($: CheerioAPI, li: El): Entry {
  const heading =
    clean(li.find(".list-item-heading").first().text()) ??
    clean(li.find(".body-medium-bold").first().text()) ??
    clean(li.find("h3").first().text());

  const description = clean(li.find(".description").first().text());

  const lines: string[] = [];
  li.find(".body-small, .text-xs").each((_, node) => {
    const text = clean($(node).text());
    // Skip the heading, the description and anything already collected.
    if (!text || text === heading || text === description) return;
    if (lines.some((line) => line === text || line.includes(text))) return;
    lines.push(text);
  });

  return {
    heading,
    lines,
    description,
    image: parseImage($, li.find("img").first()),
    link: li.find("a[href]").first().attr("href")?.split("?")[0] ?? null,
  };
}

/** Picks the first line that reads like a date, and returns the rest. */
function splitOutDate(lines: string[]): { dateLine: string | null; rest: string[] } {
  const index = lines.findIndex(looksLikeDate);
  if (index === -1) return { dateLine: null, rest: lines };
  return {
    dateLine: lines[index]!,
    rest: lines.filter((_, i) => i !== index),
  };
}

/** Finds a top-level section by its container class. */
const section = ($: CheerioAPI, name: string): El => $(`.${name}-container`).first();

/** All list entries inside a section. */
const entriesOf = ($: CheerioAPI, container: El): El[] => {
  const found: El[] = [];
  container.find("li.profile-entity-lockup, li.entity-lockup").each((_, node) => {
    const li = $(node);
    // Skip wrappers that only contain other entries (multi-role companies).
    if (li.find("li.profile-entity-lockup, li.entity-lockup").length > 0) return;
    found.push(li);
  });
  return found;
};

/* ────────────────────────── sections ────────────────────────── */

function parseExperience($: CheerioAPI): Position[] {
  const container = section($, "experience");
  if (container.length === 0) return [];

  return entriesOf($, container).map((li): Position => {
    const entry = readEntry($, li);
    const { dateLine, rest } = splitOutDate(entry.lines);

    // The remaining lines are company (with optional employment type) then
    // location. LinkedIn writes "Accenture · Full-time".
    const companyLine = rest[0] ?? null;
    const [companyName, employmentType] = (companyLine ?? "")
      .split("·")
      .map((part) => clean(part));

    const companyHref = li
      .find('a[data-tracking-control-name="profile-position"], a[href*="/company/"]')
      .first()
      .attr("href");

    return {
      title: entry.heading,
      companyName: companyName ?? null,
      companyUrn: null,
      companyLinkedInUrl: companyHref ? companyHref.split("?")[0]! : null,
      companyLogo: entry.image,
      employmentType: employmentType ?? null,
      location: rest[1] ?? null,
      description: entry.description,
      dateRange: parseDateRange(dateLine),
    };
  });
}

function parseEducation($: CheerioAPI): Education[] {
  const container = section($, "education");
  if (container.length === 0) return [];

  return entriesOf($, container).map((li): Education => {
    const entry = readEntry($, li);
    const { dateLine, rest } = splitOutDate(entry.lines);

    // "Bachelor of Science · Computer Science", or occasionally comma-separated.
    const [degreeName, fieldOfStudy] = (rest[0] ?? "")
      .split(/\s*[·,]\s*/)
      .map((part) => clean(part));

    const schoolHref = li.find('a[href*="/school/"]').first().attr("href");

    return {
      schoolName: entry.heading,
      schoolLinkedInUrl: schoolHref ? schoolHref.split("?")[0]! : null,
      schoolLogo: entry.image,
      degreeName: degreeName ?? null,
      fieldOfStudy: fieldOfStudy ?? null,
      grade: rest.find((line) => /grade/i.test(line))?.replace(/^grade:?\s*/i, "") ?? null,
      activities: null,
      description: entry.description,
      dateRange: parseDateRange(dateLine),
    };
  });
}

function parseSkills($: CheerioAPI): Skill[] {
  const seen = new Set<string>();
  const skills: Skill[] = [];

  $(".skills-list .skill-item").each((_, node) => {
    const name = clean($(node).find("span[dir]").first().text()) ?? clean($(node).text());
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    skills.push({ name, endorsementCount: null });
  });

  return skills;
}

function parseVolunteer($: CheerioAPI): VolunteerExperience[] {
  const container = $(".volunteer-experience-container, .volunteering-container").first();
  if (container.length === 0) return [];

  return entriesOf($, container).map((li): VolunteerExperience => {
    const entry = readEntry($, li);
    const { dateLine, rest } = splitOutDate(entry.lines);
    return {
      role: entry.heading,
      companyName: rest[0] ?? null,
      cause: rest[1] ?? null,
      description: entry.description,
      dateRange: parseDateRange(dateLine),
    };
  });
}

/**
 * Certifications, languages, projects, honours, courses, patents and test
 * scores all live inside one "Accomplishments" section, each in a sub-block
 * marked with its own class (`certifications-section`, `languages-section`).
 */
function accomplishment($: CheerioAPI, kind: string): Entry[] {
  const block = $(`.accomplishment-type.${kind}-section, .${kind}-section`).first();
  if (block.length === 0) return [];

  const entries: Entry[] = [];
  block.find("li.sub-list-item, li").each((_, node) => {
    const li = $(node);
    if (li.find("li").length > 0) return;
    const entry = readEntry($, li);
    if (entry.heading) entries.push(entry);
  });
  return entries;
}

function parseCertifications($: CheerioAPI): Certification[] {
  return accomplishment($, "certifications").map((entry): Certification => {
    const { dateLine, rest } = splitOutDate([
      ...(entry.description ? [entry.description] : []),
      ...entry.lines,
    ]);
    return {
      name: entry.heading,
      authority: rest[0] ?? null,
      licenseNumber: null,
      url: entry.link,
      dateRange: parseDateRange(dateLine),
    };
  });
}

function parseLanguages($: CheerioAPI): Language[] {
  return accomplishment($, "languages").map((entry): Language => ({
    name: entry.heading,
    proficiency: entry.description ?? entry.lines[0] ?? null,
  }));
}

function parseProjects($: CheerioAPI): Project[] {
  return accomplishment($, "projects").map((entry): Project => {
    const { dateLine } = splitOutDate(entry.lines);
    return {
      title: entry.heading,
      description: entry.description,
      url: entry.link,
      members: [],
      dateRange: parseDateRange(dateLine),
    };
  });
}

function parseHonors($: CheerioAPI): Honor[] {
  return accomplishment($, "honors").map((entry): Honor => ({
    title: entry.heading,
    issuer: entry.lines[0] ?? null,
    description: entry.description,
    date: parseDateText(entry.lines.find(looksLikeDate) ?? ""),
  }));
}

function parseCourses($: CheerioAPI): Course[] {
  return accomplishment($, "courses").map((entry): Course => ({
    name: entry.heading,
    number: entry.lines[0] ?? null,
  }));
}

function parsePublications($: CheerioAPI): Publication[] {
  return accomplishment($, "publications").map((entry): Publication => ({
    name: entry.heading,
    publisher: entry.lines[0] ?? null,
    description: entry.description,
    url: entry.link,
    date: parseDateText(entry.lines.find(looksLikeDate) ?? ""),
    authors: [],
  }));
}

function parseOrganizations($: CheerioAPI): Organization[] {
  return accomplishment($, "organizations").map((entry): Organization => {
    const { dateLine, rest } = splitOutDate(entry.lines);
    return {
      name: entry.heading,
      position: rest[0] ?? null,
      description: entry.description,
      dateRange: parseDateRange(dateLine),
    };
  });
}

function parseTestScores($: CheerioAPI): TestScore[] {
  return accomplishment($, "test-scores").map((entry): TestScore => ({
    name: entry.heading,
    score: entry.lines[0] ?? null,
    description: entry.description,
    date: parseDateText(entry.lines.find(looksLikeDate) ?? ""),
  }));
}


/**
 * Under the name mwlite prints several identically styled lines: the current
 * company, "Joined 2013", a contact-info notice, and one line that holds the
 * location and the follower count together, e.g.
 * "Seattle, Washington, United States 40,604,066 followers".
 *
 * Rather than trusting their order, discard the ones we can recognise and
 * split the survivor into its two halves.
 */
const FOLLOWERS = /([\d,]+)\+?\s+followers?/i;
const CONNECTIONS = /([\d,]+)\+?\s+connections?/i;

function readHeaderLines($: CheerioAPI, basic: El): {
  location: string | null;
  followers: number | null;
  connections: number | null;
} {
  let location: string | null = null;
  let followers: number | null = null;
  let connections: number | null = null;

  const candidates: string[] = [];

  basic.find(".body-small.text-color-text-low-emphasis").each((_, node) => {
    const el = $(node);
    if (el.find(".member-current-company").length) return;

    const text = clean(el.text());
    if (!text) return;
    if (/^joined\b/i.test(text)) return;
    if (/^contact information/i.test(text)) return;

    const followerMatch = FOLLOWERS.exec(text);
    if (followerMatch) followers = toCount(followerMatch[1]);

    const connectionMatch = CONNECTIONS.exec(text);
    if (connectionMatch) connections = toCount(connectionMatch[1]);

    // Whatever is left once the counts are removed is the location. Removing
    // a value can strand the separator that joined it, so trim those too.
    const remainder = clean(
      text.replace(FOLLOWERS, "").replace(CONNECTIONS, "").replace(/(^[\s·|]+)|([\s·|]+$)/g, ""),
    );
    if (remainder) candidates.push(remainder);
  });

  // A location almost always carries a comma ("Seattle, Washington, ...").
  location = candidates.find((text) => text.includes(",")) ?? candidates[0] ?? null;

  return { location, followers, connections };
}

const toCount = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
};

/* ────────────────────────── entry point ────────────────────────── */

/**
 * Reads the profile photo out of the public page's Open Graph tags.
 * LinkedIn publishes several rendered sizes at predictable URLs, but only the
 * one it advertises is guaranteed to exist, so that is what we return.
 */
export function parsePublicPhoto(html: string | null): ImageSet | null {
  if (!html) return null;

  const $ = cheerio.load(html);
  const url =
    $('meta[property="og:image"]').attr("content") ??
    $('meta[name="twitter:image"]').attr("content");

  if (!url || !url.includes("media.licdn.com")) return null;
  if (!/profile-displayphoto/.test(url)) return null;

  const decoded = url.replace(/&amp;/g, "&");
  const size = /_(\d{2,4})_(\d{2,4})/.exec(decoded);

  return {
    original: decoded,
    sizes: [
      {
        url: decoded,
        width: size ? Number(size[1]) : null,
        height: size ? Number(size[2]) : null,
      },
    ],
  };
}

export function parseProfileHtml(
  html: string,
  publicIdentifier: string,
  publicPageHtml: string | null = null,
): LinkedInProfile {
  const $ = cheerio.load(html);

  // mwlite separates values with an empty <span class="dot-separator"> and
  // draws the dot in CSS, so "Bachelor of Science · Computer Science" reaches
  // us as one run-on string. Turning the marker into real text first means
  // every parser below can just split on "·".
  $(".dot-separator").replaceWith(" · ");

  const fullName = clean($("h1").first().text());
  const [firstName, ...lastNameParts] = (fullName ?? "").split(" ");

  const basic = $(".basic-profile-section").first();

  // Under the name come headline, current company and location, in that
  // order. Reading them by class beats reading them by position.
  const headline = clean(basic.find(".body-small.text-color-text span[dir]").first().text());
  const { location: locationText, followers, connections } = readHeaderLines($, basic);

  const about = clean($(".summary-container .description").first().text());

  // Only the identity block, so a badge belonging to someone else on the page
  // cannot be mistaken for this profile's.
  const badgeText = basic.text();

  return {
    publicIdentifier,
    profileId: null,
    profileUrl: profileUrlFor(publicIdentifier),

    firstName: clean(firstName) ?? null,
    lastName: clean(lastNameParts.join(" ")) ?? null,
    fullName,
    headline,
    summary: about,

    location: {
      full: locationText,
      // mwlite prints one line, "Seattle, Washington, United States".
      country: locationText?.split(",").pop()?.trim() ?? null,
      countryCode: null,
      postalCode: null,
    },

    industry: null,
    // Not on the mwlite page at all, so `null` (unknown) rather than a guess.
    isStudent: null,
    isPremium: null,
    isInfluencer: null,

    // These two are real badges in the top card. Scoping the check to that
    // card matters: searching the whole page would match the "Add open to
    // work" button on your own profile, or another person's badge in the
    // "people also viewed" list, and report it as this profile's.
    isOpenToWork: /open to work/i.test(badgeText),
    isHiring: /#?hiring/i.test(badgeText),

    profilePicture:
      parsePublicPhoto(publicPageHtml) ??
      parseImage($, $("#profile-picture-container img").first()),
    backgroundPicture: parseImage($, $(".cover-image-container img").first()),

    connectionsCount: connections,
    followersCount: followers,

    experience: parseExperience($),
    education: parseEducation($),
    skills: parseSkills($),
    certifications: parseCertifications($),
    languages: parseLanguages($),
    projects: parseProjects($),
    publications: parsePublications($),
    volunteerExperience: parseVolunteer($),
    honors: parseHonors($),
    courses: parseCourses($),
    organizations: parseOrganizations($),
    patents: [],
    testScores: parseTestScores($),

    contactInfo: null,
  };
}
