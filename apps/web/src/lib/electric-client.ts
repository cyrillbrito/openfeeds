/**
 * Returns the full URL for an Electric shape endpoint.
 * In the browser, constructs absolute URL from window.location.
 * On the server, returns the path as-is.
 */
export function getShapeUrl(model: string): string {
  const path = `/api/shapes/${model}`;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return path;
}
