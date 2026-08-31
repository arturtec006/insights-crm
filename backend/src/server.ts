import { app } from "./app";
import { env } from "./config/env";
import { releaseStaleLocks } from "./prospecting/runner";

// Entry point for an always-on host (local development, Railway, a VPS).
// Serverless deployments import `app` directly and never run this file.

// Prospecting state lives in the database, so an interrupted job is not lost —
// it just needs another slice. All a restart has to clean up is stale locks.
void releaseStaleLocks().catch((err) => console.error("Failed to release stale prospecting locks", err));

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
