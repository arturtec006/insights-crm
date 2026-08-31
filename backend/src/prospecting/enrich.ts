import { politeFetch } from "./httpClient";
import { env } from "../config/env";
import { normalizeEmail, normalizeInstagram, normalizePhoneBR } from "./normalize";

// A business found in OpenStreetMap usually arrives as a name, an address and
// maybe a phone. That is not yet a lead someone can work. Enrichment visits the
// business's own website — once, politely, honouring robots.txt — and pulls out
// the contact channels a salesperson actually uses: e-mail, Instagram, WhatsApp.

export interface EnrichmentResult {
  email?: string;
  instagram?: string;
  whatsapp?: string;
  /** Pages actually fetched, kept so a surprising result can be traced. */
  visited: string[];
}

/** Paths worth a second look when the homepage yields nothing. */
const CONTACT_PATHS = ["/contato", "/contact", "/fale-conosco"];

const MAX_BYTES = 1_000_000;

// Addresses that appear on sites but never belong to the business itself.
const EMAIL_BLOCKLIST = [
  "example.com", "example.org", "sentry.io", "wixpress.com", "wix.com",
  "squarespace.com", "godaddy.com", "domain.com", "email.com", "seudominio",
  "yourdomain", "sentry-next", "cloudflare.com", "w3.org", "schema.org",
];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const INSTAGRAM_RE = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/gi;
const WHATSAPP_RE = /(?:wa\.me|api\.whatsapp\.com\/send)[/?][^"'\s<>]*/gi;

/**
 * Refuse to fetch anything that is not a public web address. The URL comes from
 * third-party data, so without this the enricher would happily be pointed at
 * localhost or a private range — a server-side request forgery.
 */
function isPublicHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  if (host === "0.0.0.0" || host === "[::1]" || host === "::1") return false;

  // Literal private/loopback/link-local IPv4.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 169 && b === 254) return false;
  }
  return true;
}

/**
 * Minimal robots.txt evaluation for our own user-agent token. Only Disallow
 * prefixes under `User-agent: *` are considered — enough to honour a site that
 * asks not to be crawled, which is the point.
 */
async function isAllowedByRobots(origin: string, path: string): Promise<boolean> {
  try {
    const res = await politeFetch(`${origin}/robots.txt`, { minIntervalMs: 1500, timeoutMs: 8_000 });
    // No robots.txt (or an error serving it) means no restriction.
    if (!res.ok) return true;

    const text = (await res.text()).slice(0, 100_000);
    const lines = text.split(/\r?\n/);

    let inWildcardGroup = false;
    const disallowed: string[] = [];

    for (const line of lines) {
      const clean = line.split("#")[0].trim();
      if (!clean) continue;
      const [rawKey, ...rest] = clean.split(":");
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(":").trim();

      if (key === "user-agent") {
        inWildcardGroup = value === "*";
      } else if (key === "disallow" && inWildcardGroup && value) {
        disallowed.push(value);
      }
    }

    return !disallowed.some((rule) => (rule === "/" ? true : path.startsWith(rule)));
  } catch {
    // A site we cannot reach for robots.txt is not a site we should crawl.
    return false;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await politeFetch(url, { minIntervalMs: 1500, timeoutMs: 15_000, redirect: "follow" });
    if (!res.ok) return null;

    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return null;

    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) return null;

    const text = await res.text();
    return text.slice(0, MAX_BYTES);
  } catch {
    return null;
  }
}

function extract(html: string, siteDomain: string): Omit<EnrichmentResult, "visited"> {
  const out: Omit<EnrichmentResult, "visited"> = {};

  for (const candidate of html.match(EMAIL_RE) ?? []) {
    const email = normalizeEmail(candidate);
    if (!email) continue;
    const domain = email.split("@")[1];
    if (EMAIL_BLOCKLIST.some((bad) => domain.includes(bad))) continue;
    // Image and asset filenames regularly look like addresses (logo@2x.png).
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(email)) continue;
    // Prefer an address on the business's own domain over a gmail in the footer.
    if (!out.email || domain === siteDomain) out.email = email;
    if (domain === siteDomain) break;
  }

  for (const match of html.matchAll(INSTAGRAM_RE)) {
    const handle = normalizeInstagram(match[1]);
    if (handle) {
      out.instagram = handle;
      break;
    }
  }

  for (const match of html.matchAll(WHATSAPP_RE)) {
    const digits = match[0].replace(/\D/g, "");
    const phone = normalizePhoneBR(digits);
    if (phone) {
      out.whatsapp = phone;
      break;
    }
  }

  return out;
}

/**
 * Visit a business website and pull contact channels off it.
 *
 * Always resolves — enrichment is a bonus, never a reason for a prospecting job
 * to fail — and never fetches more than three pages from one host.
 */
export async function enrichFromWebsite(website: string, siteDomain: string): Promise<EnrichmentResult> {
  const result: EnrichmentResult = { visited: [] };
  if (!env.enrichmentEnabled) return result;

  const base = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  if (!isPublicHttpUrl(base)) return result;

  const origin = new URL(base).origin;

  if (!(await isAllowedByRobots(origin, new URL(base).pathname || "/"))) {
    return result;
  }

  const html = await fetchHtml(base);
  if (html) {
    result.visited.push(base);
    Object.assign(result, extract(html, siteDomain));
  }

  // Only pay for a contact page when the homepage left something missing.
  if (!result.email || !result.whatsapp) {
    for (const path of CONTACT_PATHS) {
      if (result.email && result.whatsapp) break;
      if (!(await isAllowedByRobots(origin, path))) continue;

      const contactHtml = await fetchHtml(`${origin}${path}`);
      if (!contactHtml) continue;

      result.visited.push(`${origin}${path}`);
      const found = extract(contactHtml, siteDomain);
      result.email ??= found.email;
      result.instagram ??= found.instagram;
      result.whatsapp ??= found.whatsapp;
    }
  }

  return result;
}
