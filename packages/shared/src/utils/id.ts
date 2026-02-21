import { uuidv7 } from 'uuidv7';

export function createId(): string {
  return uuidv7();
}
