import { env } from "../config/env";

/**
 * Both Nominatim and Overpass are volunteer-funded public endpoints with
 * explicit usage policies: identify yourself, and do not hammer them. This
 * module enforces a global minimum interval per host across the whole process,
 * so concurrent jobs queue up instead of racing.
 */
const lastCallByHost = new Map<string, number>();

async function throttle(host: string, minIntervalMs: number): Promise<void> {
  const last = lastCallByHost.get(host) ?? 0;
  const wait = last + minIntervalMs - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastCallByHost.set(host, Date.now());
}

export interface PoliteFetchOptions extends RequestInit {
  /** Minimum gap between two calls to the same host, in ms. */
  minIntervalMs?: number;
  timeoutMs?: number;
}

export async function politeFetch(url: string, options: PoliteFetchOptions = {}): Promise<Response> {
  const { minIntervalMs = 1100, timeoutMs = 30_000, headers, ...rest } = options;
  const host = new URL(url).host;
  await throttle(host, minIntervalMs);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        // Nominatim's policy requires a real identifying User-Agent; sending a
        // contact address is what keeps this from looking like an anonymous bot.
        "User-Agent": env.prospectingUserAgent,
        "Accept-Language": "pt-BR,pt;q=0.9",
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
