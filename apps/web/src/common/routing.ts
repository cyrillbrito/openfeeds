import type { ReadStatus } from '../components/ReadStatusToggle';

export type SortOrder = 'newest' | 'oldest';

export function validateReadStatusSearch(search: Record<string, unknown>): {
  readStatus?: ReadStatus;
  seed?: number;
  sort?: SortOrder;
} {
  return {
    readStatus: search?.readStatus as ReadStatus,
    seed: search?.seed ? Number(search?.seed) : undefined,
    sort: (search?.sort as SortOrder) || 'newest',
  };
}
