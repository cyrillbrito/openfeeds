export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  autoArchiveDays: number;
}

export const defaultSettings: AppSettings = {
  theme: 'system',
  autoArchiveDays: 30,
};

export interface ArchiveResult {
  markedCount: number;
  cutoffDate: string;
}
