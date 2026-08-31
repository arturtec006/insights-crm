// Normalization is what makes deduplication work. Two runs of the same search,
// or the same business found through OpenStreetMap and through Google Places,
// must collapse onto one Lead — and that only happens if "(11) 98765-4321",
// "+55 11 98765 4321" and "1198765-4321" all reduce to the same string.

/** Area codes actually in use in Brazil. Anything else is a parsing mistake. */
const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Reduce a Brazilian phone number to E.164 (+55DDNNNNNNNNN).
 *
 * Returns null when the number cannot be trusted — most importantly when it
 * carries no area code, since guessing one would silently merge businesses in
 * different cities onto the same dedupe key.
 */
export function normalizePhoneBR(input: string | null | undefined): string | null {
  if (!input) return null;

  // A source may pack several numbers into one field ("11 3333-4444; 11 99999-8888").
  const first = input.split(/[;,/]| ou /i)[0] ?? input;
  let digits = first.replace(/\D/g, "");
  if (!digits) return null;

  // Strip an international prefix written as 00 55 ...
  if (digits.startsWith("0055")) digits = digits.slice(2);
  // Country code.
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  // Carrier selection / trunk prefix: 0 XX DDD number.
  if (digits.length === 12 && digits.startsWith("0")) digits = digits.slice(3);
  if (digits.length === 12 && digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = Number(digits.slice(0, 2));
  if (!VALID_DDD.has(ddd)) return null;

  const subscriber = digits.slice(2);
  // 11 digits = mobile, and every Brazilian mobile starts with 9.
  if (subscriber.length === 9 && !subscriber.startsWith("9")) return null;
  // 10 digits = landline, whose first digit is 2-5.
  if (subscriber.length === 8 && !/^[2-5]/.test(subscriber)) return null;

  return `+55${digits}`;
}

/**
 * Reduce a URL to its bare host: "https://WWW.Example.com.br/contato?x=1"
 * becomes "example.com.br". Returns null for anything that is not a real
 * external website (social profiles are captured separately).
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;

  let host: string;
  try {
    host = new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }

  host = host.replace(/^www\./, "");
  // Needs at least one dot and a plausible TLD to be a real domain.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
  return host;
}

/** Lowercase and trim an email, returning null if it is not shaped like one. */
export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim().toLowerCase().replace(/^mailto:/, "").split("?")[0];
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(value)) return null;
  return value;
}

/** Extract a bare Instagram handle from a URL, an @handle, or a plain handle. */
export function normalizeInstagram(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim();
  const urlMatch = value.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (urlMatch) value = urlMatch[1];
  value = value.replace(/^@/, "").replace(/\/$/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(value)) return null;
  // Instagram's own routes are not profiles.
  if (["p", "reel", "reels", "explore", "stories", "accounts"].includes(value.toLowerCase())) return null;
  return value.toLowerCase();
}

/** Strip accents, punctuation and repeated spaces so names compare reliably. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface DedupeInput {
  phone?: string | null;
  websiteDomain?: string | null;
  companyName: string;
  city?: string | null;
}

/**
 * The fingerprint that Lead is made unique on, per organization.
 *
 * Ordered by how strongly each signal identifies one business: a phone number
 * is nearly unique, a domain is unique but shared by franchises, and a
 * name+city pair is the last resort and the only one that can produce a false
 * match (two genuinely different businesses with the same name in one city).
 */
export function buildDedupeKey({ phone, websiteDomain, companyName, city }: DedupeInput): string {
  if (phone) return `phone:${phone}`;
  if (websiteDomain) return `domain:${websiteDomain}`;
  return `name:${slugify(companyName)}|city:${slugify(city ?? "")}`;
}
