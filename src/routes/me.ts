import { Hono } from 'hono';
import { z } from 'zod';
import { authGuard } from '../middleware/auth';
import { getUser, patchCustomData } from '../lib/logto';
import { publicUser } from '../lib/jwt';
import { store } from '../lib/store';

export const meRoutes = new Hono();

meRoutes.use('*', authGuard);

/** GET /me/notifications — in-app inbox (filtered by the user's band prefs). */
meRoutes.get('/notifications', (c) => {
  const { sub } = c.get('session');
  return c.json({ items: store.listAlerts(sub, 30), unreadCount: store.unreadCount(sub) });
});

/** GET /me/prefs — which Kp bands the user wants notifications for. */
meRoutes.get('/prefs', (c) => {
  const { sub } = c.get('session');
  return c.json({ bands: store.getPrefs(sub) });
});

/** PUT /me/prefs { bands:number[] } — set notification band preferences. */
meRoutes.put('/prefs', async (c) => {
  const { sub } = c.get('session');
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ bands: z.array(z.number().int().min(0).max(3)).max(5) }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);
  store.setPrefs(sub, parsed.data.bands);
  return c.json({ bands: store.getPrefs(sub) });
});

/** POST /me/notifications/read — mark the inbox as read (now). */
meRoutes.post('/notifications/read', (c) => {
  const { sub } = c.get('session');
  store.markRead(sub);
  return c.json({ ok: true });
});

/** POST /me/push-token — register an FCM device token (used in Phase 2). */
meRoutes.post('/push-token', async (c) => {
  const { sub } = c.get('session');
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ token: z.string().min(10) }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);
  store.addPushToken(sub, parsed.data.token);
  return c.json({ ok: true });
});

/** GET /me — current user profile + premium status. */
meRoutes.get('/', async (c) => {
  const { sub } = c.get('session');
  const user = await getUser(sub);
  if (!user) return c.json({ error: 'user_not_found' }, 404);
  return c.json({ user: publicUser(user) });
});

/**
 * POST /me/premium — activate premium for the current user.
 * Mirrors the app's "purchase" action; in production wire this to a
 * payment/IAP webhook instead of trusting the client.
 */
meRoutes.post('/premium', async (c) => {
  const { sub } = c.get('session');
  await patchCustomData(sub, { isPremium: true, premiumSince: new Date().toISOString() });
  const user = await getUser(sub);
  if (!user) return c.json({ error: 'user_not_found' }, 404);
  return c.json({ user: publicUser(user) });
});

/** DELETE /me/premium — deactivate premium (useful for testing). */
meRoutes.delete('/premium', async (c) => {
  const { sub } = c.get('session');
  await patchCustomData(sub, { isPremium: false });
  const user = await getUser(sub);
  if (!user) return c.json({ error: 'user_not_found' }, 404);
  return c.json({ user: publicUser(user) });
});
