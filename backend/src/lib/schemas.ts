import { z } from "zod";

export const authBodySchema = z.object({
  password: z.string().min(1),
});

export const legSchema = z.object({
  teams: z.string().min(3).max(200),
  market_type: z.string().min(2).max(80),
  selection: z.string().min(1).max(120),
  line: z.number().optional().nullable(),
  odds: z.number().min(1.01),
  event_time: z.string().datetime({ offset: true }),
  provider: z.string().optional().nullable(),
  provider_event_id: z.string().optional().nullable(),
});

export const createBetSchema = z
  .object({
    kind: z.enum(["single", "parlay"]).default("single"),
    teams: z.string().min(3).max(200),
    bet_type: z.string().min(2).max(100),
    odds: z.number().min(1.01),
    stake: z.number().positive(),
    currency: z.string().length(3).transform((v) => v.toUpperCase()),
    match_time: z.string().datetime({ offset: true }),
    confidence: z.enum(["high", "medium", "low"]).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    uploaded_by: z.string().max(50).optional().nullable(),
    status: z.enum(["upcoming", "live", "finished", "settled"]).optional(),
    result: z.enum(["won", "lost", "push", "void"]).optional().nullable(),
    actual_return: z.number().nonnegative().optional().nullable(),
    provider: z.string().optional().nullable(),
    provider_ref: z.string().optional().nullable(),
    legs: z.array(legSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "parlay" && (!value.legs || value.legs.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Parlay requires at least 2 legs",
        path: ["legs"],
      });
    }
  });

export const patchBetSchema = z
  .object({
    kind: z.enum(["single", "parlay"]).optional(),
    teams: z.string().min(3).max(200).optional(),
    bet_type: z.string().min(2).max(100).optional(),
    odds: z.number().min(1.01).optional(),
    stake: z.number().positive().optional(),
    currency: z.string().length(3).transform((v) => v.toUpperCase()).optional(),
    match_time: z.string().datetime({ offset: true }).optional(),
    status: z.enum(["upcoming", "live", "finished", "settled"]).optional(),
    result: z.enum(["won", "lost", "push", "void"]).nullable().optional(),
    actual_return: z.number().nonnegative().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field is required");

export const listQuerySchema = z.object({
  status: z.enum(["upcoming", "live", "finished", "settled"]).optional(),
  from: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Invalid from date"),
  to: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Invalid to date"),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["match_time", "created_at", "stake", "odds"]).default("match_time"),
  order: z.enum(["asc", "desc"]).default("asc"),
});
