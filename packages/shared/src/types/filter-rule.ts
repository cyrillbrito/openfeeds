import type { z } from 'zod';
import type {
  createFilterRuleApiSchema,
  createFilterRuleSchema,
  filterRuleSchema,
  updateFilterRuleSchema,
} from '../schemas/filter-rule';

export type FilterRule = z.infer<typeof filterRuleSchema>;
export type CreateFilterRule = z.infer<typeof createFilterRuleSchema>;
export type CreateFilterRuleApi = z.infer<typeof createFilterRuleApiSchema>;
export type UpdateFilterRule = z.infer<typeof updateFilterRuleSchema>;

export { FilterOperator } from '../schemas/filter-rule';
