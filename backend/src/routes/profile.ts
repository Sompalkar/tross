import { Router } from "express";
import { z } from "zod";
import { getProfile } from "../linkedin/service.js";
import { requireApiKey } from "../middleware/auth.js";
import { ApiError } from "../utils/errors.js";

export const profileRouter = Router();

/**
 * `z.coerce.boolean()` would turn the string "false" into `true`, so flags get
 * their own parser that understands both real booleans and query strings.
 */
const flag = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) =>
    typeof value === "boolean" ? value : value === "true" || value === "1",
  );

const querySchema = z.object({
  url: z.string().min(1, "`url` is required.").max(500, "`url` is too long."),
  refresh: flag,
});

const bodySchema = querySchema;

/** GET /api/profile?url=https://www.linkedin.com/in/<slug> */
profileRouter.get("/profile", requireApiKey, async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid query parameters.", z.treeifyError(parsed.error));
  }
  const { url, refresh } = parsed.data;
  res.json(await getProfile(url, { refresh }));
});

/** POST /api/profile { "url": "..." } — same thing, for clients that prefer a body. */
profileRouter.post("/profile", requireApiKey, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid request body.", z.treeifyError(parsed.error));
  }
  const { url, refresh } = parsed.data;
  res.json(await getProfile(url, { refresh }));
});
