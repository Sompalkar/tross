# Fixtures

`profile-view.json` is a hand-written stand-in for the body LinkedIn returns from
`GET /voyager/api/identity/profiles/{publicId}/profileView`. It has the same
shape and key names as the real response, but the person, employers and image
URLs are invented — no real profile data is committed to this repository.

It powers two things:

- `MOCK_MODE=true`, so the API (and the frontend) can be demoed with no LinkedIn session.
- the unit tests, which assert the normaliser turns this shape into our schema.
