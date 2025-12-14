import posthog from 'posthog-js';
import { environment } from '../environment';

posthog.init('phc_V6I0xn1Ptmx3QVqXzLNAK22H6D58kR3SJTYg1JdVEx', {
  api_host: 'https://eu.i.posthog.com',
  person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well

  // Enables session tracking across FE and BE
  __add_tracing_headers: [
    environment.apiUrl || '',
    'localhost:3000',
    'localhost:3001',
    '*',
    'localhost',
  ],
});
