import { ulid } from 'ulid';

export function createId(): string {
  return ulid();
}
