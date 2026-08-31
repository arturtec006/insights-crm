import { app } from "../backend/src/app";

// Serverless entry point.
//
// Vercel hands each request to this default export; the Express app handles it
// and returns, with no port ever bound. `server.ts` remains the entry point for
// always-on hosts, so both deployment targets share the exact same application.
//
// Note what is deliberately absent: no background work is started here. On this
// platform anything still running when the response is sent gets frozen, which
// is why prospecting is driven slice-by-slice through POST /api/prospecting/jobs/:id/tick.
export default app;
