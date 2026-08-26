import "dotenv/config";
import { z } from "zod";

/**
 * All configuration comes from environment variables so that no secret
 * ever lives in the repository. `.env.example` documents every key.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  /** LinkedIn session cookies (see README -> "Getting your cookies"). */
  LINKEDIN_LI_AT: z.string().min(10).optional(),
  LINKEDIN_JSESSIONID: z.string().min(5).optional(),

  /** Optional shared secret clients must send as `x-api-key`. */
  API_KEY: z.string().min(8).optional(),

  /** Comma separated list of allowed browser origins, or `*`. */
  CORS_ORIGINS: z.string().default("*"),

  /** Serve canned fixture data instead of calling LinkedIn. */
  MOCK_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  /** In-memory cache time-to-live, in seconds. */
  CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(900),

  /** Rate limit: max requests per IP per window. */
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  /** Politeness delay (ms) applied before every LinkedIn call. */
  REQUEST_DELAY_MS: z.coerce.number().int().nonnegative().default(1200),

  LOG_LEVEL: z.string().default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

export const hasLinkedInCredentials = Boolean(
  env.LINKEDIN_LI_AT && env.LINKEDIN_JSESSIONID,
);

export const corsOrigins =
  env.CORS_ORIGINS === "*"
    ? true
    : env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
