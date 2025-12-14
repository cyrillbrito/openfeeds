import { treaty } from '@elysiajs/eden';
import type { apiApp } from '@repo/server/types';
import { environment } from '../environment';

let apiInstance: ReturnType<typeof treaty<typeof apiApp>>['api'];

export function useApi() {
  if (!apiInstance) {
    apiInstance = treaty<typeof apiApp>(environment.apiUrl || window.location.origin, {
      fetch: {
        credentials: 'include',
      },
    }).api;
  }
  return apiInstance;
}
