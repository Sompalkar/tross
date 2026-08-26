import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    // Never let a cookie or api key reach the logs.
    paths: [
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "config.headers.cookie",
      "headers.cookie",
    ],
    remove: true,
  },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
