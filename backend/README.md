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

- [`src/linkedin/client.ts`](src/linkedin/client.ts) — fetches the mwlite page:
  the full cookie header and the jar that survives LinkedIn's token rotation.
- [`src/linkedin/parse.ts`](src/linkedin/parse.ts) — mwlite HTML turned into our
  schema.
- [`src/types/profile.ts`](src/types/profile.ts) — the response schema.

Never commit `.env`. See
[Getting your LinkedIn cookie](../README.md#5-getting-your-linkedin-cookie).
