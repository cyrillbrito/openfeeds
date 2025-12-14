import type { ReadStatus } from '../components/ReadStatusToggle';

export function validateReadStatusSearch(search: Record<string, unknown>): {
  readStatus?: ReadStatus;
  seed?: number;
} {
  return {
    readStatus: search?.readStatus as ReadStatus,
    seed: search?.seed ? Number(search?.seed) : undefined,
  };
}
