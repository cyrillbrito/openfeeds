import posthog from 'posthog-js';
import { env } from '../env';

posthog.init('phc_V6I0xn1Ptmx3QVqXzLNAK22H6D58kR3SJTYg1JdVEx', {
  api_host: 'https://eu.i.posthog.com',
  person_profiles: 'identified_only',

  // Enables session tracking across FE and BE
  __add_tracing_headers: [
    env.VITE_API_URL || '',
    'localhost:3000',
    'localhost:3001',
    '*',
    'localhost',
  ],
});
