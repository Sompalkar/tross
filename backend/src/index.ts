import { createApp } from "./app.js";
import { env, hasLinkedInCredentials } from "./config/env.js";
import { logger } from "./utils/logger.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      mode: env.MOCK_MODE ? "mock" : "live",
      credentials: hasLinkedInCredentials,
    },
    `LinkedIn Profile API listening on http://localhost:${env.PORT}`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
