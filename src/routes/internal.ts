/**
 * Internal trigger routes — called by n8n (not the app).
 * Secured by a shared secret header, NOT the user JWT.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { config } from '../config';
import { bandOf, alertContent } from '../lib/kpAlert';
import { store } from '../lib/store';

export const internalRoutes = new Hono();

internalRoutes.use('*', async (c, next) => {
  if (c.req.header('X-Internal-Secret') !== config.internalSecret) {
    return c.json({ error: 'forbidden' }, 403);
  }
  await next();
});

const kpSchema = z.object({ kp: z.number().min(0).max(15) });

/**
 * POST /internal/kp-alert  { kp }
 * Creates an in-app notification only on an UPWARD band crossing. The band
 * state follows kp down silently so a later rise re-alerts. Returns whether
 * a notification was created.
 */
internalRoutes.post('/kp-alert', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = kpSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', message: 'kp (0-15) gerekli' }, 400);
  }
  const { kp } = parsed.data;

  const band = bandOf(kp);
  const lastBand = store.getLastBand();

  if (band <= lastBand) {
    // same band or dropping — update silently, no notification
    if (band !== lastBand) store.setLastBand(band);
    return c.json({ created: false, band, lastBand, reason: 'no upward crossing' });
  }

  // upward crossing -> alert
  const { title, body: text } = alertContent(kp, band);
  const alert = store.addAlert({ kp, band, title, body: text });
  store.setLastBand(band);

  // TODO (Phase 2): push to store.allPushTokens() via FCM.

  return c.json({ created: true, band, alert });
});
