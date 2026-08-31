import { Response } from "express";
import { env } from "../config/env";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const baseCookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "lax" as const,
  path: "/",
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions,
    path: "/api/auth", // only sent to auth endpoints, narrowing exposure
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions, path: "/api/auth" });
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
