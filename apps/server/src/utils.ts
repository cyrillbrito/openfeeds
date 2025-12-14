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

/** From: https://github.com/toss/es-toolkit/blob/main/src/util/attempt.ts */
export function attempt<T, E = Error>(func: () => T): [null, T] | [E, null] {
  try {
    return [null, func()];
  } catch (error) {
    return [error as E, null];
  }
}

/**
 * Similar to https://github.com/toss/es-toolkit/blob/main/src/util/attemptAsync.ts
 * Inspiration https://www.youtube.com/watch?v=Y6jT-IkV0VM
 */
export async function attemptAsync<T, E = Error>(
  promise: Promise<T>,
): Promise<[null, T] | [E, null]> {
  try {
    const result = await promise;
    return [null, result];
  } catch (error) {
    return [error as E, null];
  }
}

/**
 * Async function wrapper that eliminates the need for immediately invoked async functions (IIFE)
 * when using attemptAsync. Accepts an async function and returns the same error/result tuple.
 */
export async function attemptAsyncFn<T, E = Error>(
  fn: () => Promise<T>,
): Promise<[null, T] | [E, null]> {
  try {
    const result = await fn();
    return [null, result];
  } catch (error) {
    return [error as E, null];
  }
}
