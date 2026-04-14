import { captureException, UnexpectedError } from '@repo/domain';
import { getRequestHeaders } from '@tanstack/solid-start/server';
import { auth } from '~/server/auth.server';

export async function hasSession(): Promise<boolean> {
  const headers = getRequestHeaders();
  try {
    const session = await auth.api.getSession({ headers });
    return !!session;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    captureException(err, { source: 'auth-guard', type: 'getSession' });
    throw new UnexpectedError();
  }
}
