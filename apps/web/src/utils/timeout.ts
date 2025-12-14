export function timeout(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
