import { ApiError } from "../utils/errors.js";

/**
 * LinkedIn profile URLs come in many shapes:
 *   https://www.linkedin.com/in/williamhgates/
 *   https://in.linkedin.com/in/williamhgates
 *   linkedin.com/in/williamhgates?originalSubdomain=in
 *   https://www.linkedin.com/in/%C3%A9lodie-martin  (percent-encoded)
 * They all carry the same thing: the "public identifier" (the vanity slug).
 * A bare slug is accepted too, so `?url=williamhgates` works.
 */
const PROFILE_PATH = /\/in\/([^/?#]+)/i;
const SLUG_ONLY = /^[\w\p{L}\p{N}\-%._]+$/u;

export function extractPublicIdentifier(input: string): string {
  const raw = input.trim();
  if (!raw) throw ApiError.badRequest("`url` is required.");

  // Bare slug, no scheme or host.
  if (!raw.includes("/") && !raw.includes(".")) {
    if (!SLUG_ONLY.test(raw)) {
      throw ApiError.badRequest(`"${input}" is not a valid LinkedIn profile slug.`);
    }
    return decodeSlug(raw);
  }

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw ApiError.badRequest(`"${input}" is not a valid URL.`);
  }

  if (!/(^|\.)linkedin\.com$/i.test(parsed.hostname)) {
    throw ApiError.badRequest(
      `"${parsed.hostname}" is not a linkedin.com host. Pass a profile URL such as https://www.linkedin.com/in/<slug>.`,
    );
  }

  const match = PROFILE_PATH.exec(parsed.pathname);
  if (!match?.[1]) {
    throw ApiError.badRequest(
      "Only personal profile URLs are supported (they look like /in/<slug>). Company, school and post URLs are not.",
    );
  }

  return decodeSlug(match[1]);
}

function decodeSlug(slug: string): string {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    /* keep the raw value if it is not valid percent-encoding */
  }
  decoded = decoded.replace(/\/+$/, "").trim();
  if (!decoded) throw ApiError.badRequest("Could not read a profile slug from the URL.");

  // The slug becomes part of an upstream URL path. It is re-encoded before it
  // is used, so this is belt-and-braces: a slug that decodes to path syntax is
  // not a real profile, and refusing it here keeps the guarantee local and
  // obvious rather than depending on the encoder further downstream.
  if (/[/\\]/.test(decoded) || decoded.includes("..")) {
    throw ApiError.badRequest(`"${slug}" is not a valid LinkedIn profile slug.`);
  }

  return decoded;
}

export const profileUrlFor = (publicIdentifier: string): string =>
  `https://www.linkedin.com/in/${encodeURIComponent(publicIdentifier)}`;
