import path from "node:path";
import fs from "node:fs";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { env } from "./config/env";
import { apiLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import analyticsRoutes from "./routes/analytics";
import leadRoutes from "./routes/leads";
import pipelineRoutes from "./routes/pipelines";
import dealRoutes from "./routes/deals";
import activityRoutes from "./routes/activities";
import prospectingRoutes from "./routes/prospecting";
import suppressionRoutes from "./routes/suppressions";

// The Express application, built but not listening. Keeping `listen` out of
// this module is what lets the same app run in two very different places:
// server.ts binds a port for a normal always-on process, while a serverless
// platform imports `app` and hands it one request at a time.

const app = express();

// Trust the first proxy hop (needed for correct req.ip / rate limiting behind
// a reverse proxy or load balancer in production).
app.set("trust proxy", 1);

app.use(
  helmet({
    // The SPA's own assets are same-origin; the default CSP would otherwise
    // block the inline styles the app relies on.
    contentSecurityPolicy: env.isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
  })
);

// CORS only matters when the browser origin differs from the API origin. In
// production the SPA is served from this same origin, which is precisely what
// lets the session cookies stay `sameSite: lax` instead of being loosened to
// `none` — so cross-origin credentials are deliberately not enabled there.
if (!env.isProd) {
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
}

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
if (!env.isProd) {
  app.use(morgan("dev"));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Rate limiting applies to the API only — static assets should never consume
// a request budget.
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/pipelines", pipelineRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/prospecting", prospectingRoutes);
app.use("/api/suppressions", suppressionRoutes);

app.use("/api", notFoundHandler);

// Serve the built SPA when it is present next to the API.
//
// On a serverless host the platform's CDN serves these files and this block
// never runs. On an always-on host it is what makes the whole product one
// origin, which the cookie strategy depends on.
const clientDir = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));

  // Client-side routing: any non-API path that is not a real file is the SPA's
  // to resolve, so hand it index.html rather than a 404.
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
} else {
  app.use(notFoundHandler);
}

app.use(errorHandler);

// Vercel resolves an Express service by scanning a fixed list of paths, with
// `src/app.ts` ahead of `src/server.ts`, and requires the file it picks to
// either default-export the app or listen on a port. Exporting *only* a default
// (rather than default plus a named export) also keeps the bundler from warning
// about mixed exports. `server.ts` imports this same default for always-on hosts.
export default app;
