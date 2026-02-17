import posthog from 'posthog-js';

export function initPosthog(key: string) {
  posthog.init(key, {
    api_host: 'https://ph.openfeeds.app',
    ui_host: 'https://eu.posthog.com',
    person_profiles: 'identified_only',
    capture_exceptions: true,
  });

  posthog.register({ app: 'web', app_version: __APP_VERSION__ });
}
