import { FilterOperator, type FilterRule } from '../types/filter-rule';

// todo why is this code shared?

export const evaluateRule = (rule: FilterRule, title: string): boolean => {
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
};

export const shouldMarkAsRead = (rules: FilterRule[], title: string): boolean => {
  const activeRules = rules.filter((rule) => rule.isActive);
  return activeRules.some((rule) => evaluateRule(rule, title));
};
