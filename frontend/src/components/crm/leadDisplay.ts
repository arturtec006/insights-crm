import type { LeadStatus, ActivityType, JobStatus } from "../../types/crm";

// Shared vocabulary for the CRM screens. Status values travel as English
// identifiers on the wire and are translated once, here, so a label never
// drifts between the list, the detail panel and the board.
//
// Kept separate from the components in LeadBadges.tsx: a module that exports
// both components and plain values breaks React Fast Refresh.

export const leadStatusLabel: Record<LeadStatus, string> = {
  new: "Novo",
  qualified: "Qualificado",
  disqualified: "Descartado",
  converted: "Convertido",
};

export const leadStatusTone: Record<LeadStatus, "neutral" | "warning" | "good" | "critical"> = {
  new: "neutral",
  qualified: "warning",
  converted: "good",
  disqualified: "critical",
};

export const sourceLabel: Record<string, string> = {
  overpass: "OpenStreetMap",
  google_places: "Google Places",
  manual: "Manual",
  import: "Importação",
};

export const activityLabel: Record<ActivityType, string> = {
  note: "Anotação",
  call: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  meeting: "Reunião",
  task: "Tarefa",
  system: "Sistema",
};

export const activityIcon: Record<ActivityType, string> = {
  note: "📝",
  call: "📞",
  whatsapp: "💬",
  email: "✉️",
  meeting: "🤝",
  task: "✅",
  system: "⚙️",
};

export const jobStatusLabel: Record<JobStatus, string> = {
  queued: "Na fila",
  running: "Rodando",
  done: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

export const jobStatusTone: Record<JobStatus, "neutral" | "warning" | "good" | "critical"> = {
  queued: "neutral",
  running: "warning",
  done: "good",
  failed: "critical",
  cancelled: "neutral",
};

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { dateStyle: "short" });
}

/** Pretty-print an E.164 Brazilian number back into how people read it. */
export function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  const m = phone.match(/^\+55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
}

/** wa.me link for a normalized phone, or null when we cannot build one. */
export function whatsappLink(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 12 ? `https://wa.me/${digits}` : null;
}
