/**
 * Extract error message from Elysia error responses
 */
export function getErrorMessage(error: any): string {
  if (typeof error?.value === 'object' && error.value && 'message' in error.value) {
    return error.value.message as string;
  }
  if (typeof error?.value === 'string') {
    return error.value;
  }
  return 'Request failed';
}

/**
 * Generate negative temp ID for optimistic inserts
 */
export function generateTempId(): number {
  return -(Math.floor(Math.random() * 1000000) + 1);
}
