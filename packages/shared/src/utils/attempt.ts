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

/**
 * Attempts to parse JSON string safely without throwing
 * @returns Tuple of [error, null] or [null, parsed result]
 */
export function attemptParse<T>(json: string): [null, T] | [SyntaxError, null] {
  try {
    return [null, JSON.parse(json)];
  } catch (error) {
    return [error as SyntaxError, null];
  }
}

export function attemptStringify(value: unknown): [null, string] | [TypeError, null] {
  try {
    return [null, JSON.stringify(value)];
  } catch (error) {
    return [error as TypeError, null];
  }
}
