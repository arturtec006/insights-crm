import { env } from "../../config/env";
import { ApiError } from "../../middleware/errorHandler";
import { politeFetch } from "../httpClient";
import { RawBusiness, SearchParams, SourceProvider } from "../types";

// Google Places (New) Text Search. Far better contact coverage than OSM, but
// it is billed per request and its terms forbid storing most fields long-term —
// so it stays opt-in behind an API key rather than being the default.
//
// Note the field mask: it is what keeps this on the cheaper SKU. Adding fields
// to it changes what Google charges per call.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.location",
  "places.primaryType",
  "places.addressComponents",
].join(",");

interface PlacesResponse {
  places?: {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    location?: { latitude: number; longitude: number };
    primaryType?: string;
    addressComponents?: { longText: string; shortText: string; types: string[] }[];
  }[];
}

function componentOf(
  components: { longText: string; shortText: string; types: string[] }[] | undefined,
  type: string,
  short = false
): string | undefined {
  const found = components?.find((c) => c.types.includes(type));
  if (!found) return undefined;
  return short ? found.shortText : found.longText;
}

export const googlePlacesProvider: SourceProvider = {
  id: "google_places",

  isAvailable() {
    return Boolean(env.googlePlacesApiKey);
  },

  async search({ query, city, state, limit }: SearchParams): Promise<RawBusiness[]> {
    if (!this.isAvailable()) {
      throw new ApiError(400, "Google Places não está configurado: defina GOOGLE_PLACES_API_KEY no .env.");
    }

    const textQuery = [query, "em", city, state].filter(Boolean).join(" ");
    const res = await politeFetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.googlePlacesApiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "pt-BR",
        regionCode: "BR",
        // The API caps a page at 20; ask for what we need and no more, since
        // every returned place is billable.
        pageSize: Math.min(limit, 20),
      }),
      minIntervalMs: 200,
      timeoutMs: 30_000,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ApiError(502, `Google Places retornou ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }

    const data = (await res.json()) as PlacesResponse;
    return (data.places ?? []).map((p) => ({
      sourceRef: p.id,
      name: p.displayName?.text ?? "(sem nome)",
      phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber,
      website: p.websiteUri,
      addressLine: p.formattedAddress,
      city: componentOf(p.addressComponents, "administrative_area_level_2") ?? city,
      state: componentOf(p.addressComponents, "administrative_area_level_1", true) ?? state,
      latitude: p.location?.latitude,
      longitude: p.location?.longitude,
      category: p.primaryType,
      raw: p,
    }));
  },
};
