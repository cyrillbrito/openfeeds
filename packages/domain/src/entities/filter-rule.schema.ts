import { z } from 'zod';

export const FilterOperator = {
  INCLUDES: 'includes',
  NOT_INCLUDES: 'not_includes',
} as const;

export const FilterRuleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  feedId: z.string(),
  pattern: z.string().min(1),
  operator: z.enum([FilterOperator.INCLUDES, FilterOperator.NOT_INCLUDES]),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
});
export type FilterRule = z.infer<typeof FilterRuleSchema>;

export const CreateFilterRuleSchema = z.object({
  id: z.string().optional(),
  feedId: z.string(),
  pattern: z.string().min(1),
  operator: z.enum([FilterOperator.INCLUDES, FilterOperator.NOT_INCLUDES]),
  isActive: z.boolean(),
});
export type CreateFilterRule = z.infer<typeof CreateFilterRuleSchema>;

export const UpdateFilterRuleSchema = z.object({
  pattern: z.string().min(1).optional(),
  operator: z.enum([FilterOperator.INCLUDES, FilterOperator.NOT_INCLUDES]).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateFilterRule = z.infer<typeof UpdateFilterRuleSchema>;

/** Minimal shape needed for rule evaluation — works with both API and DB types */
export interface EvaluableRule {
  pattern: string;
  operator: string;
  isActive: boolean;
}

export function evaluateRule(rule: EvaluableRule, title: string): boolean {
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

export function shouldMarkAsRead(rules: EvaluableRule[], title: string): boolean {
  const activeRules = rules.filter((rule) => rule.isActive);
  return activeRules.some((rule) => evaluateRule(rule, title));
}
