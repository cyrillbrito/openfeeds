import type { ReadStatus } from '~/components/articles/ReadStatusToggle';

export type SortOrder = 'newest' | 'oldest';

export function validateReadStatusSearch(search: Record<string, unknown>): {
  readStatus?: ReadStatus;
  sort?: SortOrder;
} {
  return {
    readStatus: search?.readStatus as ReadStatus,
    sort: (search?.sort as SortOrder) || 'newest',
  };
}
