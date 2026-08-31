import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",

  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),

  maxFailedLoginAttempts: Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS ?? 5),
  lockoutMinutes: Number(process.env.LOCKOUT_MINUTES ?? 15),

  cookieSecure: process.env.COOKIE_SECURE === "true",

  // --- Prospecting ---
  // Nominatim and Overpass both require a User-Agent that identifies the
  // application and gives them someone to contact; an anonymous one gets
  // blocked, and rightly so.
  prospectingUserAgent:
    process.env.PROSPECTING_USER_AGENT ?? "InsightsCRM/1.0 (prospecting; contato@exemplo.com.br)",
  overpassUrl: process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter",
  // Tried only when the primary endpoint reports it is out of free slots.
  overpassFallbackUrl: process.env.OVERPASS_FALLBACK_URL ?? "https://overpass.kumi.systems/api/interpreter",
  // Optional. When set, the Google Places provider becomes selectable.
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? "",
  // Enrichment visits each lead website once. Turn off to skip that step.
  enrichmentEnabled: process.env.ENRICHMENT_ENABLED !== "false",

  // How long one prospecting slice may work before returning. Must stay
  // comfortably under the host's request timeout: Vercel allows 300s, and 45s
  // keeps each tick responsive enough that the UI shows steady progress.
  prospectingSliceMs: Number(process.env.PROSPECTING_SLICE_MS ?? 45_000),
  // On an always-on host, set this so a job finishes on its own instead of
  // needing the browser to keep ticking it. Leave off on serverless, where a
  // background loop is killed the moment the response is sent.
  prospectingInline: process.env.PROSPECTING_INLINE === "true",
};

if (env.isProd) {
  if (env.jwtAccessSecret.length < 32 || env.jwtRefreshSecret.length < 32) {
    throw new Error("JWT secrets must be at least 32 characters in production");
  }
}
