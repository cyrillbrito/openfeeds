/**
 * Settings as stored in DB.
 * autoArchiveDays is nullable - null means "use app default".
 */
export interface Settings {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  /** null = use app default */
  autoArchiveDays: number | null;
}

/** App-level default for autoArchiveDays */
export const DEFAULT_AUTO_ARCHIVE_DAYS = 30;

/** Get effective autoArchiveDays value (with default applied) */
export function getEffectiveAutoArchiveDays(settings: Settings): number {
  return settings.autoArchiveDays ?? DEFAULT_AUTO_ARCHIVE_DAYS;
}

/** Check if autoArchiveDays is using app default */
export function isAutoArchiveDaysDefault(settings: Settings): boolean {
  return settings.autoArchiveDays === null;
}

export interface ArchiveResult {
  markedCount: number;
  cutoffDate: string;
}
