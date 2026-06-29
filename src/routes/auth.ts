import crypto from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  createUser,
  findUserByEmail,
  HttpError,
  patchCustomData,
  setPassword,
  verifyPassword,
} from '../lib/logto';
import { verifyGoogleIdToken } from '../lib/google';
import { sendResetCode } from '../lib/mailer';
import { issueToken, publicUser } from '../lib/jwt';
import { config } from '../config';

const RESET_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const authRoutes = new Hono();

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
  name: z.string().min(1).max(128).optional(),
});

/** POST /auth/register — create a Logto user, return session token. */
authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = credentials.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.flatten() }, 400);
  }
  const { email, password, name } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) {
    return c.json({ error: 'email_taken', message: 'Bu e-posta zaten kayıtlı' }, 409);
  }

  try {
    const user = await createUser({ email, password, name });
    const token = await issueToken(user);
    return c.json({ token, user: publicUser(user) }, 201);
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: 'register_failed', message: err.message }, err.status as 400);
    }
    throw err;
  }
});

/** POST /auth/login — verify password against Logto, return session token. */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = credentials.pick({ email: true, password: true }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.flatten() }, 400);
  }
  const { email, password } = parsed.data;

  const user = await findUserByEmail(email);
  if (!user) {
    return c.json({ error: 'invalid_credentials', message: 'E-posta veya şifre hatalı' }, 401);
  }

  const ok = await verifyPassword(user.id, password);
  if (!ok) {
    return c.json({ error: 'invalid_credentials', message: 'E-posta veya şifre hatalı' }, 401);
  }

  const token = await issueToken(user);
  return c.json({ token, user: publicUser(user) });
});

/**
 * POST /auth/forgot-password — generate a 6-digit reset code, store it on the
 * user (customData) with a 10-min expiry. Always returns 200 to avoid leaking
 * which emails exist. In dev mode the code is returned in the response.
 */
authRoutes.post('/forgot-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = z.string().email().safeParse(body?.email);
  if (!email.success) {
    return c.json({ error: 'invalid_input', message: 'Geçerli bir e-posta girin' }, 400);
  }

  const user = await findUserByEmail(email.data);
  if (!user) {
    // Same response shape regardless, so existence isn't leaked.
    return c.json({ ok: true });
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await patchCustomData(user.id, {
    passwordReset: { code, exp: Date.now() + RESET_TTL_MS },
  });

  try {
    await sendResetCode(email.data, code);
  } catch (err) {
    console.error('[reset] email send failed', err);
    return c.json(
      { error: 'email_failed', message: 'E-posta gönderilemedi, lütfen tekrar deneyin.' },
      502
    );
  }

  return c.json({
    ok: true,
    ...(config.dev.exposeResetCode ? { devCode: code } : {}),
  });
});

const resetSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
});

/** POST /auth/reset-password — verify the code and set a new password. */
authRoutes.post('/reset-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', issues: parsed.error.flatten() }, 400);
  }
  const { email, code, password } = parsed.data;

  const user = await findUserByEmail(email);
  const pr = (user?.customData as any)?.passwordReset as
    | { code: string; exp: number }
    | undefined;

  if (!user || !pr || pr.code !== code || Date.now() > pr.exp) {
    return c.json({ error: 'invalid_code', message: 'Kod geçersiz veya süresi dolmuş' }, 400);
  }

  await setPassword(user.id, password);
  await patchCustomData(user.id, { passwordReset: null });

  return c.json({ ok: true });
});

const googleSchema = z.object({ idToken: z.string().min(10) });

/**
 * POST /auth/google — verify a Google ID token, find-or-create the matching
 * Logto user (linked by email), and return a session token.
 */
authRoutes.post('/google', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = googleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', message: 'idToken gerekli' }, 400);
  }

  try {
    const profile = await verifyGoogleIdToken(parsed.data.idToken);

    let user = await findUserByEmail(profile.email);
    if (user) {
      // Link the Google identity on first Google login for an existing user.
      if (!(user.customData as any)?.googleSub) {
        await patchCustomData(user.id, { googleSub: profile.sub });
      }
    } else {
      user = await createUser({
        email: profile.email,
        name: profile.name,
        avatar: profile.picture,
        customData: { googleSub: profile.sub },
      });
    }

    const token = await issueToken(user);
    return c.json({ token, user: publicUser(user) });
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: 'google_auth_failed', message: err.message }, err.status as 400);
    }
    throw err;
  }
});
