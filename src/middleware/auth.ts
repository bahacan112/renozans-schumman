import type { Context, Next } from 'hono';
import { readToken, type SessionClaims } from '../lib/jwt';

declare module 'hono' {
  interface ContextVariableMap {
    session: SessionClaims;
  }
}

/** Requires a valid backend-issued Bearer JWT; attaches claims to context. */
export async function authGuard(c: Context, next: Next) {
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return c.json({ error: 'unauthorized', message: 'Missing bearer token' }, 401);
  }
  try {
    const claims = await readToken(token);
    c.set('session', claims);
    await next();
  } catch {
    return c.json({ error: 'unauthorized', message: 'Invalid or expired token' }, 401);
  }
}
