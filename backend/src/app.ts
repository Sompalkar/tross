import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { corsOrigins, env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { healthRouter } from "./routes/health.js";
import { profileRouter } from "./routes/profile.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1); // correct client IPs behind Render/Railway/Fly
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "64kb" }));
  app.use(pinoHttp({ logger }));

  app.use(
    "/api",
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please slow down.",
        },
      },
    }),
  );

  app.get("/", (_req, res) => {
    res.json({
      name: "LinkedIn Profile API",
      endpoints: {
        health: "GET /api/health",
        profile: "GET /api/profile?url=<linkedin profile url>",
      },
    });
  });

  app.use("/api", healthRouter);
  app.use("/api", profileRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
