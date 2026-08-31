import { politeFetch } from "../httpClient";
import { resolveNiche } from "../niches";
import { RawBusiness, SearchParams, SourceProvider } from "../types";
import { ApiError } from "../../middleware/errorHandler";
import { env } from "../../config/env";

// OpenStreetMap via the Overpass API. Free, keyless, and explicitly licensed
// for reuse (ODbL) — which is why it is the default source. Its weakness is
// coverage: contact tags are volunteer-contributed, so expect a meaningful
// share of results to arrive with a name and an address but no phone.

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
}

/** Resolve "São Paulo, SP" to coordinates so Overpass has a centre to search around. */
async function geocodeCity(city: string, state?: string): Promise<{ lat: number; lon: number }> {
  const q = [city, state, "Brasil"].filter(Boolean).join(", ");
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;

  const res = await politeFetch(url, { minIntervalMs: 1100, timeoutMs: 20_000 });
  if (!res.ok) {
    throw new ApiError(502, `Não consegui localizar a cidade (geocoding retornou ${res.status})`);
  }
  const places = (await res.json()) as NominatimPlace[];
  if (!places.length) {
    throw new ApiError(400, `Cidade não encontrada: "${q}"`);
  }
  return { lat: Number(places[0].lat), lon: Number(places[0].lon) };
}

function buildQuery(tags: string[], lat: number, lon: number, radius: number, limit: number): string {
  // nwr = nodes, ways and relations: a business can be mapped as any of them,
  // and "out center" gives ways/relations a single representative coordinate.
  const clauses = tags
    .map((tag) => {
      const [key, value] = tag.split("=");
      return `  nwr["${key}"="${value}"](around:${radius},${lat},${lon});`;
    })
    .join("\n");

  return `[out:json][timeout:60];
(
${clauses}
);
out center ${limit};`;
}

/**
 * Run one Overpass query, tolerating the public endpoint's normal behaviour.
 *
 * overpass-api.de hands out execution slots and answers 429 when none is free,
 * which is routine rather than exceptional — a first attempt failing says
 * nothing about the query. So: back off, retry, and only then fall back to a
 * mirror before giving up.
 */
async function queryOverpass(body: string): Promise<Response> {
  const endpoints = [env.overpassUrl, env.overpassFallbackUrl].filter(Boolean);
  const backoffMs = [0, 6_000, 15_000];
  let lastStatus = 0;

  for (const endpoint of endpoints) {
    for (const wait of backoffMs) {
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));

      const res = await politeFetch(endpoint, {
        method: "POST",
        body: new URLSearchParams({ data: body }).toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        // Overpass asks for one heavy query at a time from a given client.
        minIntervalMs: 2500,
        timeoutMs: 90_000,
      });

      if (res.ok) return res;

      lastStatus = res.status;
      // Anything other than "busy" is a real error and retrying will not help.
      if (res.status !== 429 && res.status !== 504 && res.status !== 502) {
        throw new ApiError(502, `Overpass retornou ${res.status}`);
      }
    }
  }

  throw new ApiError(
    503,
    `Os servidores públicos do OpenStreetMap estão sobrecarregados agora (HTTP ${lastStatus}). ` +
      "Tente novamente em alguns minutos."
  );
}

function extractState(tags: Record<string, string>): string | undefined {
  return tags["addr:state"] ?? undefined;
}

function extractAddress(tags: Record<string, string>): string | undefined {
  const street = tags["addr:street"];
  const number = tags["addr:housenumber"];
  const suburb = tags["addr:suburb"];
  const parts = [street && number ? `${street}, ${number}` : street, suburb].filter(Boolean);
  return parts.length ? parts.join(" - ") : undefined;
}

function extractCategory(tags: Record<string, string>): string | undefined {
  return tags.amenity ?? tags.shop ?? tags.healthcare ?? tags.office ?? tags.leisure ?? tags.tourism;
}

export const overpassProvider: SourceProvider = {
  id: "overpass",

  isAvailable() {
    return true;
  },

  async search({ query, city, state, radiusMeters, limit }: SearchParams): Promise<RawBusiness[]> {
    const niche = resolveNiche(query);
    if (!niche) {
      throw new ApiError(
        400,
        `Não sei traduzir "${query}" para uma categoria do OpenStreetMap. Escolha um dos nichos disponíveis na lista.`
      );
    }

    const { lat, lon } = await geocodeCity(city, state);
    const body = buildQuery(niche.tags, lat, lon, radiusMeters, limit);

    const res = await queryOverpass(body);
    const data = (await res.json()) as { elements?: OverpassElement[] };
    const elements = data.elements ?? [];

    return elements
      .filter((el) => el.tags?.name)
      .map((el) => {
        const tags = el.tags!;
        const coords = el.center ?? (el.lat != null && el.lon != null ? { lat: el.lat, lon: el.lon } : undefined);

        return {
          sourceRef: `${el.type}/${el.id}`,
          name: tags.name,
          phone: tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? tags.mobile,
          website: tags.website ?? tags["contact:website"] ?? tags.url,
          email: tags.email ?? tags["contact:email"],
          instagram: tags["contact:instagram"] ?? tags.instagram,
          addressLine: extractAddress(tags),
          city: tags["addr:city"] ?? city,
          state: extractState(tags) ?? state,
          latitude: coords?.lat,
          longitude: coords?.lon,
          category: extractCategory(tags),
          raw: { id: `${el.type}/${el.id}`, tags },
        } satisfies RawBusiness;
      });
  },
};
