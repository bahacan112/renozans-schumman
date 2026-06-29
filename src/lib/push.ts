/**
 * Firebase Cloud Messaging push sender (firebase-admin, modular SDK).
 *
 * Service account is loaded from (in order):
 *  1. FIREBASE_SERVICE_ACCOUNT_BASE64 env (base64 of the JSON) — for deploy
 *  2. ./serviceAccount.json file — for local dev
 * If neither is present, push is silently disabled (in-app inbox still works).
 */
import fs from 'node:fs';
import { cert, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let cached: App | null | undefined;

function getApp(): App | null {
  if (cached !== undefined) return cached;

  let sa: ServiceAccount | null = null;
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      sa = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
      );
    } else if (fs.existsSync('serviceAccount.json')) {
      sa = JSON.parse(fs.readFileSync('serviceAccount.json', 'utf8'));
    }
  } catch (err) {
    console.error('[push] failed to parse service account', err);
  }

  if (!sa) {
    console.warn('[push] no Firebase service account found — push disabled');
    cached = null;
    return null;
  }

  cached = initializeApp({ credential: cert(sa) });
  return cached;
}

export type PushResult = { sent: number; failed: number; invalidTokens: string[] };

export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, invalidTokens: [] };
  if (tokens.length === 0) return result;

  const app = getApp();
  if (!app) return result;

  const res = await getMessaging(app).sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    android: { priority: 'high', notification: { channelId: 'kp-alerts' } },
  });

  result.sent = res.successCount;
  result.failed = res.failureCount;
  res.responses.forEach((r, i) => {
    if (
      !r.success &&
      (r.error?.code === 'messaging/registration-token-not-registered' ||
        r.error?.code === 'messaging/invalid-argument' ||
        r.error?.code === 'messaging/invalid-registration-token')
    ) {
      result.invalidTokens.push(tokens[i]);
    }
  });
  return result;
}
