// Lead scoring, 0-100.
//
// The score answers one question only: "how worth my time is calling this
// business today?" — and the answer depends on what you sell, so the rubric
// is a named profile rather than a single hard-coded formula. Every point
// awarded is recorded as a signal, so a user looking at a lead can see why it
// scored what it scored instead of trusting a bare number.

export type ScoringProfile = "completeness" | "needs-web-presence";

export const SCORING_PROFILES: { id: ScoringProfile; label: string; description: string }[] = [
  {
    id: "completeness",
    label: "Contactabilidade",
    description: "Pontua quem é mais fácil de abordar hoje: telefone, e-mail, site e redes preenchidos.",
  },
  {
    id: "needs-web-presence",
    label: "Precisa de presença digital",
    description: "Pontua alto quem tem telefone mas não tem site — o alvo de quem vende site, tráfego ou marketing.",
  },
];

export interface ScoreInput {
  phone?: string | null;
  email?: string | null;
  websiteDomain?: string | null;
  instagram?: string | null;
  addressLine?: string | null;
  category?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Signal {
  label: string;
  points: number;
}

export interface ScoreResult {
  score: number;
  signals: Signal[];
}

function finish(signals: Signal[]): ScoreResult {
  const raw = signals.reduce((sum, s) => sum + s.points, 0);
  return { score: Math.max(0, Math.min(100, raw)), signals };
}

export function scoreLead(input: ScoreInput, profile: ScoringProfile = "completeness"): ScoreResult {
  const signals: Signal[] = [];

  if (profile === "needs-web-presence") {
    // A business with a phone and no website is the whole thesis of this
    // profile: reachable, and visibly missing the thing being sold.
    if (input.phone) signals.push({ label: "Telefone disponível", points: 35 });
    if (!input.websiteDomain) {
      signals.push({ label: "Sem site próprio", points: 30 });
    } else {
      signals.push({ label: "Já tem site", points: -10 });
    }
    if (input.instagram) signals.push({ label: "Ativo no Instagram", points: 15 });
    if (input.email) signals.push({ label: "E-mail disponível", points: 10 });
    if (input.addressLine) signals.push({ label: "Endereço físico confirmado", points: 10 });
    return finish(signals);
  }

  if (input.phone) signals.push({ label: "Telefone disponível", points: 30 });
  if (input.email) signals.push({ label: "E-mail disponível", points: 25 });
  if (input.websiteDomain) signals.push({ label: "Site próprio", points: 15 });
  if (input.instagram) signals.push({ label: "Instagram", points: 10 });
  if (input.addressLine) signals.push({ label: "Endereço completo", points: 10 });
  if (input.category) signals.push({ label: "Categoria identificada", points: 5 });
  if (input.latitude != null && input.longitude != null) {
    signals.push({ label: "Geolocalizado", points: 5 });
  }
  return finish(signals);
}

export function isScoringProfile(value: string): value is ScoringProfile {
  return SCORING_PROFILES.some((p) => p.id === value);
}
