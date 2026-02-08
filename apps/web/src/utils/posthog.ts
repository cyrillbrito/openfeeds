import posthog from 'posthog-js';

export function initPosthog(key: string) {
  posthog.init(key, {
    api_host: 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
  });

  posthog.register({ app: 'web' });
}
