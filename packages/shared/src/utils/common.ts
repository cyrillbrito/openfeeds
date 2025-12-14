/**
 * Async timeout utility for delaying execution
 * @param ms - Milliseconds to wait (should be positive)
 */
export function timeout(ms: number) {
  // Consider adding validation for negative values
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Creates a timer object to measure elapsed time
 */
export function startTimer() {
  const startTime = Bun.nanoseconds();
  return {
    elapsed: () => {
      const endTime = Bun.nanoseconds();
      return (endTime - startTime) / 1_000_000_000;
    },
  };
}

export function randomString() {
  return Math.random().toString(36).substring(2);
}

export function unwrapFn<T>(valueOrFn: T | (() => T)): T {
  return typeof valueOrFn === 'function' ? (valueOrFn as any)() : valueOrFn;
}
