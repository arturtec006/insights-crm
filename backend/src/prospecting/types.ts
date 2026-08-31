// A business as returned by a prospecting source, before normalization,
// scoring or deduplication. Every provider maps its own payload onto this
// shape so the rest of the pipeline never knows which source it came from.
export interface RawBusiness {
  /** Provider-native identifier, e.g. "node/123456" or a Google place_id. */
  sourceRef: string;
  name: string;
  phone?: string;
  website?: string;
  email?: string;
  instagram?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  /** Business category as the source reports it, e.g. "dentist". */
  category?: string;
  /** Untouched provider payload, stored on the Lead for auditing. */
  raw: unknown;
}

export interface SearchParams {
  /** Free-text niche in Portuguese, e.g. "clinica odontologica". */
  query: string;
  city: string;
  state?: string;
  radiusMeters: number;
  limit: number;
}

export interface SourceProvider {
  /** Stable id stored on Lead.source. */
  readonly id: string;
  /** Whether this provider is usable right now (e.g. has its API key set). */
  isAvailable(): boolean;
  search(params: SearchParams): Promise<RawBusiness[]>;
}
