import { z } from "zod";
import { SCORING_PROFILES } from "../prospecting/score";

export const LEAD_STATUSES = ["new", "qualified", "disqualified", "converted"] as const;
export const ACTIVITY_TYPES = ["note", "call", "whatsapp", "email", "meeting", "task", "system"] as const;
export const DEAL_STATUSES = ["open", "won", "lost"] as const;
export const STAGE_KINDS = ["open", "won", "lost"] as const;

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

// --- Leads -----------------------------------------------------------------

export const listLeadsSchema = z.object({
  q: optionalTrimmed(200),
  status: z.enum(LEAD_STATUSES).optional(),
  city: optionalTrimmed(120),
  source: optionalTrimmed(40),
  jobId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  /** "unassigned" filters to leads nobody owns yet. */
  assignment: z.enum(["any", "mine", "unassigned"]).default("any"),
  sort: z.enum(["score", "recent", "name"]).default("score"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const createLeadSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  contactName: optionalTrimmed(200),
  email: z.string().trim().email().max(200).optional().or(z.literal("").transform(() => undefined)),
  phone: optionalTrimmed(40),
  website: optionalTrimmed(300),
  instagram: optionalTrimmed(100),
  addressLine: optionalTrimmed(300),
  city: optionalTrimmed(120),
  state: optionalTrimmed(40),
  category: optionalTrimmed(120),
});

export const updateLeadSchema = z
  .object({
    companyName: z.string().trim().min(1).max(200).optional(),
    contactName: optionalTrimmed(200),
    email: z.string().trim().email().max(200).nullable().optional(),
    phone: optionalTrimmed(40),
    website: optionalTrimmed(300),
    instagram: optionalTrimmed(100),
    addressLine: optionalTrimmed(300),
    city: optionalTrimmed(120),
    state: optionalTrimmed(40),
    category: optionalTrimmed(120),
    status: z.enum(LEAD_STATUSES).optional(),
    disqualifyReason: optionalTrimmed(300),
    ownerId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nada para atualizar" });

export const convertLeadSchema = z.object({
  segment: z.string().trim().min(1).max(60).default("SMB"),
  region: optionalTrimmed(60),
});

export const suppressLeadSchema = z.object({
  reason: optionalTrimmed(300),
});

// --- Activities ------------------------------------------------------------

export const listActivitiesSchema = z
  .object({
    leadId: z.string().uuid().optional(),
    dealId: z.string().uuid().optional(),
    /** Only activities with a due date and no completion, i.e. the to-do list. */
    pending: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .refine((d) => d.leadId || d.dealId || d.pending, {
    message: "Informe leadId, dealId ou pending=true",
  });

export const createActivitySchema = z
  .object({
    // "system" is reserved for events the application writes itself.
    type: z.enum(ACTIVITY_TYPES).exclude(["system"]),
    content: z.string().trim().min(1).max(5000),
    leadId: z.string().uuid().optional(),
    dealId: z.string().uuid().optional(),
    dueAt: z.coerce.date().optional(),
  })
  .refine((d) => d.leadId || d.dealId, { message: "A atividade precisa estar ligada a um lead ou a um negócio" });

export const updateActivitySchema = z
  .object({
    content: z.string().trim().min(1).max(5000).optional(),
    dueAt: z.coerce.date().nullable().optional(),
    done: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nada para atualizar" });

// --- Pipelines & deals -----------------------------------------------------

export const createPipelineSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const createStageSchema = z.object({
  name: z.string().trim().min(1).max(120),
  probability: z.coerce.number().int().min(0).max(100).default(0),
  kind: z.enum(STAGE_KINDS).default("open"),
});

export const updateStageSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    probability: z.coerce.number().int().min(0).max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nada para atualizar" });

export const reorderStagesSchema = z.object({
  /** Stage ids in their new left-to-right order. */
  stageIds: z.array(z.string().uuid()).min(1),
});

export const createDealSchema = z.object({
  title: z.string().trim().min(1).max(200),
  leadId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  value: z.coerce.number().min(0).max(1_000_000_000).default(0),
  expectedCloseAt: z.coerce.date().optional(),
  ownerId: z.string().uuid().optional(),
});

export const updateDealSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    stageId: z.string().uuid().optional(),
    value: z.coerce.number().min(0).max(1_000_000_000).optional(),
    probability: z.coerce.number().int().min(0).max(100).optional(),
    expectedCloseAt: z.coerce.date().nullable().optional(),
    ownerId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nada para atualizar" });

export const closeDealSchema = z.object({
  outcome: z.enum(["won", "lost"]),
  lostReason: optionalTrimmed(300),
});

// --- Prospecting -----------------------------------------------------------

export const createJobSchema = z.object({
  provider: z.enum(["overpass", "google_places"]).default("overpass"),
  query: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(120),
  state: optionalTrimmed(40),
  // 50 km is already an unusually wide net for a local business search, and
  // wider radii make the public Overpass endpoint time out.
  radiusMeters: z.coerce.number().int().min(500).max(50_000).default(15_000),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  scoringProfile: z
    .enum(SCORING_PROFILES.map((p) => p.id) as [string, ...string[]])
    .default("completeness"),
});

export const listJobsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
