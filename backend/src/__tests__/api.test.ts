import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

// Configure the app before anything reads the environment.
process.env["MOCK_MODE"] = "true";
process.env["NODE_ENV"] = "test";
process.env["LOG_LEVEL"] = "silent";
process.env["REQUEST_DELAY_MS"] = "0";
process.env["CACHE_TTL_SECONDS"] = "0";
process.env["API_KEY"] = "test-secret-key";

const { createApp } = await import("../app.js");

let server: Server;
let baseUrl: string;

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => server.close());

const headers = { "x-api-key": "test-secret-key" };

describe("the HTTP API", () => {
  it("reports health without an API key", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(body["status"], "ok");
    assert.equal(body["mode"], "mock");
  });

  it("rejects a request with no API key", async () => {
    const response = await fetch(
      `${baseUrl}/api/profile?url=https://www.linkedin.com/in/ada-lovelace`,
    );
    assert.equal(response.status, 401);
  });

  it("returns a normalised profile", async () => {
    const response = await fetch(
      `${baseUrl}/api/profile?url=https://www.linkedin.com/in/ada-lovelace`,
      { headers },
    );
    const body = (await response.json()) as any;
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.meta.source, "mock");
    assert.equal(body.data.fullName, "Ada Lovelace");
    assert.ok(body.data.experience.length > 0);
  });

  it("accepts the same request as POST", async () => {
    const response = await fetch(`${baseUrl}/api/profile`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ url: "https://www.linkedin.com/in/ada-lovelace" }),
    });
    const body = (await response.json()) as any;
    assert.equal(response.status, 200);
    assert.equal(body.data.publicIdentifier, "ada-lovelace");
  });

  it("explains a bad URL instead of crashing", async () => {
    const response = await fetch(`${baseUrl}/api/profile?url=https://example.com/in/x`, {
      headers,
    });
    const body = (await response.json()) as any;
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.error.code, "BAD_REQUEST");
  });

  it("404s an unknown route", async () => {
    const response = await fetch(`${baseUrl}/api/nope`, { headers });
    assert.equal(response.status, 404);
  });
});
