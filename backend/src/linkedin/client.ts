import axios, { AxiosError, type AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import { env, linkedInCookieHeader } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/errors.js";
import { sleep } from "../utils/sleep.js";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  How we read a profile
 * ─────────────────────────────────────────────────────────────────────────────
 * LinkedIn used to expose a private JSON API at /voyager/api. That is gone:
 * `/identity/profiles/{id}/profileView` now answers 410, and the current
 * desktop site fetches nothing at all for a profile — it ships the page as a
 * React Server Components payload, which is a UI tree rather than data.
 *
 * What LinkedIn does still serve is "mwlite", its lightweight mobile site.
 * Ask for a profile with a mobile user agent and the server returns the whole
 * profile as plain, already-rendered HTML: name, headline, location, about,
 * experience, education, skills, accomplishments, images — one request, no
 * JavaScript, no query hashes that expire.
 *
 * Two details make the difference between data and an infinite redirect:
 *
 *   1. The FULL cookie header. `li_at` alone is not enough any more; LinkedIn
 *      also wants its routing and device cookies (lidc, bcookie, bscookie).
 *      Without them it 302s to the same URL forever, trying to set them.
 *   2. A cookie jar. LinkedIn rotates `li_at` mid-session: it answers with a
 *      redirect that carries a replacement cookie and expects the next request
 *      to use it. A client that keeps resending the original loops forever.
 */
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (client) return client;

  const cookie = linkedInCookieHeader();
  if (!cookie) {
    throw ApiError.notConfigured(
      "No LinkedIn cookie configured. Set LINKEDIN_COOKIE, or run with MOCK_MODE=true.",
    );
  }

  // Seed the jar with the captured cookies, then let it absorb whatever
  // LinkedIn rotates during the session.
  const jar = new CookieJar();
  for (const pair of cookie.split(";")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    try {
      jar.setCookieSync(`${trimmed}; Domain=.linkedin.com; Path=/`, "https://www.linkedin.com");
    } catch {
      // A malformed pair is not worth failing the whole request over.
    }
  }

  client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      timeout: 30_000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: {
        "user-agent": MOBILE_USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "upgrade-insecure-requests": "1",
      },
    }),
  );

  return client;
}

/** Only used by tests, so a fresh client picks up changed env vars. */
export function resetClient(): void {
  client = null;
}

/** Fetches a profile page as HTML, with LinkedIn's failures made legible. */
export async function fetchProfileHtml(publicIdentifier: string): Promise<string> {
  const http = getClient();
  await sleep(env.REQUEST_DELAY_MS);

  const url = `https://www.linkedin.com/in/${encodeURIComponent(publicIdentifier)}/`;
  const started = Date.now();

  const response = await http.get<string>(url);
  const html = typeof response.data === "string" ? response.data : "";

  logger.debug(
    { publicIdentifier, status: response.status, bytes: html.length, ms: Date.now() - started },
    "profile fetch",
  );

  if (response.status === 404) throw ApiError.notFound();

  if (response.status === 429) {
    throw new ApiError(
      429,
      "LINKEDIN_RATE_LIMITED",
      "LinkedIn is rate limiting this account. Raise REQUEST_DELAY_MS and try again later.",
    );
  }

  if (response.status >= 400) {
    throw ApiError.upstream(`LinkedIn responded with HTTP ${response.status}.`, {
      status: response.status,
    });
  }

  // A valid session that has been bounced to the login or challenge page
  // still returns 200, so the body has to be checked too.
  if (/\/uas\/login|authwall|Sign in to LinkedIn/i.test(html.slice(0, 5000))) {
    throw ApiError.upstream(
      "LinkedIn served a login wall. The cookie has expired or was invalidated — capture a fresh one.",
    );
  }

  if (/security\s+verification|challenge/i.test(html.slice(0, 3000))) {
    throw ApiError.upstream(
      "LinkedIn is showing a security challenge for this account. Sign in from a browser to clear it.",
    );
  }

  if (html.length < 5_000) {
    throw ApiError.upstream(
      "LinkedIn returned an unexpectedly small page. The session is probably no longer valid.",
    );
  }

  return html;
}

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Fetches the logged-out public profile page.
 *
 * mwlite never sends a member's avatar — it renders a grey placeholder and
 * would fill it in from JavaScript. The public page, on the other hand,
 * carries the photo in its Open Graph tags, and because it is fetched with no
 * cookie there is no chance of picking up the *viewer's* own avatar by
 * mistake. It is a separate, unauthenticated request, and it is allowed to
 * fail without failing the lookup.
 */
export async function fetchPublicProfileHtml(
  publicIdentifier: string,
): Promise<string | null> {
  try {
    const response = await axios.get<string>(
      `https://www.linkedin.com/in/${encodeURIComponent(publicIdentifier)}`,
      {
        headers: {
          "user-agent": DESKTOP_USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
        timeout: 15_000,
        maxRedirects: 5,
        validateStatus: () => true,
      },
    );
    return response.status === 200 && typeof response.data === "string"
      ? response.data
      : null;
  } catch (error) {
    logger.debug({ publicIdentifier, err: error }, "public page fetch failed");
    return null;
  }
}

/** Turns network-level failures into the same ApiError shape. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    if (error.code === "ERR_FR_TOO_MANY_REDIRECTS") {
      return ApiError.upstream(
        "LinkedIn redirected in a loop. That means the cookie is stale or incomplete — copy the whole cookie header from a logged-in browser.",
      );
    }
    return ApiError.upstream(`Could not reach LinkedIn: ${error.message}`);
  }

  return ApiError.upstream(
    error instanceof Error ? error.message : "Unknown error talking to LinkedIn.",
  );
}
