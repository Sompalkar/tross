# LinkedIn Profile API

Give it a LinkedIn profile URL, get structured JSON back.

```
GET /api/profile?url=https://www.linkedin.com/in/williamhgates
```

```jsonc
{
  "success": true,
  "meta": { "source": "linkedin", "cached": false, "fetchedAt": "…", "durationMs": 2186 },
  "data": {
    "fullName": "Bill Gates",
    "headline": "Chair, Gates Foundation and Founder, Breakthrough Energy",
    "location": { "full": "Seattle, Washington, United States", "country": "United States" },
    "followersCount": 40604081,
    "summary": "Chair of the Gates Foundation. Founder of Breakthrough Energy…",
    "profilePicture": { "original": "https://media.licdn.com/…", "sizes": [ … ] },
    "experience": [ … ], "education": [ … ], "skills": [ … ],
    "certifications": [ … ], "languages": [ … ]
  }
}
```

- **`backend/`** — the API. Node.js + TypeScript + Express.
- **`frontend/`** — a small Next.js + Tailwind page to try it in a browser.

---

## Table of contents

1. [What this is, in plain English](#1-what-this-is-in-plain-english)
2. [How it works](#2-how-it-works)
3. [What I tried first, and why it failed](#3-what-i-tried-first-and-why-it-failed)
4. [Quick start](#4-quick-start)
5. [Getting your LinkedIn cookie](#5-getting-your-linkedin-cookie)
6. [API documentation](#6-api-documentation)
7. [Response schema](#7-response-schema)
8. [Project layout](#8-project-layout)
9. [Deploying](#9-deploying)
10. [Testing](#10-testing)
11. [Security notes](#11-security-notes)
12. [Known limitations](#12-known-limitations)
13. [Legal and ethical note](#13-legal-and-ethical-note)

---

## 1. What this is, in plain English

LinkedIn has an official API, but it will not let you read arbitrary people's
profiles. So the task is to get the same data the *website* shows you, and serve
it as clean JSON.

The whole project is three steps:

1. **Read the slug from the URL.** `https://www.linkedin.com/in/williamhgates/` → `williamhgates`.
2. **Ask LinkedIn for that profile**, pretending to be a logged-in phone browser.
3. **Clean up the answer** into a tidy schema of our own.

The interesting part is step 2, because LinkedIn has three different versions of
itself and only one of them will hand over the data.

## 2. How it works

### 2.1 The three LinkedIns

Ask `linkedin.com/in/<slug>` for a page and what you get back depends on the
**user agent** you send:

| You look like | What LinkedIn sends | Useful? |
| --- | --- | --- |
| a logged-out visitor | a teaser page + Open Graph tags | the profile photo, nothing else |
| a desktop browser | a 1 MB React Server Components payload | data is there, but as UI tree fragments |
| **a phone browser** | **"mwlite": the whole profile as plain HTML** | **yes** |

**mwlite** is LinkedIn's lightweight mobile site, built for slow connections.
It renders everything on the server and ships finished HTML — name, headline,
location, about, experience, education, skills, certifications, languages,
projects, logos. One request, no JavaScript, and nothing that expires.

So the client sends an iPhone `user-agent` and reads the HTML that comes back.
See [`backend/src/linkedin/client.ts`](backend/src/linkedin/client.ts).

### 2.2 The two things that make it work

Getting a page instead of an infinite redirect needs both of these:

**1. The whole cookie header.** `li_at` (your session) is not enough any more.
LinkedIn also wants its routing and device cookies — `lidc` decides which
datacentre serves you, `bcookie` and `bscookie` identify the browser. Miss them
and LinkedIn answers `302` pointing at the same URL, forever, trying to set
them. A real browser sends about 34 cookies; so do we.

**2. A cookie jar.** LinkedIn rotates your session mid-flight: it replies with a
redirect carrying a *replacement* `li_at` and expects the next request to use
it. A client that keeps resending the original loops until it gives up. The jar
(`tough-cookie`) stores whatever LinkedIn hands back, so the retry succeeds.

Between them, these two explain almost every "my LinkedIn scraper mysteriously
stopped working" report.

### 2.3 Reading the HTML without it being fragile

HTML parsing has a bad reputation because people match on styling classes,
which change constantly. This parser leans on the things that *don't*:

- **Semantic containers** — `.experience-container`, `.education-container`,
  `.skills-list`, `.accomplishment-type.certifications-section`.
- **LinkedIn's own tracking attributes** — `data-tracking-control-name="profile-position"`
  marks a company link no matter how it is styled.
- **Shape, not position.** Inside an entry the lines are not in a guaranteed
  order, so instead of "line 2 is the date" the parser asks *which line looks
  like a date* (contains a year or "Present") and treats the rest accordingly.

Three quirks were worth handling explicitly, and each has a test:

| Quirk | What you see | What we do |
| --- | --- | --- |
| Separators are drawn in CSS | `<span class="dot-separator">` is **empty**, so "Master of Science · Computer Science" arrives as one run-on string | replace those spans with a real `·` once, up front, then split on it |
| Images are lazy-loaded | the real URL is in `data-delayed-url`; `src` is a grey placeholder on `static.licdn.com` | only accept `media.licdn.com` URLs |
| Location shares its element with the counts | `"Seattle, Washington, United States 40,604,066 followers"` | pull the counts out by pattern, keep the remainder |

See [`backend/src/linkedin/parse.ts`](backend/src/linkedin/parse.ts).

### 2.4 Where the profile photo comes from

mwlite never sends a member's avatar — it renders a grey placeholder and would
fill it in later from JavaScript. So the photo comes from a second, separate
request to the **logged-out public page**, which advertises it in its
`og:image` tag.

Two reasons this is the right source rather than digging it out of the desktop
payload: it needs no cookie at all, and because it is unauthenticated there is
no chance of accidentally picking up *the viewer's own* avatar, which does
appear in the desktop page. That request is allowed to fail without failing the
lookup.

### 2.5 Being a good citizen

Hammering LinkedIn from one account is the fastest way to get it restricted:

- **A pause before every call** (`REQUEST_DELAY_MS`, default 1.2 s).
- **An in-memory cache** (`CACHE_TTL_SECONDS`, default 15 min).
- **A per-IP rate limit** on the public endpoint (default 20/minute).
- **Honest error mapping** — a redirect loop reports "your cookie is stale or
  incomplete", not a generic `500`.

## 3. What I tried first, and why it failed

Worth recording, because the obvious approach is now a dead end.

**Voyager.** For years LinkedIn's site was a single-page app backed by a private
JSON API at `/voyager/api/`, and every scraper called
`/identity/profiles/{slug}/profileView` with a `li_at` cookie, a `csrf-token`
echoing `JSESSIONID`, and `x-restli-protocol-version: 2.0.0`. It returned the
entire profile as clean JSON.

I built that first. Against live LinkedIn it returns **`410 Gone`**. So does
`/identity/profiles/{slug}`. The endpoint has been retired.

**GraphQL.** The natural next guess is that it moved to
`/voyager/api/graphql` with a `queryId`. I recorded a real profile visit with
DevTools: **1566 requests, zero GraphQL calls** carrying profile data. The
desktop site does not fetch the profile at all — it is server-rendered.

**The desktop payload.** That server-rendered page holds the data inside an
884 KB React Server Components stream: React element trees with the text spread
through them, not a data model. Parseable, but genuinely brittle.

Which left mwlite — smaller, cleaner, and with no query hash to go stale. It is
the approach the project ships.

## 4. Quick start

Requirements: **Node.js 20 or newer**.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

`.env.example` ships with `MOCK_MODE=true`, so **it runs immediately with no
LinkedIn account** — it serves a bundled sample profile through the exact same
parsing pipeline. Try it:

```bash
curl "http://localhost:4000/api/profile?url=https://www.linkedin.com/in/ada-lovelace"
```

For real profiles, put your cookie in `.env` (see
[section 5](#5-getting-your-linkedin-cookie)) and set `MOCK_MODE=false`.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>, paste a profile URL, and you get a rendered
profile plus the raw JSON.

The browser never calls the API directly — it posts to `/api/lookup`, a small
Next.js route handler that forwards the request server-side. That keeps
`API_KEY` out of the JavaScript bundle.

## 5. Getting your LinkedIn cookie

The backend authenticates as *you*, using the cookies from a browser where you
are already signed in. No password is typed by this code or stored anywhere.

You need the **whole cookie header**, not just `li_at`:

1. Sign in to <https://www.linkedin.com> in Chrome.
2. Open any profile, e.g. `https://www.linkedin.com/in/williamhgates/`.
3. DevTools (<kbd>F12</kbd>) → **Network** → click the **Doc** filter.
4. Hard-reload the page. One row appears, named after the profile.
5. Right-click it → **Copy** → **Copy as cURL**.
6. From what you copied, take the long string after `-b '` (or after
   `-H 'cookie: '`) and put it on one line in `backend/.env`:

```dotenv
LINKEDIN_COOKIE=bscookie="v=1&…"; JSESSIONID="ajax:…"; lidc="b=…"; li_at=AQED…; bcookie="v=2&…"
MOCK_MODE=false
```

> **Treat this like a password.** Anyone holding it is logged in as you. It is
> why `.env` is git-ignored, why `capture*.txt` is git-ignored, and why the
> deploy config marks it dashboard-only. Signing out of LinkedIn everywhere
> invalidates it.

Cookies expire, and LinkedIn will eventually rotate you out. When that happens
the API returns a clear error telling you to capture a fresh one, rather than
failing silently.

### Environment variables

| Variable | Default | What it does |
| --- | --- | --- |
| `LINKEDIN_COOKIE` | — | Full cookie header. Required unless `MOCK_MODE=true`. |
| `LINKEDIN_LI_AT` / `LINKEDIN_JSESSIONID` | — | Older two-cookie style. Still accepted, but usually not sufficient on its own. |
| `MOCK_MODE` | `false` | Serve the bundled sample profile instead of calling LinkedIn. |
| `PORT` | `4000` | Port to listen on. |
| `API_KEY` | *(empty)* | If set, callers must send it as `x-api-key`. Empty = open API. |
| `CORS_ORIGINS` | `*` | Comma-separated allowed browser origins. |
| `CACHE_TTL_SECONDS` | `900` | How long to reuse a fetched profile. `0` disables the cache. |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window. |
| `RATE_LIMIT_MAX` | `20` | Max requests per IP per window. |
| `REQUEST_DELAY_MS` | `1200` | Pause before each LinkedIn call. |
| `LOG_LEVEL` | `info` | pino log level. |

Invalid configuration fails at startup with a readable message, rather than at
the first request.

## 6. API documentation

Base URL (local): `http://localhost:4000`

Authentication: if `API_KEY` is set, send it as `x-api-key: <key>` or
`Authorization: Bearer <key>`. Otherwise no auth is needed.

---

### `GET /api/health`

Liveness check. Never requires an API key.

```json
{
  "success": true,
  "status": "ok",
  "uptimeSeconds": 42,
  "mode": "live",
  "linkedInCredentialsConfigured": true,
  "version": "1.0.0"
}
```

---

### `GET /api/profile`

| Query param | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | string | **required** | A LinkedIn profile URL, or just the slug. Max 500 chars. |
| `refresh` | `true`/`false` | `false` | Skip the cache and re-fetch from LinkedIn. |

Accepted `url` formats — all of these resolve to `williamhgates`:

```
https://www.linkedin.com/in/williamhgates/
https://in.linkedin.com/in/williamhgates
linkedin.com/in/williamhgates?originalSubdomain=in
https://www.linkedin.com/in/williamhgates/details/experience/
https://www.linkedin.com/in/%C3%A9lodie-martin        (percent-encoded names)
williamhgates                                          (bare slug)
```

```bash
curl -G http://localhost:4000/api/profile \
  --data-urlencode "url=https://www.linkedin.com/in/williamhgates" \
  -H "x-api-key: $API_KEY"
```

---

### `POST /api/profile`

Same thing with a JSON body.

```bash
curl -X POST http://localhost:4000/api/profile \
  -H "content-type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{ "url": "https://www.linkedin.com/in/williamhgates" }'
```

---

### Errors

Every failure uses the same envelope:

```json
{ "success": false, "error": { "code": "PROFILE_NOT_FOUND", "message": "…" } }
```

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Missing, malformed, or not a `/in/` profile URL. |
| 401 | `UNAUTHORIZED` | `API_KEY` is set and the request did not carry it. |
| 404 | `PROFILE_NOT_FOUND` | No such profile, or not visible to the logged-in account. |
| 404 | `ROUTE_NOT_FOUND` | No such endpoint. |
| 429 | `RATE_LIMITED` | You hit *this API's* per-IP limit. |
| 429 | `LINKEDIN_RATE_LIMITED` | *LinkedIn* is throttling the account. Back off. |
| 502 | `LINKEDIN_ERROR` | Cookie stale or incomplete, login wall, or a security challenge. |
| 503 | `NOT_CONFIGURED` | No cookie set and `MOCK_MODE` is off. |
| 500 | `INTERNAL_ERROR` | A bug. Details are hidden in production. |

## 7. Response schema

The schema was ours to design, so it aims for: flat, predictable, and honest
about missing data.

**Rules it follows throughout**

- A missing single value is `null` — never `undefined`, never an empty string.
- A missing list is `[]` — so `profile.skills.map(…)` is always safe.
- Dates are structured **and** pre-formatted, so you can compute with them
  (`{ month, year }`) or print them (`text`) without writing a formatter.
- Images come as a set of sizes plus `original`.

```jsonc
{
  "success": true,
  "meta": { "source": "linkedin", "cached": false, "fetchedAt": "…", "durationMs": 2186 },
  "data": {
    "publicIdentifier": "williamhgates",
    "profileUrl": "https://www.linkedin.com/in/williamhgates",

    "firstName": "Bill",
    "lastName": "Gates",
    "fullName": "Bill Gates",
    "headline": "Chair, Gates Foundation and Founder, Breakthrough Energy",
    "summary": "…the About section, newlines preserved…",

    "location": {
      "full": "Seattle, Washington, United States",
      "country": "United States",
      "countryCode": null,
      "postalCode": null
    },

    "followersCount": 40604081,
    "connectionsCount": null,

    "profilePicture": { "original": "https://media.licdn.com/…", "sizes": [ … ] },
    "backgroundPicture": { "original": "…", "sizes": [ … ] },

    "experience": [
      {
        "title": "Co-chair",
        "companyName": "Gates Foundation",
        "companyLinkedInUrl": "https://www.linkedin.com/company/gates-foundation",
        "companyLogo": { "original": "…", "sizes": [ … ] },
        "employmentType": "Full-time",
        "location": "Seattle, Washington",
        "description": "…",
        "dateRange": {
          "start": { "month": null, "year": 2000, "text": "2000" },
          "end": null,
          "isCurrent": true,
          "text": "2000 - Present · 26 yrs 8 mos",
          "durationMonths": 320
        }
      }
    ],

    "education":  [ { "schoolName": "…", "degreeName": "Master of Science",
                      "fieldOfStudy": "Computer Science", "grade": "…",
                      "schoolLogo": { … }, "dateRange": { … } } ],
    "skills":     [ { "name": "TypeScript", "endorsementCount": null } ],
    "certifications": [ { "name": "…", "authority": "…", "url": "…", "dateRange": { … } } ],
    "languages":  [ { "name": "English", "proficiency": "Native or bilingual proficiency" } ],
    "projects":   [ { "title": "…", "description": "…", "url": "…", "dateRange": { … } } ],
    "volunteerExperience": [ … ],
    "honors": [ … ], "courses": [ … ], "organizations": [ … ],
    "publications": [ … ], "patents": [ … ], "testScores": [ … ],

    "industry": null, "isStudent": null, "isPremium": null,
    "contactInfo": null
  }
}
```

The authoritative definition is
[`backend/src/types/profile.ts`](backend/src/types/profile.ts).

Two notes on honesty:

- `dateRange.text` reuses LinkedIn's own wording for the duration rather than
  recomputing it, so the API never disagrees with the site.
- Fields mwlite does not carry (`industry`, `countryCode`, `isPremium`,
  `endorsementCount`) are `null` rather than guessed at.

## 8. Project layout

```
backend/
  fixtures/profile.html        synthetic mwlite page (powers MOCK_MODE + tests)
  src/
    index.ts                   server bootstrap, graceful shutdown
    app.ts                     express app: helmet, cors, rate limit, routes
    config/env.ts              zod-validated environment, fails fast
    routes/
      health.ts                GET /api/health
      profile.ts               GET + POST /api/profile
    middleware/
      auth.ts                  optional x-api-key gate, constant-time compare
      errorHandler.ts          one error envelope for everything
    linkedin/
      url.ts                   profile URL -> public identifier
      client.ts                mwlite fetch: full cookie header + cookie jar
      parse.ts                 mwlite HTML -> our schema
      service.ts               orchestration: cache -> fetch -> parse
    types/profile.ts           the public response schema
    utils/                     logger, TTL cache, ApiError, sleep
    __tests__/                 unit + HTTP tests (node:test)

frontend/
  src/
    app/page.tsx               the search page
    app/api/lookup/route.ts    server-side proxy, keeps API_KEY off the client
    components/ProfileView.tsx renders the profile
    lib/types.ts               a copy of the response schema
```

Both apps were scaffolded with their official tools (`create-next-app` for the
frontend, `npm init` + `tsc --init` for the backend).

## 9. Deploying

### Backend on Render

[`render.yaml`](render.yaml) is a ready blueprint. It lives at the repository
root because that is the only place Render looks for one.

1. Push this repository to GitHub.
2. Render → **New** → **Blueprint** → pick the repo.
3. When prompted, fill in `LINKEDIN_COOKIE` and `API_KEY`. They are marked
   `sync: false`, so they live in Render's dashboard, never in git.
4. Deploy. Health check: `GET /api/health`.

### Anywhere else (Railway, Fly.io, Cloud Run, a VPS)

There is a [`backend/Dockerfile`](backend/Dockerfile) — multi-stage, non-root,
production dependencies only.

```bash
cd backend
docker build -t linkedin-profile-api .
docker run -p 4000:4000 --env-file .env linkedin-profile-api
```

### Frontend on Vercel

Import the repo, set **Root Directory** to `frontend`, and add:

```
API_BASE_URL=https://your-api.onrender.com
API_KEY=<the same key the backend uses>
```

Then set the backend's `CORS_ORIGINS` to your Vercel domain to close it off.

## 10. Testing

```bash
cd backend
npm test        # 33 tests: URL parsing, HTML parsing, and the HTTP API
npm run typecheck
```

The tests run entirely offline. They cover:

- **URL parsing** — every accepted URL shape, and the ones that must be
  rejected (company URLs, non-LinkedIn hosts, percent-encoded path traversal).
- **HTML parsing** — against the synthetic fixture: CSS-drawn separators,
  lazily-loaded images, the grey placeholder avatar, location vs. follower
  counts sharing an element, current vs. past roles, and a page with no
  profile content at all.
- **The HTTP layer** — a real server on a random port, checking status codes,
  the API-key gate, GET and POST, and the error envelope.

Verified against live LinkedIn on several real profiles during development.

## 11. Security notes

Deliberate choices, since the API holds a live LinkedIn session:

- **The cookie only ever comes from the environment.** It is never logged
  (pino redacts `cookie` and `x-api-key`), never returned in a response, and
  never written to disk by this code.
- **The input is validated before it is used.** Only `linkedin.com` hosts and
  `/in/` paths are accepted; the extracted slug is rejected if it decodes to
  path syntax, and re-encoded before it reaches LinkedIn.
- **API keys are compared in constant time.**
- **Upstream error details are not echoed to clients in production.**
- **Rate limits exist on both hops** — the API limits per IP, and the frontend
  proxy limits per visitor, since behind the proxy the API would otherwise see
  every browser user as one IP.
- **`capture*.txt` and `*.har` are git-ignored**, because a copied cURL command
  or a HAR export carries the whole cookie header.

### Should the hosted API require a key?

Both work — it is `API_KEY` set or empty:

- **Left open** (with the rate limit) anyone reviewing the project can `curl`
  the live URL immediately.
- **Key required** is right for anything longer-lived, since every request
  spends the LinkedIn account's quota.

If you leave it open, keep `RATE_LIMIT_MAX` low and treat the deployment as
temporary.

## 12. Known limitations

**Access**

- **It only sees what your account sees.** Out-of-network profiles may come
  back sparse; a profile visible to a 1st-degree connection may be invisible to
  a fresh account.
- **Cookies expire and rotate.** There is no automatic refresh, because logging
  in programmatically is exactly what trips LinkedIn's bot detection. When the
  cookie dies, the API says so plainly.
- **One account, one throughput.** A few hundred profile views a day is the
  realistic ceiling before throttling or a captcha challenge. Scaling past that
  means a pool of accounts and residential proxies — deliberately out of scope.
- **Datacentre IPs are more suspicious than home ones.** A cookie that works
  from a laptop may be challenged from a cloud host on first use.

**Data**

- **mwlite carries less than the desktop site.** `industry`, `countryCode`,
  `isPremium` and skill `endorsementCount` are not on the page, so they are
  always `null`. Filling them in would mean parsing the desktop RSC payload.
- **Contact info is not fetched.** On mwlite it sits behind an interaction, and
  it is the most sensitive part of a profile — so it is left out rather than
  half-supported.
- **Recommendations, posts and activity** are not fetched.
- **Company details are shallow** — name, logo and URL, not size or industry.
- **Image URLs are signed and expire** (weeks, not forever). Download them if
  you need them long-term.
- **The profile photo costs a second request** to the public page, and is
  missing for profiles that are not publicly visible.

**Engineering**

- **The cache is in-process.** Two instances do not share it. Redis would be
  the swap, and `TtlCache` is small enough to replace in one file.
- **HTML can change.** The parser targets semantic containers and LinkedIn's
  own tracking attributes rather than styling classes, and every field degrades
  to `null` instead of throwing — but a redesign of mwlite would need work.
  That is the honest trade for an approach with no expiring query hashes.
- **`MOCK_MODE` data is synthetic**, so it proves the pipeline, not that every
  real-world quirk is handled.

## 13. Legal and ethical note

This was built for a hiring exercise. Two things worth stating plainly:

- **Scraping LinkedIn with your own session violates LinkedIn's User
  Agreement**, regardless of the data's public status under law. The realistic
  consequence is a restricted or banned account — use a throwaway, not your
  main one.
- **Profile data is personal data.** In the EU/UK, GDPR applies whether or not
  it was public. Anything beyond a demo needs a lawful basis, a retention
  policy, and a way to honour deletion requests.

For production use, the honest answer is LinkedIn's official partner APIs or a
licensed vendor. This project exists to show that the mechanism is understood.
