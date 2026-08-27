import { Router } from "express";
import { corsOrigins, env, hasLinkedInCredentials } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    mode: env.MOCK_MODE ? "mock" : "live",
    linkedInCredentialsConfigured: hasLinkedInCredentials,
    version: process.env["npm_package_version"] ?? "1.0.0",

    // Enough configuration to tell, from outside, whether a deployment picked
    // up its environment. Nothing here is sensitive, and its absence is what
    // made a misconfigured deploy hard to spot.
    config: {
      environment: env.NODE_ENV,
      rateLimitPerMinute: env.RATE_LIMIT_MAX,
      corsOrigins: corsOrigins === true ? "*" : corsOrigins,
    },
  });
});
