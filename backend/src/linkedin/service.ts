import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { TtlCache } from "../utils/cache.js";
import { toApiError, voyagerGet } from "./client.js";
import { normalizeProfile } from "./normalize.js";
import { extractPublicIdentifier } from "./url.js";
import type { LinkedInProfile, ProfileResponse } from "../types/profile.js";

const cache = new TtlCache<LinkedInProfile>(env.CACHE_TTL_SECONDS);

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(here, "../../fixtures/profile-view.json");

export interface GetProfileOptions {
  /** Skip the cache and always hit LinkedIn. */
  refresh?: boolean;
  /** Also request contact info (one extra LinkedIn call). */
  includeContactInfo?: boolean;
}

export async function getProfile(
  inputUrl: string,
  options: GetProfileOptions = {},
): Promise<ProfileResponse> {
  const started = Date.now();
  const publicIdentifier = extractPublicIdentifier(inputUrl);
  const cacheKey = `${publicIdentifier}:${options.includeContactInfo ? "contact" : "base"}`;

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
  options: GetProfileOptions,
): Promise<LinkedInProfile> {
  const id = encodeURIComponent(publicIdentifier);

  try {
    // The main call. Everything below it is a bonus, so those are `optional`
    // and a failure there never fails the whole request.
    const profileView = await voyagerGet<Record<string, unknown>>(
      `/identity/profiles/${id}/profileView`,
    );

    if (!profileView || !profileView["profile"]) {
      throw toApiError(
        new Error("LinkedIn returned an empty profile document."),
      );
    }

    const [skills, networkInfo, contactInfo] = await Promise.all([
      voyagerGet<Record<string, unknown>>(
        `/identity/profiles/${id}/skills?count=100&start=0`,
        { optional: true },
      ),
      voyagerGet<Record<string, unknown>>(`/identity/profiles/${id}/networkinfo`, {
        optional: true,
      }),
      options.includeContactInfo
        ? voyagerGet<Record<string, unknown>>(
            `/identity/profiles/${id}/profileContactInfo`,
            { optional: true },
          )
        : Promise.resolve(null),
    ]);

    return normalizeProfile({
      publicIdentifier,
      profileView,
      skills,
      networkInfo,
      contactInfo,
    });
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
  const raw = await readFile(FIXTURE_PATH, "utf8");
  const fixture = JSON.parse(raw) as Record<string, unknown>;
  return normalizeProfile({ publicIdentifier, profileView: fixture });
}

export const profileCache = cache;
