/**
 * Contracts shared by the browser and the LLM routes (LLM-03, D-05, D-12).
 *
 * Every request schema is a `z.strictObject`: any key beyond the ones listed is
 * rejected at every level, so nothing but an opaque id, a description and a
 * supplier display name can reach the route or DeepSeek. Pure: zod only.
 */
import { z } from "zod";

export const LLM_LIMITS = {
  groupItems: 120,
  categorizeEntries: 150,
  description: 200,
  supplier: 120,
  productName: 60,
  contextNames: 400,
  categories: 200,
  membersPerProduct: 100,
  requestBytes: 262144,
} as const;

/** Our own error codes: the route never forwards an upstream status or body. */
export const LLM_ERROR_CODES = [
  "unauthorized",
  "bad_request",
  "payload_too_large",
  "server_not_configured",
  "upstream_auth",
  "upstream_balance",
  "upstream_rejected",
  "upstream_rate_limited",
  "upstream_unavailable",
  "upstream_timeout",
  "invalid_response",
  "incomplete_response",
] as const;

export type LlmErrorCode = (typeof LLM_ERROR_CODES)[number];

/** True exactly for the conditions a second attempt can fix. */
export function isRetryable(code: LlmErrorCode): boolean {
  switch (code) {
    case "upstream_rate_limited":
    case "upstream_unavailable":
    case "upstream_timeout":
    case "invalid_response":
    case "incomplete_response":
      return true;
    case "unauthorized":
    case "bad_request":
    case "payload_too_large":
    case "server_not_configured":
    case "upstream_auth":
    case "upstream_balance":
    case "upstream_rejected":
      return false;
  }
}

export const llmErrorBodySchema = z.object({
  error: z.enum(LLM_ERROR_CODES),
  retryable: z.boolean(),
});

/** Safe to return and to show at the live checkpoint: no content, no key. */
export const llmMetaSchema = z.object({
  attempts: z.number().int(),
  durationMs: z.number(),
  finishReason: z.string().nullable(),
  promptTokens: z.number().nullable(),
  completionTokens: z.number().nullable(),
  reasoningTokens: z.number().nullable(),
});

export type LlmMeta = z.infer<typeof llmMetaSchema>;

export const groupRequestSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.string().regex(/^i\d{1,4}$/),
        description: z.string().trim().min(1).max(LLM_LIMITS.description),
        supplier: z.string().trim().min(1).max(LLM_LIMITS.supplier),
      }),
    )
    .min(1)
    .max(LLM_LIMITS.groupItems),
  existing: z
    .array(
      z.strictObject({
        id: z.string().regex(/^p\d{1,4}$/),
        name: z.string().trim().min(1).max(LLM_LIMITS.productName),
      }),
    )
    .max(LLM_LIMITS.contextNames),
});

export type GroupRequest = z.infer<typeof groupRequestSchema>;

/**
 * Compact answer of the model: {"g":[{"n":"Leche entera","i":["i1","i7"],"e":null}]}
 * where `e` is the id (p#) of an existing product, or null.
 */
export const groupModelOutputSchema = z.object({
  g: z.array(
    z.object({
      n: z.string(),
      i: z.array(z.string()).min(1),
      e: z.string().nullable().optional(),
    }),
  ),
});

export const groupResponseSchema = z.object({
  groups: z.array(
    z.object({
      name: z.string().trim().min(1).max(LLM_LIMITS.productName),
      ids: z.array(z.string()).min(1),
      existing: z.string().nullable(),
    }),
  ),
  meta: llmMetaSchema,
});

export type GroupResponse = z.infer<typeof groupResponseSchema>;

/**
 * «Sugerir categorías» request (LLM-02, D-07, D-17). Only supplier display names, product names
 * with the descriptions of their members and the names of the user's categories can travel;
 * every object is strict, so an RFC, an amount or a date makes the whole body invalid. Ids are
 * opaque and per request: s# for suppliers, q# for products, c# for categories.
 */
export const categorizeRequestSchema = z
  .strictObject({
    suppliers: z.array(
      z.strictObject({
        id: z.string().regex(/^s\d{1,4}$/),
        name: z.string().trim().min(1).max(LLM_LIMITS.supplier),
      }),
    ),
    products: z.array(
      z.strictObject({
        id: z.string().regex(/^q\d{1,4}$/),
        name: z.string().trim().min(1).max(LLM_LIMITS.productName),
        members: z
          .array(z.string().trim().min(1).max(LLM_LIMITS.description))
          .min(1)
          .max(LLM_LIMITS.membersPerProduct),
      }),
    ),
    categories: z
      .array(
        z.strictObject({
          id: z.string().regex(/^c\d{1,3}$/),
          name: z.string().trim().min(1).max(LLM_LIMITS.productName),
        }),
      )
      .max(LLM_LIMITS.categories),
  })
  .refine(
    (body) =>
      body.suppliers.length + body.products.length >= 1 &&
      body.suppliers.length + body.products.length <= LLM_LIMITS.categorizeEntries,
    { message: "between 1 and 150 suppliers plus products" },
  );

export type CategorizeRequest = z.infer<typeof categorizeRequestSchema>;

/**
 * Compact answer of the model: {"a":[{"i":"s1","c":"c3","n":null},{"i":"q1","c":null,"n":"Bebidas"}]}
 * where `c` is the code (c#) of one of the user's categories and `n` a proposed new name.
 */
export const categorizeModelOutputSchema = z.object({
  a: z.array(
    z.object({
      i: z.string(),
      c: z.string().nullable().optional(),
      n: z.string().nullable().optional(),
    }),
  ),
});

export const categorizeResponseSchema = z.object({
  answers: z.array(
    z.object({
      id: z.string(),
      choice: z.union([
        z.object({ kind: z.literal("code"), code: z.string() }),
        z.object({
          kind: z.literal("new"),
          name: z.string().trim().min(1).max(LLM_LIMITS.productName),
        }),
      ]),
    }),
  ),
  meta: llmMetaSchema,
});

export type CategorizeResponse = z.infer<typeof categorizeResponseSchema>;
