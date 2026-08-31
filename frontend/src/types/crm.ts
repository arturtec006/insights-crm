export type LeadStatus = "new" | "qualified" | "disqualified" | "converted";
export type ActivityType = "note" | "call" | "whatsapp" | "email" | "meeting" | "task" | "system";
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type StageKind = "open" | "won" | "lost";

export interface UserRef {
  id: string;
  name: string;
}

export interface LeadListItem {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  websiteDomain: string | null;
  instagram: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  source: string;
  score: number;
  status: LeadStatus;
  createdAt: string;
  owner: UserRef | null;
}

export interface LeadsResponse {
  leads: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Partial<Record<LeadStatus, number>>;
}

export interface LeadFacets {
  cities: string[];
  sources: string[];
  owners: UserRef[];
}

export interface Signal {
  label: string;
  points: number;
}

export interface Activity {
  id: string;
  type: ActivityType;
  content: string;
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
  user: UserRef | null;
  lead?: { id: string; companyName: string } | null;
}

export interface DealSummary {
  id: string;
  title: string;
  value: number;
  status: "open" | "won" | "lost";
  stage: { id: string; name: string; kind: StageKind };
}

export interface LeadDetail extends LeadListItem {
  phoneRaw: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  disqualifyReason: string | null;
  convertedCustomerId: string | null;
  convertedAt: string | null;
  signals: Signal[];
  job: { id: string; query: string; city: string; provider: string; createdAt: string } | null;
  activities: Activity[];
  deals: DealSummary[];
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  probability: number;
  kind: StageKind;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  probability: number;
  status: "open" | "won" | "lost";
  expectedCloseAt: string | null;
  lostReason: string | null;
  stage: { id: string; name: string; kind: StageKind; position: number };
  owner: UserRef | null;
  lead: { id: string; companyName: string; phone: string | null; email: string | null; city: string | null; score: number } | null;
}

export interface BoardColumn {
  stage: PipelineStage;
  deals: Deal[];
  totalValue: number;
}

export interface BoardResponse {
  pipeline: { id: string; name: string };
  columns: BoardColumn[];
}

export interface ProspectJob {
  id: string;
  provider: string;
  query: string;
  city: string;
  state: string | null;
  radiusMeters: number;
  limit: number;
  scoringProfile: string;
  status: JobStatus;
  foundCount: number;
  createdCount: number;
  duplicateCount: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  createdBy: UserRef | null;
}

export interface ProspectingOptions {
  providers: { id: string; label: string; available: boolean }[];
  niches: { id: string; label: string }[];
  scoringProfiles: { id: string; label: string; description: string }[];
}

export interface SuppressionEntry {
  id: string;
  kind: string;
  value: string;
  reason: string | null;
  createdAt: string;
}
