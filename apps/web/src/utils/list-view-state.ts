const listVisibleCountByKey = new Map<string, number>();

export function getListVisibleCount(key: string, fallback: number): number {
  return listVisibleCountByKey.get(key) ?? fallback;
}

export function setListVisibleCount(key: string, count: number): void {
  listVisibleCountByKey.set(key, count);
}
