# Frontend — LinkedIn Profile API

Next.js (App Router) + Tailwind CSS. A single page: paste a LinkedIn profile
URL, see the parsed profile and the raw JSON.

```bash
npm install
cp .env.example .env.local   # point NEXT_PUBLIC_API_BASE_URL at the backend
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Where the backend lives, e.g. `http://localhost:4000` |

This app has **no server-side code of its own** — it builds to static pages and
calls the Express API directly. The API is the only backend.

`NEXT_PUBLIC_` puts the value in the browser bundle, which is right for a public
API URL. Never use it for the LinkedIn cookie or an API key.

Deploy on Vercel with **Root Directory** set to `frontend`.
