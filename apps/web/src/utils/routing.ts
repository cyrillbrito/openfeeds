import type { ReadStatus } from '~/components/ReadStatusToggle';

export type SortOrder = 'newest' | 'oldest';

export function validateReadStatusSearch(search: Record<string, unknown>): {
  readStatus?: ReadStatus;
  sort?: SortOrder;
} {
  return {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    readStatus: search?.readStatus as ReadStatus,
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    sort: (search?.sort as SortOrder) || 'newest',
  };
}
