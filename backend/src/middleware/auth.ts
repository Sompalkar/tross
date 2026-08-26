import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/errors.js";

/**
 * Compares in constant time, so the number of matching leading characters
 * cannot be inferred from how long the check took.
 */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, so hash-free padding is not an
  // option; comparing lengths first only reveals the length, not the value.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Optional API-key gate. If API_KEY is unset the API is open, which is handy
 * locally; set it in production so the deployed instance is not free for all.
 */
export function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  if (!env.API_KEY) return next();

  const provided =
    (req.header("x-api-key") ?? "").trim() ||
    (req.header("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (!safeEqual(provided, env.API_KEY)) return next(ApiError.unauthorized());
  next();
}
