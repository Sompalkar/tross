import { NextResponse } from "next/server";

/**
 * A thin server-side proxy in front of the backend.
 *
 * The browser calls this route, this route calls the API. That way the API key
 * lives only in the server environment and never reaches the client bundle.
 */
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_KEY = process.env.API_KEY ?? "";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * The backend rate-limits by IP, but every request from this proxy carries the
 * *proxy's* IP — so without a limit here, all browser users would share one
 * bucket and a single abuser could lock everyone out. This limits each real
 * visitor separately, before their request ever reaches the API.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();

  // Opportunistic cleanup, so the map cannot grow without bound.
  if (hits.size > 5_000) {
    for (const [key, entry] of hits) if (entry.resetAt < now) hits.delete(key);
  }

  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

/** Vercel and most hosts set x-forwarded-for; the first entry is the client. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return fail(429, "RATE_LIMITED", "Too many lookups. Please wait a minute.");
  }

  let url: unknown;
  try {
    ({ url } = (await request.json()) as { url?: unknown });
  } catch {
    return fail(400, "BAD_REQUEST", "Expected a JSON body.");
  }

  if (typeof url !== "string" || !url.trim()) {
    return fail(400, "BAD_REQUEST", "Please paste a LinkedIn profile URL.");
  }

  if (url.length > 500) {
    return fail(400, "BAD_REQUEST", "That URL is too long.");
  }

  const target = new URL("/api/profile", API_BASE_URL);
  target.searchParams.set("url", url.trim());

  try {
    const response = await fetch(target, {
      headers: API_KEY ? { "x-api-key": API_KEY } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.json();
    return NextResponse.json(body, { status: response.status });
  } catch {
    // The API's address is not echoed back in production; in development it
    // is the single most useful thing to see.
    return fail(
      502,
      "API_UNREACHABLE",
      process.env.NODE_ENV === "production"
        ? "The profile API is not responding. Please try again shortly."
        : `Could not reach the API at ${API_BASE_URL}. Is the backend running?`,
    );
  }
}
