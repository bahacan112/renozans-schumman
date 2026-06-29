import { sign, verify } from 'hono/jwt';
import { config } from '../config';
import type { LogtoUser } from './logto';

export type SessionClaims = {
  sub: string; // Logto user id
  email: string | null;
  exp: number;
};

export async function issueToken(user: Pick<LogtoUser, 'id' | 'primaryEmail'>): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + config.jwt.expiresIn;
  return sign({ sub: user.id, email: user.primaryEmail, exp }, config.jwt.secret, 'HS256');
}

export async function readToken(token: string): Promise<SessionClaims> {
  return (await verify(token, config.jwt.secret, 'HS256')) as unknown as SessionClaims;
}

/** Public-facing user shape returned to the mobile app. */
export function publicUser(user: LogtoUser) {
  return {
    id: user.id,
    email: user.primaryEmail,
    name: user.name,
    avatar: user.avatar,
    isPremium: Boolean((user.customData as any)?.isPremium),
  };
}
