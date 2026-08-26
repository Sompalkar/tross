import axios, { AxiosError, type AxiosInstance } from "axios";
import { env, hasLinkedInCredentials } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/errors.js";
import { sleep } from "../utils/sleep.js";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Voyager
 * ─────────────────────────────────────────────────────────────────────────────
 * linkedin.com is a single-page app. When you open a profile in the browser,
 * the page itself is nearly empty and the real data arrives from LinkedIn's
 * private JSON API, which lives under /voyager/api/. That API is what we talk
 * to here — it returns clean JSON, so we never have to parse HTML.
 *
 * To be allowed in, a request needs to look exactly like the browser's:
 *   1. cookie      -> `li_at` (the session) and `JSESSIONID` (the CSRF value)
 *   2. csrf-token  -> the JSESSIONID value again, without its quotes
 *   3. x-restli-protocol-version: 2.0.0  -> Rest.li, LinkedIn's RPC layer
 * Miss any of the three and LinkedIn answers 401/403 instead of data.
 */
const VOYAGER_BASE = "https://www.linkedin.com/voyager/api";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** JSESSIONID is stored as `"ajax:1234..."` — the CSRF header wants it unquoted. */
const stripQuotes = (value: string): string => value.replace(/^"|"$/g, "");

let client: AxiosInstance | null = null;

export function getVoyagerClient(): AxiosInstance {
  if (client) return client;

  if (!hasLinkedInCredentials) {
    throw ApiError.notConfigured(
      "LINKEDIN_LI_AT and LINKEDIN_JSESSIONID are not set. Set them, or run with MOCK_MODE=true.",
    );
  }

  const liAt = env.LINKEDIN_LI_AT!;
  const jsessionId = stripQuotes(env.LINKEDIN_JSESSIONID!);

  client = axios.create({
    baseURL: VOYAGER_BASE,
    timeout: 20_000,
    // Handle every status ourselves so we can map them to friendly errors.
    validateStatus: () => true,
    headers: {
      cookie: `li_at=${liAt}; JSESSIONID="${jsessionId}";`,
      "csrf-token": jsessionId,
      "x-restli-protocol-version": "2.0.0",
      "x-li-lang": "en_US",
      "x-li-track": JSON.stringify({
        clientVersion: "1.13.9",
        mpVersion: "1.13.9",
        osName: "web",
        timezoneOffset: 0,
        deviceFormFactor: "DESKTOP",
        mpName: "voyager-web",
      }),
      // Plain JSON gives us the classic nested `profileView` shape, which is
      // far easier to read than the "normalized" graph format LinkedIn also
      // offers (that one returns URNs plus a flat `included` array).
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT,
      referer: "https://www.linkedin.com/feed/",
    },
  });

  return client;
}

/** Only used by tests, so a fresh client picks up changed env vars. */
export function resetVoyagerClient(): void {
  client = null;
}

export interface VoyagerGetOptions {
  /** Some endpoints 404 for perfectly normal reasons; then we want `null`. */
  optional?: boolean;
  headers?: Record<string, string>;
}

/**
 * GET a Voyager path, with a small delay in front of it (rate-limit hygiene)
 * and LinkedIn's status codes translated into meaningful API errors.
 */
export async function voyagerGet<T>(
  path: string,
  options: VoyagerGetOptions = {},
): Promise<T | null> {
  const http = getVoyagerClient();
  await sleep(env.REQUEST_DELAY_MS);

  const started = Date.now();
  const response = await http.get<T>(path, { headers: options.headers });
  logger.debug(
    { path, status: response.status, ms: Date.now() - started },
    "voyager request",
  );

  const { status, data } = response;

  if (status >= 200 && status < 300) return data;

  if (status === 404 || status === 400) {
    if (options.optional) return null;
    throw ApiError.notFound(
      "LinkedIn has no profile at that URL, or the profile is not visible to the logged-in account.",
    );
  }

  if (status === 401) {
    throw ApiError.upstream(
      "LinkedIn rejected the session cookie. It has expired or was invalidated — refresh LINKEDIN_LI_AT and LINKEDIN_JSESSIONID.",
    );
  }

  if (status === 403) {
    throw ApiError.upstream(
      "LinkedIn returned 403. The account is most likely challenged (captcha / verification) — sign in from a browser to clear it.",
    );
  }

  if (status === 429) {
    throw new ApiError(
      429,
      "LINKEDIN_RATE_LIMITED",
      "LinkedIn is rate limiting this account. Slow down (raise REQUEST_DELAY_MS) and try again later.",
    );
  }

  if (options.optional) return null;

  throw ApiError.upstream(`LinkedIn responded with HTTP ${status}.`, {
    status,
    body: typeof data === "string" ? data.slice(0, 500) : data,
  });
}

/** Turns network-level failures into the same ApiError shape. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    return ApiError.upstream(`Could not reach LinkedIn: ${error.message}`);
  }
  return ApiError.upstream(
    error instanceof Error ? error.message : "Unknown error talking to LinkedIn.",
  );
}
