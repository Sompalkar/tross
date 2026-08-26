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
  Patent,
  Position,
  Project,
  Publication,
  Skill,
  TestScore,
  VolunteerExperience,
} from "../types/profile.js";
import { profileUrlFor } from "./url.js";

/* ────────────────────────── small helpers ────────────────────────── */

type Raw = Record<string, any>;

const str = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const bool = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

/** LinkedIn returns `{ elements: [...] }` almost everywhere, but not always. */
const elementsOf = (view: unknown): Raw[] => {
  if (Array.isArray(view)) return view as Raw[];
  const elements = (view as Raw | undefined)?.["elements"];
  return Array.isArray(elements) ? (elements as Raw[]) : [];
};

/** The last segment of `urn:li:fs_miniCompany:1441` -> `1441`. */
const idFromUrn = (urn: unknown): string | null => {
  const value = str(urn);
  if (!value) return null;
  const parts = value.split(":");
  return parts[parts.length - 1] ?? null;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/* ────────────────────────── dates ────────────────────────── */

function parseDate(raw: unknown): DateParts | null {
  const date = raw as Raw | undefined;
  const year = num(date?.["year"]);
  const month = num(date?.["month"]);
  if (year === null && month === null) return null;

  const monthLabel = month !== null ? MONTHS[month - 1] ?? null : null;
  const text =
    year !== null && monthLabel
      ? `${monthLabel} ${year}`
      : year !== null
        ? String(year)
        : monthLabel;

  return { month, year, text };
}

function monthsBetween(start: DateParts, end: DateParts | null): number | null {
  if (start.year === null) return null;
  const endYear = end?.year ?? new Date().getFullYear();
  const endMonth = end?.month ?? (end?.year ? 12 : new Date().getMonth() + 1);
  const startMonth = start.month ?? 1;
  const total = (endYear - start.year) * 12 + (endMonth - startMonth) + 1;
  return total > 0 ? total : null;
}

function humanDuration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years > 1 ? "s" : ""}`);
  if (rest) parts.push(`${rest} mo${rest > 1 ? "s" : ""}`);
  return parts.join(" ") || "1 mo";
}

/** Builds the display-ready range from LinkedIn's `timePeriod` object. */
function parseDateRange(rawTimePeriod: unknown): DateRange | null {
  const timePeriod = rawTimePeriod as Raw | undefined;
  if (!timePeriod) return null;

  const start = parseDate(timePeriod["startDate"]);
  const end = parseDate(timePeriod["endDate"]);
  if (!start && !end) return null;

  const isCurrent = Boolean(start) && !end;
  const durationMonths = start ? monthsBetween(start, end) : null;

  const rangeText = start
    ? `${start.text} - ${end?.text ?? "Present"}`
    : (end?.text ?? null);

  // Year-only entries (common on education) have no real month precision, so
  // showing "3 yrs" for "2013 - 2015" would be inventing detail.
  const showDuration = durationMonths !== null && start?.month !== null;

  const text =
    rangeText && showDuration
      ? `${rangeText} · ${humanDuration(durationMonths)}`
      : rangeText;

  return { start, end, isCurrent, text, durationMonths };
}

/* ────────────────────────── images ────────────────────────── */

/**
 * LinkedIn never gives a plain image URL. It gives a signed `rootUrl` plus a
 * list of "artifacts", one per rendered size, and you build each URL by
 * concatenating the two halves.
 */
export function parseImage(raw: unknown): ImageSet | null {
  const container = raw as Raw | undefined;
  const image =
    (container?.["com.linkedin.common.VectorImage"] as Raw | undefined) ??
    (container?.["rootUrl"] ? container : undefined);
  if (!image) return null;

  const rootUrl = str(image["rootUrl"]);
  const artifacts = Array.isArray(image["artifacts"]) ? (image["artifacts"] as Raw[]) : [];
  if (!rootUrl) return null;

  const sizes = artifacts
    .map((artifact) => {
      const segment = str(artifact["fileIdentifyingUrlPathSegment"]);
      if (!segment) return null;
      return {
        url: `${rootUrl}${segment}`,
        width: num(artifact["width"]),
        height: num(artifact["height"]),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));

  if (!sizes.length) return null;

  return { original: sizes[sizes.length - 1]!.url, sizes };
}

/* ────────────────────────── sections ────────────────────────── */

function parseExperience(view: unknown): Position[] {
  return elementsOf(view).map((item): Position => {
    const company = (item["company"] as Raw | undefined) ?? {};
    const miniCompany = (company["miniCompany"] as Raw | undefined) ?? {};
    const companyUrn = idFromUrn(item["companyUrn"] ?? miniCompany["entityUrn"]);
    const companySlug = str(miniCompany["universalName"]);

    return {
      title: str(item["title"]),
      companyName: str(item["companyName"]) ?? str(miniCompany["name"]),
      companyUrn,
      companyLinkedInUrl: companySlug
        ? `https://www.linkedin.com/company/${companySlug}`
        : null,
      companyLogo: parseImage(miniCompany["logo"]),
      employmentType: str(item["employmentTypeText"] ?? item["employmentType"]),
      location: str(item["locationName"] ?? item["geoLocationName"]),
      description: str(item["description"]),
      dateRange: parseDateRange(item["timePeriod"]),
    };
  });
}

function parseEducation(view: unknown): Education[] {
  return elementsOf(view).map((item): Education => {
    const school = (item["school"] as Raw | undefined) ?? {};
    // Only some school records carry a vanity name we can turn into a URL.
    const slug = str(school["universalName"]);
    return {
      schoolName: str(item["schoolName"]) ?? str(school["schoolName"]),
      schoolLinkedInUrl: slug ? `https://www.linkedin.com/school/${slug}` : null,
      schoolLogo: parseImage(school["logo"]),
      degreeName: str(item["degreeName"]),
      fieldOfStudy: str(item["fieldOfStudy"]),
      grade: str(item["grade"]),
      activities: str(item["activities"]),
      description: str(item["description"]),
      dateRange: parseDateRange(item["timePeriod"]),
    };
  });
}

export function parseSkills(view: unknown): Skill[] {
  const seen = new Set<string>();
  const skills: Skill[] = [];
  for (const item of elementsOf(view)) {
    const name = str(item["name"]);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    skills.push({
      name,
      endorsementCount: num(item["endorsementCount"] ?? item["numEndorsements"]),
    });
  }
  return skills;
}

function parseCertifications(view: unknown): Certification[] {
  return elementsOf(view).map((item): Certification => ({
    name: str(item["name"]),
    authority: str(item["authority"]),
    licenseNumber: str(item["licenseNumber"]),
    url: str(item["url"]),
    dateRange: parseDateRange(item["timePeriod"]),
  }));
}

function parseLanguages(view: unknown): Language[] {
  return elementsOf(view).map((item): Language => ({
    name: str(item["name"]),
    proficiency: humanizeEnum(str(item["proficiency"])),
  }));
}

/** `NATIVE_OR_BILINGUAL` -> `Native or bilingual`. */
function humanizeEnum(value: string | null): string | null {
  if (!value) return null;
  const words = value.toLowerCase().replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const namesOf = (raw: unknown): string[] =>
  elementsOf(raw)
    .map((item) => {
      const profile = (item["member"] as Raw | undefined) ?? item;
      const first = str(profile["firstName"]);
      const last = str(profile["lastName"]);
      const memberName = [first, last].filter(Boolean).join(" ");
      return str(item["name"]) ?? (memberName || null);
    })
    .filter((name): name is string => Boolean(name));

function parseProjects(view: unknown): Project[] {
  return elementsOf(view).map((item): Project => ({
    title: str(item["title"]),
    description: str(item["description"]),
    url: str(item["url"]),
    members: namesOf(item["members"]),
    dateRange: parseDateRange(item["timePeriod"]),
  }));
}

function parsePublications(view: unknown): Publication[] {
  return elementsOf(view).map((item): Publication => ({
    name: str(item["name"]),
    publisher: str(item["publisher"]),
    description: str(item["description"]),
    url: str(item["url"]),
    date: parseDate(item["date"]),
    authors: namesOf(item["authors"]),
  }));
}

function parseVolunteer(view: unknown): VolunteerExperience[] {
  return elementsOf(view).map((item): VolunteerExperience => ({
    role: str(item["role"]),
    companyName: str(item["companyName"]),
    cause: humanizeEnum(str(item["cause"])),
    description: str(item["description"]),
    dateRange: parseDateRange(item["timePeriod"]),
  }));
}

function parseHonors(view: unknown): Honor[] {
  return elementsOf(view).map((item): Honor => ({
    title: str(item["title"]),
    issuer: str(item["issuer"]),
    description: str(item["description"]),
    date: parseDate(item["issueDate"]),
  }));
}

function parseCourses(view: unknown): Course[] {
  return elementsOf(view).map((item): Course => ({
    name: str(item["name"]),
    number: str(item["number"]),
  }));
}

function parseOrganizations(view: unknown): Organization[] {
  return elementsOf(view).map((item): Organization => ({
    name: str(item["name"]),
    position: str(item["position"]),
    description: str(item["description"]),
    dateRange: parseDateRange(item["timePeriod"]),
  }));
}

function parsePatents(view: unknown): Patent[] {
  return elementsOf(view).map((item): Patent => ({
    title: str(item["title"]),
    number: str(item["number"]),
    description: str(item["description"]),
    url: str(item["url"]),
    issuer: str(item["issuer"]),
    date: parseDate(item["issueDate"] ?? item["filingDate"]),
    inventors: namesOf(item["inventors"]),
  }));
}

function parseTestScores(view: unknown): TestScore[] {
  return elementsOf(view).map((item): TestScore => ({
    name: str(item["name"]),
    score: str(item["score"]),
    description: str(item["description"]),
    date: parseDate(item["date"]),
  }));
}

/* ────────────────────────── contact info ────────────────────────── */

export function parseContactInfo(raw: unknown): LinkedInProfile["contactInfo"] {
  const data = raw as Raw | undefined;
  if (!data) return null;

  const websites = Array.isArray(data["websites"]) ? (data["websites"] as Raw[]) : [];
  const phones = Array.isArray(data["phoneNumbers"]) ? (data["phoneNumbers"] as Raw[]) : [];
  const twitter = Array.isArray(data["twitterHandles"])
    ? (data["twitterHandles"] as Raw[])
    : [];

  return {
    emailAddress: str(data["emailAddress"]),
    phoneNumbers: phones.map((phone) => ({
      number: str(phone["number"]),
      type: humanizeEnum(str(phone["type"])),
    })),
    twitterHandles: twitter
      .map((handle) => str(handle["name"]))
      .filter((name): name is string => Boolean(name)),
    websites: websites.map((site) => {
      const type = (site["type"] as Raw | undefined) ?? {};
      const category = (type["com.linkedin.voyager.identity.profile.StandardWebsite"] ??
        type["com.linkedin.voyager.identity.profile.CustomWebsite"]) as Raw | undefined;
      return {
        url: str(site["url"]),
        label: humanizeEnum(str(category?.["category"])) ?? str(category?.["label"]),
      };
    }),
    birthDateOnProfile: parseDate(data["birthDateOn"]),
  };
}

/* ────────────────────────── entry point ────────────────────────── */

export interface NormalizeInput {
  publicIdentifier: string;
  /** Body of `/identity/profiles/{id}/profileView`. */
  profileView: Raw;
  /** Body of `/identity/profiles/{id}/skills` (optional, fuller skill list). */
  skills?: unknown;
  /** Body of `/identity/profiles/{id}/networkinfo` (optional). */
  networkInfo?: Raw | null;
  /** Body of `/identity/profiles/{id}/profileContactInfo` (optional). */
  contactInfo?: Raw | null;
}

export function normalizeProfile(input: NormalizeInput): LinkedInProfile {
  const { profileView } = input;
  const profile = (profileView["profile"] as Raw | undefined) ?? {};
  const miniProfile = (profile["miniProfile"] as Raw | undefined) ?? {};

  const firstName = str(profile["firstName"]) ?? str(miniProfile["firstName"]);
  const lastName = str(profile["lastName"]) ?? str(miniProfile["lastName"]);
  const publicIdentifier =
    str(profile["publicIdentifier"]) ??
    str(miniProfile["publicIdentifier"]) ??
    input.publicIdentifier;

  const location = (profile["location"] as Raw | undefined) ?? {};
  const basicLocation = (location["basicLocation"] as Raw | undefined) ?? {};

  // The dedicated skills endpoint returns everything; `skillView` is capped at
  // the top few, so prefer the former and fall back to the latter.
  const skills = parseSkills(input.skills ?? profileView["skillView"]);
  const fallbackSkills = skills.length ? skills : parseSkills(profileView["skillView"]);

  return {
    publicIdentifier,
    profileId: idFromUrn(miniProfile["entityUrn"] ?? profile["entityUrn"]),
    profileUrl: profileUrlFor(publicIdentifier),

    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" ") || null,
    headline: str(profile["headline"]) ?? str(miniProfile["occupation"]),
    summary: str(profile["summary"]),

    location: {
      full:
        str(profile["geoLocationName"]) ??
        str(profile["locationName"]) ??
        str(location["basicLocation"] ? basicLocation["postalCode"] : null),
      country: str(profile["geoCountryName"]),
      countryCode: str(basicLocation["countryCode"])?.toUpperCase() ?? null,
      postalCode: str(basicLocation["postalCode"]),
    },

    industry: str(profile["industryName"]),
    isStudent: bool(profile["student"]),
    isPremium: bool(profileView["premiumSubscriber"] ?? profile["premiumSubscriber"]),
    isInfluencer: bool(profile["influencer"] ?? miniProfile["influencer"]),
    isOpenToWork: bool(profile["openToWork"]),
    isHiring: bool(profile["hiring"]),

    profilePicture: parseImage(miniProfile["picture"] ?? profile["picture"]),
    backgroundPicture: parseImage(
      miniProfile["backgroundImage"] ?? profile["backgroundImage"],
    ),

    connectionsCount: num(input.networkInfo?.["connectionsCount"]),
    followersCount: num(input.networkInfo?.["followersCount"]),

    experience: parseExperience(profileView["positionView"]),
    education: parseEducation(profileView["educationView"]),
    skills: fallbackSkills,
    certifications: parseCertifications(profileView["certificationView"]),
    languages: parseLanguages(profileView["languageView"]),
    projects: parseProjects(profileView["projectView"]),
    publications: parsePublications(profileView["publicationView"]),
    volunteerExperience: parseVolunteer(profileView["volunteerExperienceView"]),
    honors: parseHonors(profileView["honorView"]),
    courses: parseCourses(profileView["courseView"]),
    organizations: parseOrganizations(profileView["organizationView"]),
    patents: parsePatents(profileView["patentView"]),
    testScores: parseTestScores(profileView["testScoreView"]),

    contactInfo: parseContactInfo(input.contactInfo),
  };
}
