import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractPublicIdentifier } from "../linkedin/url.js";
import { ApiError } from "../utils/errors.js";

describe("extractPublicIdentifier", () => {
  const accepted: [string, string][] = [
    ["https://www.linkedin.com/in/ada-lovelace/", "ada-lovelace"],
    ["https://www.linkedin.com/in/ada-lovelace", "ada-lovelace"],
    ["http://linkedin.com/in/ada-lovelace", "ada-lovelace"],
    ["www.linkedin.com/in/ada-lovelace", "ada-lovelace"],
    ["linkedin.com/in/ada-lovelace?originalSubdomain=in", "ada-lovelace"],
    ["https://in.linkedin.com/in/ada-lovelace", "ada-lovelace"],
    ["https://www.linkedin.com/in/ada-lovelace/details/experience/", "ada-lovelace"],
    ["https://www.linkedin.com/in/%C3%A9lodie-martin", "élodie-martin"],
    ["  https://www.linkedin.com/in/ada-lovelace/  ", "ada-lovelace"],
    ["ada-lovelace", "ada-lovelace"],
  ];

  for (const [input, expected] of accepted) {
    it(`accepts ${input.trim()}`, () => {
      assert.equal(extractPublicIdentifier(input), expected);
    });
  }

  const rejected = [
    "",
    "https://example.com/in/ada-lovelace",
    "https://www.linkedin.com/company/analytical-engines",
    "https://www.linkedin.com/feed/",
    "not a url at all!!",
    // Percent-encoded path syntax must never survive decoding into the slug.
    "https://www.linkedin.com/in/..%2F..%2Fadmin",
    "https://www.linkedin.com/in/%2Fetc%2Fpasswd",
  ];

  for (const input of rejected) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      assert.throws(() => extractPublicIdentifier(input), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 400);
        return true;
      });
    });
  }
});
