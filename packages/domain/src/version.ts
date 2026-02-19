let appVersion = 'dev';

export function setAppVersion(version: string): void {
  appVersion = version;
}

export function getAppVersion(): string {
  return appVersion;
}
