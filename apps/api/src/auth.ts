import { createAuth, type AuthSession } from '@repo/auth';

// Elysia mounts `auth.handler` directly, which carries Set-Cookie natively.
// No framework cookie plugin needed.
export const auth = createAuth();

export type { AuthSession };
