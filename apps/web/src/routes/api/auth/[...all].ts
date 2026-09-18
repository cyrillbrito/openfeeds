// Every Better Auth route: sign-in, sign-up, sign-out, OAuth redirect and
// callback, session reads. Better Auth routes internally off the pathname,
// so this is one catch-all.
//
// `toSolidStartHandler` returns `(event: { request: Request }) => Response`
// functions, which is the APIEvent shape filesystem-routing dispatches.
// `Set-Cookie` is on the returned Response.
import { toSolidStartHandler } from 'better-auth/solid-start';

import { auth } from '../../../server/auth';

export const { GET, POST } = toSolidStartHandler(auth);
