import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
  });
}

/** Every error leaves the API in the same envelope. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError(
          500,
          "INTERNAL_ERROR",
          env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : "Something went wrong.",
        );

  if (apiError.status >= 500) logger.error({ err: error }, "request failed");
  else logger.warn({ code: apiError.code, msg: apiError.message }, "request rejected");

  // `details` can carry a slice of LinkedIn's own error body (a challenge page,
  // an internal payload), so it is logged rather than returned.
  //
  // The check is "is development" rather than "is not production" on purpose.
  // A host that never sets NODE_ENV should get the safe behaviour, not the
  // leaky one — and that is not hypothetical: this API was deployed with
  // NODE_ENV unset, which under the old check would have exposed them.
  const exposeDetails = Boolean(apiError.details) && env.NODE_ENV === "development";
  if (apiError.details && !exposeDetails) {
    logger.warn({ code: apiError.code, details: apiError.details }, "upstream detail");
  }

  res.status(apiError.status).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(exposeDetails ? { details: apiError.details } : {}),
    },
  });
}
