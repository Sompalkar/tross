import { Router } from "express";
import { env, hasLinkedInCredentials } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    mode: env.MOCK_MODE ? "mock" : "live",
    linkedInCredentialsConfigured: hasLinkedInCredentials,
    version: process.env["npm_package_version"] ?? "1.0.0",
  });
});
