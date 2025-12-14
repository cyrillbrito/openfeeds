export function randomString() {
  return Math.random().toString(36).substring(2);
}

export function unwrapFn<T>(valueOrFn: T | (() => T)): T {
  return typeof valueOrFn === 'function' ? (valueOrFn as any)() : valueOrFn;
}
