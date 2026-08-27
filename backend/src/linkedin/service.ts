import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { TtlCache } from "../utils/cache.js";
import { fetchProfileHtml, fetchPublicProfileHtml, toApiError } from "./client.js";
import { parseProfileHtml } from "./parse.js";
import { extractPublicIdentifier } from "./url.js";
import { ApiError } from "../utils/errors.js";
import type { LinkedInProfile, ProfileResponse } from "../types/profile.js";

const cache = new TtlCache<LinkedInProfile>(env.CACHE_TTL_SECONDS);

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(here, "../../fixtures/profile.html");

export interface GetProfileOptions {
  /** Skip the cache and always hit LinkedIn. */
  refresh?: boolean;
}

export async function getProfile(
  inputUrl: string,
  options: GetProfileOptions = {},
): Promise<ProfileResponse> {
  const started = Date.now();
  const publicIdentifier = extractPublicIdentifier(inputUrl);
  const cacheKey = publicIdentifier;

  if (!options.refresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return {
        success: true,
        meta: {
          source: env.MOCK_MODE ? "mock" : "linkedin",
          cached: true,
          fetchedAt: new Date().toISOString(),
          durationMs: Date.now() - started,
        },
        data: cached,
      };
    }
  }

  const data = env.MOCK_MODE
    ? await fetchFromFixture(publicIdentifier)
    : await fetchFromLinkedIn(publicIdentifier, options);

  cache.set(cacheKey, data);

  return {
    success: true,
    meta: {
      source: env.MOCK_MODE ? "mock" : "linkedin",
      cached: false,
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    },
    data,
  };
}

async function fetchFromLinkedIn(
  publicIdentifier: string,
  _options: GetProfileOptions,
): Promise<LinkedInProfile> {
  try {
    // The authenticated page carries the data; the public page carries the
    // avatar. The second one is a bonus, so a failure there is not fatal.
    const [html, publicHtml] = await Promise.all([
      fetchProfileHtml(publicIdentifier),
      fetchPublicProfileHtml(publicIdentifier),
    ]);

    const profile = parseProfileHtml(html, publicIdentifier, publicHtml);

    // LinkedIn answers 200 with a generic page for a slug that does not exist,
    // so a bad URL would otherwise come back as `success: true` and a body of
    // nulls. Every real profile has a name — no name means no profile.
    if (!profile.fullName) {
      throw ApiError.notFound(
        "LinkedIn has no profile at that URL, or it is not visible to the logged-in account.",
      );
    }

    return profile;
  } catch (error) {
    logger.warn({ publicIdentifier, err: error }, "profile fetch failed");
    throw toApiError(error);
  }
}

/**
 * MOCK_MODE serves a saved LinkedIn response from disk. It lets reviewers and
 * the frontend exercise the whole pipeline (parsing included) without a
 * LinkedIn session, and it is what the automated tests run against.
 */
async function fetchFromFixture(publicIdentifier: string): Promise<LinkedInProfile> {
  const html = await readFile(FIXTURE_PATH, "utf8");
  return parseProfileHtml(html, publicIdentifier);
}

export const profileCache = cache;
