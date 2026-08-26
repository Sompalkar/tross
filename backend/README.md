# Backend — LinkedIn Profile API

Node.js + TypeScript + Express. Full documentation lives in the
[root README](../README.md); this is the short version.

```bash
npm install
cp .env.example .env     # ships with MOCK_MODE=true, works with no credentials
npm run dev
curl "http://localhost:4000/api/profile?url=https://www.linkedin.com/in/ada-lovelace"
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Watch mode via tsx |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Unit + HTTP tests, no network needed |
| `npm run typecheck` | `tsc --noEmit` |

Where to look:

- [`src/linkedin/client.ts`](src/linkedin/client.ts) — the Voyager client, and
  the three headers that make LinkedIn answer.
- [`src/linkedin/normalize.ts`](src/linkedin/normalize.ts) — LinkedIn's raw JSON
  turned into our schema.
- [`src/types/profile.ts`](src/types/profile.ts) — the response schema.

Never commit `.env`. See
[Getting your LinkedIn cookies](../README.md#4-getting-your-linkedin-cookies).
