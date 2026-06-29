/**
 * Verifies Google ID tokens (from the mobile native Google Sign-In SDK).
 * The token's audience must equal our Web Client ID.
 */
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { HttpError } from './logto';

const client = new OAuth2Client();

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: config.google.webClientId,
    });
  } catch {
    throw new HttpError(401, 'Geçersiz Google oturumu');
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new HttpError(401, 'Google token doğrulanamadı');
  }
  if (!payload.email) {
    throw new HttpError(400, 'Google hesabında e-posta bulunamadı');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name,
    picture: payload.picture,
  };
}
