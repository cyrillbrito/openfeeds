const listVisibleCountByKey = new Map<string, number>();
const listScrollYByKey = new Map<string, number>();
const listAnchorByKey = new Map<string, { articleId: string; delta: number }>();

export function getListVisibleCount(key: string, fallback: number): number {
  return listVisibleCountByKey.get(key) ?? fallback;
}

export function setListVisibleCount(key: string, count: number): void {
  listVisibleCountByKey.set(key, count);
}

export function getListScrollY(key: string): number | null {
  return listScrollYByKey.get(key) ?? null;
}

export function setListScrollY(key: string, scrollY: number): void {
  listScrollYByKey.set(key, Math.max(0, Math.floor(scrollY)));
}

export function getListAnchor(key: string): { articleId: string; delta: number } | null {
  return listAnchorByKey.get(key) ?? null;
}

export function setListAnchor(key: string, articleId: string, delta: number): void {
  listAnchorByKey.set(key, { articleId, delta });
}
