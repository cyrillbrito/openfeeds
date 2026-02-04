import { z } from 'zod';

export const FilterOperator = {
  INCLUDES: 'includes',
  NOT_INCLUDES: 'not_includes',
} as const;

export const filterRuleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  feedId: z.string(),
  pattern: z.string().min(1),
  operator: z.enum([FilterOperator.INCLUDES, FilterOperator.NOT_INCLUDES]),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
});
export type FilterRule = z.infer<typeof filterRuleSchema>;

const createFilterRuleSchema = filterRuleSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const createFilterRuleApiSchema = createFilterRuleSchema.omit({
  feedId: true,
});
export type CreateFilterRuleApi = z.infer<typeof createFilterRuleApiSchema>;

export const updateFilterRuleSchema = createFilterRuleSchema.partial();
export type UpdateFilterRule = z.infer<typeof updateFilterRuleSchema>;

export function evaluateRule(rule: FilterRule, title: string): boolean {
  const normalizedTitle = title.toLowerCase();
  const normalizedPattern = rule.pattern.toLowerCase();

  switch (rule.operator) {
    case FilterOperator.INCLUDES:
      return normalizedTitle.includes(normalizedPattern);
    case FilterOperator.NOT_INCLUDES:
      return !normalizedTitle.includes(normalizedPattern);
    default:
      return false;
  }
}

export function shouldMarkAsRead(rules: FilterRule[], title: string): boolean {
  const activeRules = rules.filter((rule) => rule.isActive);
  return activeRules.some((rule) => evaluateRule(rule, title));
}
