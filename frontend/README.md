# Frontend — LinkedIn Profile API

Next.js (App Router) + Tailwind CSS. A single page: paste a LinkedIn profile
URL, see the parsed profile and the raw JSON.

```bash
npm install
cp .env.example .env.local   # point API_BASE_URL at the backend
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `API_BASE_URL` | Where the backend lives, e.g. `http://localhost:4000` |
| `API_KEY` | Only needed if the backend sets `API_KEY` |

The browser never calls the backend directly. It posts to
[`/api/lookup`](src/app/api/lookup/route.ts), a route handler that forwards the
request server-side — so `API_KEY` stays out of the client bundle.

Deploy on Vercel with **Root Directory** set to `frontend`.
