/**
 * Internal trigger routes — called by n8n (not the app).
 * Secured by a shared secret header, NOT the user JWT.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { config } from '../config';
import { bandOf, alertContent } from '../lib/kpAlert';
import { fetchCurrentKp } from '../lib/noaa';
import { sendPush } from '../lib/push';
import { store } from '../lib/store';

export const internalRoutes = new Hono();

internalRoutes.use('*', async (c, next) => {
  if (c.req.header('X-Internal-Secret') !== config.internalSecret) {
    return c.json({ error: 'forbidden' }, 403);
  }
  await next();
});

/**
 * Core: create an in-app notification only on an UPWARD band crossing.
 * Band state follows kp down silently so a later rise re-alerts.
 */
async function processKp(kp: number) {
  const band = bandOf(kp);
  const lastBand = store.getLastBand();

  if (band <= lastBand) {
    if (band !== lastBand) store.setLastBand(band); // follow down silently
    return { created: false, kp, band, lastBand, reason: 'no upward crossing' };
  }

  const { title, body } = alertContent(kp, band);
  const alert = store.addAlert({ kp, band, title, body });
  store.setLastBand(band);

  // Push to all registered devices (app-closed delivery).
  const push = await sendPush(store.allPushTokens(), title, body, {
    kp: String(kp),
    band: String(band),
  }).catch((err) => {
    console.error('[push] send failed', err);
    return { sent: 0, failed: 0, invalidTokens: [] as string[] };
  });
  if (push.invalidTokens.length) store.removePushTokens(push.invalidTokens);

  return { created: true, kp, band, alert, push: { sent: push.sent, failed: push.failed } };
}

const kpSchema = z.object({ kp: z.number().min(0).max(15) });

/** POST /internal/kp-alert { kp } — manual trigger / testing. */
internalRoutes.post('/kp-alert', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = kpSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', message: 'kp (0-15) gerekli' }, 400);
  }
  return c.json(await processKp(parsed.data.kp));
});

/**
 * POST /internal/kp-poll — fetches the current Kp from NOAA and runs the
 * alert logic. n8n calls this on a schedule (e.g. every 30 min).
 */
internalRoutes.post('/kp-poll', async (c) => {
  let kp: number;
  try {
    kp = await fetchCurrentKp();
  } catch (err) {
    console.error('[kp-poll] NOAA fetch failed', err);
    return c.json({ error: 'noaa_failed', message: String(err) }, 502);
  }
  return c.json(await processKp(kp));
});
