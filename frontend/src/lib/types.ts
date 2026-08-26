/**
 * Mirrors the response schema of the backend (`backend/src/types/profile.ts`).
 * Kept as a plain copy so the frontend can be deployed on its own.
 */
export interface DateParts {
  month: number | null;
  year: number | null;
  text: string | null;
}

export interface DateRange {
  start: DateParts | null;
  end: DateParts | null;
  isCurrent: boolean;
  text: string | null;
  durationMonths: number | null;
}

export interface ImageSet {
  original: string | null;
  sizes: { url: string; width: number | null; height: number | null }[];
}

export interface Position {
  title: string | null;
  companyName: string | null;
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

export interface LinkedInProfile {
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
  skills: { name: string; endorsementCount: number | null }[];
  certifications: {
    name: string | null;
    authority: string | null;
    licenseNumber: string | null;
    url: string | null;
    dateRange: DateRange | null;
  }[];
  languages: { name: string | null; proficiency: string | null }[];
  projects: {
    title: string | null;
    description: string | null;
    url: string | null;
    members: string[];
    dateRange: DateRange | null;
  }[];
  publications: {
    name: string | null;
    publisher: string | null;
    description: string | null;
    url: string | null;
    date: DateParts | null;
    authors: string[];
  }[];
  volunteerExperience: {
    role: string | null;
    companyName: string | null;
    cause: string | null;
    description: string | null;
    dateRange: DateRange | null;
  }[];
  honors: {
    title: string | null;
    issuer: string | null;
    description: string | null;
    date: DateParts | null;
  }[];
  courses: { name: string | null; number: string | null }[];
  organizations: {
    name: string | null;
    position: string | null;
    description: string | null;
    dateRange: DateRange | null;
  }[];
  patents: unknown[];
  testScores: unknown[];
  contactInfo: {
    emailAddress: string | null;
    phoneNumbers: { number: string | null; type: string | null }[];
    twitterHandles: string[];
    websites: { url: string | null; label: string | null }[];
    birthDateOnProfile: DateParts | null;
  } | null;
}

export interface ProfileSuccess {
  success: true;
  meta: {
    source: "linkedin" | "mock";
    cached: boolean;
    fetchedAt: string;
    durationMs: number;
  };
  data: LinkedInProfile;
}

export interface ProfileFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export type ProfileResult = ProfileSuccess | ProfileFailure;
