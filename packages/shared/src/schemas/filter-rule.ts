import { z } from 'zod';

export const FilterOperator = {
  INCLUDES: 'includes',
  NOT_INCLUDES: 'not_includes',
} as const;

export const filterRuleSchema = z.object({
  id: z.number().int().positive(),
  feedId: z.number().int().positive(),
  pattern: z.string().min(1),
  operator: z.enum([FilterOperator.INCLUDES, FilterOperator.NOT_INCLUDES]),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
});

export const createFilterRuleSchema = filterRuleSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createFilterRuleApiSchema = createFilterRuleSchema.omit({
  feedId: true,
});

export const updateFilterRuleSchema = createFilterRuleSchema.partial();
