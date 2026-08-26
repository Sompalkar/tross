/**
 * The public response schema. This is *our* schema: LinkedIn's internal shapes
 * are messy and change often, so everything is normalised into these types
 * before it leaves the server. Every field is optional-friendly, because a
 * real profile rarely fills in every section.
 */

export interface DateParts {
  /** 1-12 */
  month: number | null;
  year: number | null;
  /** Pre-formatted for display, e.g. "Mar 2021". */
  text: string | null;
}

export interface DateRange {
  start: DateParts | null;
  end: DateParts | null;
  /** True when the entry has no end date (current role / ongoing study). */
  isCurrent: boolean;
  /** e.g. "Mar 2021 - Present · 3 yrs 5 mos" */
  text: string | null;
  durationMonths: number | null;
}

export interface Image {
  url: string;
  width: number | null;
  height: number | null;
}

export interface ImageSet {
  /** Largest artifact LinkedIn offers. */
  original: string | null;
  /** All sizes, smallest first. */
  sizes: Image[];
}

export interface Position {
  title: string | null;
  companyName: string | null;
  companyUrn: string | null;
  companyLinkedInUrl: string | null;
  companyLogo: ImageSet | null;
  employmentType: string | null;
  location: string | null;
  description: string | null;
  dateRange: DateRange | null;
}

export interface Education {
  schoolName: string | null;
  schoolLinkedInUrl: string | null;
  schoolLogo: ImageSet | null;
  degreeName: string | null;
  fieldOfStudy: string | null;
  grade: string | null;
  activities: string | null;
  description: string | null;
  dateRange: DateRange | null;
}

export interface Skill {
  name: string;
  endorsementCount: number | null;
}

export interface Certification {
  name: string | null;
  authority: string | null;
  licenseNumber: string | null;
  url: string | null;
  dateRange: DateRange | null;
}

export interface Language {
  name: string | null;
  proficiency: string | null;
}

export interface Project {
  title: string | null;
  description: string | null;
  url: string | null;
  members: string[];
  dateRange: DateRange | null;
}

export interface Publication {
  name: string | null;
  publisher: string | null;
  description: string | null;
  url: string | null;
  date: DateParts | null;
  authors: string[];
}

export interface VolunteerExperience {
  role: string | null;
  companyName: string | null;
  cause: string | null;
  description: string | null;
  dateRange: DateRange | null;
}

export interface Honor {
  title: string | null;
  issuer: string | null;
  description: string | null;
  date: DateParts | null;
}

export interface Course {
  name: string | null;
  number: string | null;
}

export interface Organization {
  name: string | null;
  position: string | null;
  description: string | null;
  dateRange: DateRange | null;
}

export interface Patent {
  title: string | null;
  number: string | null;
  description: string | null;
  url: string | null;
  issuer: string | null;
  date: DateParts | null;
  inventors: string[];
}

export interface TestScore {
  name: string | null;
  score: string | null;
  description: string | null;
  date: DateParts | null;
}

export interface ContactInfo {
  emailAddress: string | null;
  phoneNumbers: { number: string | null; type: string | null }[];
  twitterHandles: string[];
  websites: { url: string | null; label: string | null }[];
  birthDateOnProfile: DateParts | null;
}

export interface LinkedInProfile {
  /** The slug from the URL, e.g. "williamhgates". */
  publicIdentifier: string | null;
  profileId: string | null;
  profileUrl: string | null;

  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  headline: string | null;
  summary: string | null;

  location: {
    full: string | null;
    country: string | null;
    countryCode: string | null;
    postalCode: string | null;
  };

  industry: string | null;
  isStudent: boolean | null;
  isPremium: boolean | null;
  isInfluencer: boolean | null;
  isOpenToWork: boolean | null;
  isHiring: boolean | null;

  profilePicture: ImageSet | null;
  backgroundPicture: ImageSet | null;

  connectionsCount: number | null;
  followersCount: number | null;

  experience: Position[];
  education: Education[];
  skills: Skill[];
  certifications: Certification[];
  languages: Language[];
  projects: Project[];
  publications: Publication[];
  volunteerExperience: VolunteerExperience[];
  honors: Honor[];
  courses: Course[];
  organizations: Organization[];
  patents: Patent[];
  testScores: TestScore[];

  contactInfo: ContactInfo | null;
}

export interface ProfileResponse {
  success: true;
  meta: {
    /** Where the data came from: the live LinkedIn API or local fixtures. */
    source: "linkedin" | "mock";
    cached: boolean;
    fetchedAt: string;
    durationMs: number;
  };
  data: LinkedInProfile;
}
