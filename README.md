# LinkedIn Profile API

Give it a LinkedIn profile URL, get structured JSON back.

```
POST /api/profile  { "url": "https://www.linkedin.com/in/williamhgates" }
```

```jsonc
{
  "success": true,
  "meta": { "source": "linkedin", "cached": false, "fetchedAt": "…", "durationMs": 1840 },
  "data": {
    "fullName": "…",
    "headline": "…",
    "location": { "full": "…", "country": "…" },
    "summary": "…",
    "experience": [ … ],
    "education": [ … ],
    "skills": [ … ],
    "certifications": [ … ],
    "languages": [ … ],
    "profilePicture": { "original": "https://media.licdn.com/…", "sizes": [ … ] }
  }
}
```

- **`backend/`** — the API. Node.js + TypeScript + Express.
- **`frontend/`** — a small Next.js + Tailwind page to try it in a browser.

---

## Table of contents

1. [What this is, in plain English](#1-what-this-is-in-plain-english)
2. [How it works](#2-how-it-works)
3. [Quick start](#3-quick-start)
4. [Getting your LinkedIn cookies](#4-getting-your-linkedin-cookies)
5. [API documentation](#5-api-documentation)
6. [Response schema](#6-response-schema)
7. [Project layout](#7-project-layout)
8. [Deploying](#8-deploying)
9. [Testing](#9-testing)
10. [Security notes](#10-security-notes)
11. [Known limitations](#11-known-limitations)
12. [Legal and ethical note](#12-legal-and-ethical-note)

---

## 1. What this is, in plain English

LinkedIn has an official API, but it will not let you read arbitrary people's
profiles. So the task is to get the same data the *website* shows you, and serve
it as clean JSON.

The naive approach is to download the profile page's HTML and pick text out of
it. That works badly: LinkedIn's HTML is machine-generated, the class names
change constantly, and a logged-out request gets a login wall instead of a page.

There is a much better way, and it is what this project does.

**linkedin.com is a single-page app.** When you open a profile, the page arrives
almost empty and then the browser fetches the actual data as JSON from a private
API that LinkedIn runs for its own frontend. That API lives under
`https://www.linkedin.com/voyager/api/…`, and it is called **Voyager**.

If we send the same request the browser sends, LinkedIn sends us the same JSON.
No HTML parsing, no guessing — just the real data, already structured.

So the whole project is three steps:

1. **Read the slug from the URL.** `https://www.linkedin.com/in/ada-lovelace/` → `ada-lovelace`.
2. **Ask Voyager for that profile**, pretending to be a logged-in browser.
3. **Clean up the answer.** LinkedIn's internal JSON is verbose and oddly shaped,
   so we convert it into a tidy schema of our own before returning it.

## 2. How it works

### 2.1 Finding the endpoint

Open a profile in Chrome with DevTools → Network → Fetch/XHR. Among the requests
you will see calls to `www.linkedin.com/voyager/api/…`. The useful one is:

```
GET https://www.linkedin.com/voyager/api/identity/profiles/{publicId}/profileView
```

One request returns nearly the whole profile: basics, positions, education,
skills, certifications, languages, projects, publications, volunteering, honours,
courses, organisations, patents and test scores — each under its own `…View` key.

This project also uses three smaller endpoints:

| Endpoint | Gives us | Required? |
| --- | --- | --- |
| `/identity/profiles/{id}/profileView` | everything above | yes |
| `/identity/profiles/{id}/skills?count=100` | the *full* skills list (`skillView` is truncated) | optional |
| `/identity/profiles/{id}/networkinfo` | connection and follower counts | optional |
| `/identity/profiles/{id}/profileContactInfo` | email, phone, websites, Twitter | optional, opt-in |

Optional calls are allowed to fail. If LinkedIn returns an error for one of
them, you still get the profile — just without that piece.

### 2.2 Getting past the door

Voyager will not talk to an anonymous client. Copying the browser means sending
three things, and **all three** are needed:

| Header | Value | Why |
| --- | --- | --- |
| `cookie` | `li_at=<session>; JSESSIONID="ajax:123…";` | `li_at` *is* your logged-in session |
| `csrf-token` | the `JSESSIONID` value, **without the quotes** | LinkedIn's CSRF check compares the two |
| `x-restli-protocol-version` | `2.0.0` | Voyager speaks Rest.li; without this it 4xx's |

Miss any one and you get `401`/`403` instead of data. This is the single most
common reason a LinkedIn scraper "mysteriously stops working".

The implementation is in [`backend/src/linkedin/client.ts`](backend/src/linkedin/client.ts).

### 2.3 Cleaning up the answer

LinkedIn's raw JSON is not something you want to hand to a client:

- Dates are `{ "timePeriod": { "startDate": { "month": 3, "year": 2021 } } }`, with
  a **missing** `endDate` being the only sign that a job is current.
- Images are never a URL. You get a signed `rootUrl` plus a list of "artifacts",
  one per rendered size, and you build each URL by gluing the two halves together.
- Enums arrive as `NATIVE_OR_BILINGUAL`.
- Sections are `{ "elements": [ … ] }` — except when they are absent entirely.

[`backend/src/linkedin/normalize.ts`](backend/src/linkedin/normalize.ts) turns all
of that into the flat, predictable schema in [section 6](#6-response-schema).
Every field is null-safe: a profile with no education returns `"education": []`,
never a crash.

### 2.4 Being a good citizen

Hammering LinkedIn from one account is the fastest way to get it restricted, so
the API has brakes built in:

- **A pause before every LinkedIn call** (`REQUEST_DELAY_MS`, default 1.2 s).
- **An in-memory cache** (`CACHE_TTL_SECONDS`, default 15 min) so asking for the
  same profile twice only costs one real request.
- **A per-IP rate limit** on the public endpoint (default 20 requests/minute).
- **Honest error mapping**: a `429` from LinkedIn becomes a `429` from us with an
  explanation, rather than a generic `500`.

## 3. Quick start

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

To hit the real LinkedIn, put your cookies in `.env` (see
[section 4](#4-getting-your-linkedin-cookies)) and set `MOCK_MODE=false`.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>, paste a profile URL, and you get a rendered profile
plus the raw JSON.

The browser never calls the API directly — it posts to `/api/lookup`, a small
Next.js route handler that forwards the request server-side. That keeps `API_KEY`
out of the JavaScript bundle.

## 4. Getting your LinkedIn cookies

The backend authenticates as *you*, using two cookies from a browser where you
are already signed in. Nothing is typed into a login form by this code, and no
password is ever stored.

1. Sign in to <https://www.linkedin.com> in Chrome.
2. Open DevTools (<kbd>F12</kbd>) → **Application** → **Storage** → **Cookies** →
   `https://www.linkedin.com`.
3. Copy the **Value** of `li_at` → `LINKEDIN_LI_AT`.
4. Copy the **Value** of `JSESSIONID` → `LINKEDIN_JSESSIONID`.
   It looks like `"ajax:1234567890123456789"`. Paste it with or without the
   quotes; the code strips them.
5. Put both in `backend/.env` and set `MOCK_MODE=false`.

```dotenv
LINKEDIN_LI_AT=AQEDAS...long-string...
LINKEDIN_JSESSIONID="ajax:1234567890123456789"
MOCK_MODE=false
```

> **Treat `li_at` like a password.** Anyone holding it is logged in as you.
> It is why `.env` is git-ignored and why the deploy config marks these as
> dashboard-only secrets. Logging out of LinkedIn everywhere invalidates it.

The cookie expires (roughly a year, sooner if you log out). When it does, the API
returns a clear `502` telling you to refresh it, rather than failing silently.

### Environment variables

| Variable | Default | What it does |
| --- | --- | --- |
| `LINKEDIN_LI_AT` | — | Your LinkedIn session cookie. Required unless `MOCK_MODE=true`. |
| `LINKEDIN_JSESSIONID` | — | The CSRF cookie. Required unless `MOCK_MODE=true`. |
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

## 5. API documentation

Base URL (local): `http://localhost:4000`

Authentication: if `API_KEY` is set, send it as `x-api-key: <key>` or
`Authorization: Bearer <key>`. Otherwise no auth is needed.

---

### `GET /api/health`

Liveness check. Never requires an API key.

```bash
curl http://localhost:4000/api/health
```

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
| `url` | string | **required** | A LinkedIn profile URL, or just the slug. |
| `refresh` | `true`/`false` | `false` | Skip the cache and re-fetch from LinkedIn. |
| `contactInfo` | `true`/`false` | `false` | Also fetch contact info (one extra LinkedIn call). |

Accepted `url` formats — all of these resolve to `ada-lovelace`:

```
https://www.linkedin.com/in/ada-lovelace/
https://in.linkedin.com/in/ada-lovelace
linkedin.com/in/ada-lovelace?originalSubdomain=in
https://www.linkedin.com/in/ada-lovelace/details/experience/
https://www.linkedin.com/in/%C3%A9lodie-martin        (percent-encoded names)
ada-lovelace                                           (bare slug)
```

```bash
curl -G http://localhost:4000/api/profile \
  --data-urlencode "url=https://www.linkedin.com/in/ada-lovelace" \
  -H "x-api-key: $API_KEY"
```

---

### `POST /api/profile`

Same thing with a JSON body, for clients that prefer it.

```bash
curl -X POST http://localhost:4000/api/profile \
  -H "content-type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{ "url": "https://www.linkedin.com/in/ada-lovelace", "contactInfo": true }'
```

---

### Errors

Every failure uses the same envelope:

```json
{
  "success": false,
  "error": { "code": "PROFILE_NOT_FOUND", "message": "…" }
}
```

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | The URL was missing, malformed, or not a `/in/` profile URL. |
| 401 | `UNAUTHORIZED` | `API_KEY` is set and the request did not carry it. |
| 404 | `PROFILE_NOT_FOUND` | No such profile, or it is not visible to the logged-in account. |
| 404 | `ROUTE_NOT_FOUND` | No such endpoint. |
| 429 | `RATE_LIMITED` | You hit *this API's* per-IP limit. |
| 429 | `LINKEDIN_RATE_LIMITED` | *LinkedIn* is throttling the account. Back off. |
| 502 | `LINKEDIN_ERROR` | Session expired, account challenged, or LinkedIn misbehaved. |
| 503 | `NOT_CONFIGURED` | No cookies set and `MOCK_MODE` is off. |
| 500 | `INTERNAL_ERROR` | A bug. Details are hidden in production. |

## 6. Response schema

The schema was ours to design, so it aims for: flat, predictable, and honest
about missing data.

**Rules it follows throughout**

- A missing single value is `null` — never `undefined`, never an empty string.
- A missing list is `[]` — so `profile.skills.map(…)` is always safe.
- Dates are structured **and** pre-formatted, so you can compute with them
  (`{ month, year }`) or print them (`text`) without writing a formatter.
- Images come as a set of sizes plus `original`, because LinkedIn returns
  several and different callers want different ones.

```jsonc
{
  "success": true,
  "meta": {
    "source": "linkedin",        // or "mock"
    "cached": false,
    "fetchedAt": "2026-08-27T10:15:00.000Z",
    "durationMs": 1840
  },
  "data": {
    "publicIdentifier": "ada-lovelace",
    "profileId": "ACoAAA8BYqE…",
    "profileUrl": "https://www.linkedin.com/in/ada-lovelace",

    "firstName": "Ada",
    "lastName": "Lovelace",
    "fullName": "Ada Lovelace",
    "headline": "Principal Engineer at Analytical Engines",
    "summary": "…the About section, newlines preserved…",

    "location": {
      "full": "London, England, United Kingdom",
      "country": "United Kingdom",
      "countryCode": "GB",
      "postalCode": "EC1A"
    },

    "industry": "Software Development",
    "isStudent": false,
    "isPremium": null,
    "isInfluencer": null,
    "isOpenToWork": null,
    "isHiring": null,

    "profilePicture": {
      "original": "https://media.licdn.com/…800_800…",
      "sizes": [ { "url": "…100_100…", "width": 100, "height": 100 } ]
    },
    "backgroundPicture": { "original": "…", "sizes": [ … ] },

    "connectionsCount": 500,
    "followersCount": 12043,

    "experience": [
      {
        "title": "Principal Engineer",
        "companyName": "Analytical Engines",
        "companyUrn": "1441",
        "companyLinkedInUrl": "https://www.linkedin.com/company/analytical-engines",
        "companyLogo": { "original": "…", "sizes": [ … ] },
        "employmentType": null,
        "location": "London, United Kingdom",
        "description": "…",
        "dateRange": {
          "start": { "month": 3, "year": 2021, "text": "Mar 2021" },
          "end": null,
          "isCurrent": true,
          "text": "Mar 2021 - Present · 5 yrs 6 mos",
          "durationMonths": 66
        }
      }
    ],

    "education":  [ { "schoolName": "…", "degreeName": "MSc", "fieldOfStudy": "…",
                      "grade": "…", "activities": "…", "description": null,
                      "schoolLogo": { … }, "dateRange": { … } } ],
    "skills":     [ { "name": "TypeScript", "endorsementCount": null } ],
    "certifications": [ { "name": "…", "authority": "…", "licenseNumber": "…",
                          "url": "…", "dateRange": { … } } ],
    "languages":  [ { "name": "English", "proficiency": "Native or bilingual" } ],
    "projects":   [ { "title": "…", "description": "…", "url": "…",
                      "members": ["…"], "dateRange": { … } } ],
    "publications":[ { "name": "…", "publisher": "…", "url": "…",
                       "date": { … }, "authors": ["…"] } ],
    "volunteerExperience": [ { "role": "…", "companyName": "…", "cause": "…",
                               "description": "…", "dateRange": { … } } ],
    "honors":     [ { "title": "…", "issuer": "…", "date": { … } } ],
    "courses":    [ { "name": "…", "number": "…" } ],
    "organizations": [ { "name": "…", "position": "…", "dateRange": { … } } ],
    "patents":    [ … ],
    "testScores": [ … ],

    "contactInfo": null   // populated only when ?contactInfo=true
  }
}
```

The authoritative definition is [`backend/src/types/profile.ts`](backend/src/types/profile.ts).

A note on `dateRange.text`: the duration is only appended when LinkedIn gave a
month, not just a year. `"2013 - 2015"` stays as-is rather than claiming
`"3 yrs"`, because that precision would be invented.

## 7. Project layout

```
backend/
  fixtures/profile-view.json   sample LinkedIn response (powers MOCK_MODE + tests)
  src/
    index.ts                   server bootstrap, graceful shutdown
    app.ts                     express app: helmet, cors, rate limit, routes
    config/env.ts              zod-validated environment, fails fast
    routes/
      health.ts                GET /api/health
      profile.ts               GET + POST /api/profile
    middleware/
      auth.ts                  optional x-api-key gate
      errorHandler.ts          one error envelope for everything
    linkedin/
      url.ts                   profile URL -> public identifier
      client.ts                the Voyager HTTP client (cookies, CSRF, Rest.li)
      service.ts               orchestration: cache -> fetch -> normalise
      normalize.ts             LinkedIn's shapes -> our schema
    types/profile.ts           the public response schema
    utils/                     logger, TTL cache, ApiError, sleep
    __tests__/                 unit + HTTP tests (node:test)

frontend/
  src/
    app/page.tsx               the search page
    app/api/lookup/route.ts    server-side proxy, keeps API_KEY off the client
    components/ProfileView.tsx renders the profile
    components/ui.tsx          small shared pieces
    lib/types.ts               a copy of the response schema
```

Both apps were scaffolded with their official tools (`create-next-app` for the
frontend, `npm init` + `tsc --init` for the backend).

## 8. Deploying

The requirement is **public HTTPS**, which every option below gives you for free.

### Backend on Render

[`backend/render.yaml`](backend/render.yaml) is a ready blueprint.

1. Push this repository to GitHub.
2. Render → **New** → **Blueprint** → pick the repo.
3. When prompted, fill in `LINKEDIN_LI_AT`, `LINKEDIN_JSESSIONID` and `API_KEY`.
   They are marked `sync: false`, so they live in Render's dashboard, never in git.
4. Deploy. Health check: `GET /api/health`.

### Backend anywhere else (Railway, Fly.io, Cloud Run, a VPS)

There is a [`backend/Dockerfile`](backend/Dockerfile) — multi-stage, non-root,
production dependencies only.

```bash
cd backend
docker build -t linkedin-profile-api .
docker run -p 4000:4000 --env-file .env linkedin-profile-api
```

Or plain Node:

```bash
npm ci && npm run build && npm start
```

### Frontend on Vercel

Import the repo, set **Root Directory** to `frontend`, and add two environment
variables:

```
API_BASE_URL=https://your-api.onrender.com
API_KEY=<the same key the backend uses>
```

Then set the backend's `CORS_ORIGINS` to your Vercel domain to close it off.

## 9. Testing

```bash
cd backend
npm test        # 30 tests: URL parsing, normalisation, and the HTTP API
npm run typecheck
```

The tests run entirely offline. They cover:

- **URL parsing** — every accepted URL shape, and the ones that must be rejected
  (company URLs, non-LinkedIn hosts, junk, percent-encoded path traversal).
- **Normalisation** — against the saved fixture: image URL assembly, current vs.
  past roles, duration maths, enum humanising, and a near-empty profile that must
  not crash.
- **The HTTP layer** — a real server on a random port, checking status codes, the
  API-key gate, GET and POST, and the error envelope.

The frontend is checked with `npm run build` and `npm run lint`.

## 10. Security notes

Deliberate choices, since the API holds a live LinkedIn session:

- **The session cookie only ever comes from the environment.** It is never
  logged (pino redacts `cookie` and `x-api-key`), never returned in a response,
  and never written to disk by this code.
- **The input is validated before it is used.** Only `linkedin.com` hosts and
  `/in/` paths are accepted; the extracted slug is rejected if it decodes to
  path syntax, and re-encoded before it reaches LinkedIn. There is no way to
  steer the outbound request at a different host or path.
- **API keys are compared in constant time**, so the comparison cannot be
  probed character by character.
- **Upstream error bodies are not echoed to clients in production.** They can
  contain a LinkedIn challenge page or internal payload, so they are logged
  server-side instead.
- **Rate limits exist on both hops.** The API limits per IP, and the frontend
  proxy limits per visitor — without that second limit, every browser user
  would share the proxy's single IP at the API and one abuser could lock
  everyone out.
- **`helmet` sets the usual security headers**, and CORS defaults to `*` for
  convenience; set `CORS_ORIGINS` to your frontend domain in production.

### Should the hosted API require a key?

Both work — it is `API_KEY` set or empty:

- **Left open** (with the rate limit) anyone reviewing the project can `curl`
  the live URL immediately. Simplest for a reviewer, and what this README's
  examples assume.
- **Key required** is the right call for anything longer-lived, because every
  request spends the LinkedIn account's quota.

If you leave it open, keep `RATE_LIMIT_MAX` low and treat the deployment as
temporary.

## 11. Known limitations

Being straight about what this does and does not do:

**Access**

- **It only sees what your account sees.** Out-of-network profiles may come back
  as "LinkedIn Member" with most fields empty. A profile visible to a 1st-degree
  connection may be invisible to a fresh account.
- **Cookies expire.** `li_at` lasts about a year, less if you log out. When it
  dies every request returns `502 LINKEDIN_ERROR` until you paste a new one.
  There is no automatic refresh, because logging in programmatically is exactly
  what trips LinkedIn's bot detection.
- **One account, one throughput.** Roughly a few hundred profile views a day is
  the realistic ceiling before LinkedIn starts throttling or showing a captcha
  challenge. Scaling past that means a pool of accounts and residential proxies —
  deliberately out of scope here.
- **Datacentre IPs are more suspicious than home ones.** A cookie that works from
  your laptop may get challenged from a cloud host on first use.

**Data**

- **Endorsement counts** are not in `profileView`; `skills[].endorsementCount` is
  usually `null`. Filling it in needs a per-skill call, which is not worth the
  request budget.
- **Recommendations, posts, activity and "people also viewed"** are not fetched.
  Each is a separate Voyager endpoint; the schema has no place for them yet.
- **Contact info is opt-in** (`?contactInfo=true`) and mostly returns what the
  person chose to make visible — often just websites, rarely an email.
- **Company details are shallow** — name, logo and URL, not size or industry.
- **Image URLs are signed and expire** (weeks, not forever). Download them if you
  need them long-term; do not store the URL and expect it to work later.

**Engineering**

- **The cache is in-process.** Two instances do not share it. Redis would be the
  swap, and `TtlCache` is small enough to replace in one file.
- **Voyager is unversioned and private.** LinkedIn can change a field name any
  day. The parser is written defensively — a renamed field becomes `null`, not a
  crash — but a *renamed endpoint* would need a code change.
- **`MOCK_MODE` data is invented**, not a captured real response, so it cannot
  prove the parser handles every real-world quirk. It is a pipeline test, not a
  guarantee.

## 12. Legal and ethical note

This was built for a hiring exercise. Two things worth stating plainly:

- **Scraping LinkedIn with your own session violates LinkedIn's User Agreement**,
  regardless of what the data's public status is under law. The realistic
  consequence is a restricted or banned account — use a throwaway, not your main
  one.
- **Profile data is personal data.** In the EU/UK, GDPR applies to it whether or
  not it was public. Anything beyond a demo should have a lawful basis, a
  retention policy, and a way to honour deletion requests.

For production use, the honest answer is LinkedIn's official partner APIs or a
licensed vendor. This project exists to show that the mechanism is understood.
