# Fixtures

`profile.html` is a hand-written stand-in for a LinkedIn mwlite profile page.
It copies the real page's structure — the same container classes, the same
lazily-loaded `data-delayed-url` images, the same CSS-drawn `·` separators —
but the person, the employers and the image URLs are invented. No real profile
data is committed to this repository.

It powers two things:

- `MOCK_MODE=true`, so the API and the frontend can be demoed with no LinkedIn session.
- the parser tests, which assert this markup turns into our schema.
