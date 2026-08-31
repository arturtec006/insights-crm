import { SourceProvider } from "./types";
import { overpassProvider } from "./providers/overpass";
import { googlePlacesProvider } from "./providers/googlePlaces";

const providers: SourceProvider[] = [overpassProvider, googlePlacesProvider];

export function getProvider(id: string): SourceProvider | null {
  return providers.find((p) => p.id === id) ?? null;
}

/** Providers that can actually run right now — used to build the UI's picker. */
export function availableProviders(): { id: string; label: string; available: boolean }[] {
  const labels: Record<string, string> = {
    overpass: "OpenStreetMap (gratuito)",
    google_places: "Google Places (requer chave de API)",
  };
  return providers.map((p) => ({ id: p.id, label: labels[p.id] ?? p.id, available: p.isAvailable() }));
}
