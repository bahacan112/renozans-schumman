/**
 * Tiny JSON-file persistence (single-instance). Holds global Kp alerts,
 * per-user notification preferences, read pointers, and device push tokens.
 * Good enough for this volume; swap for SQLite/Postgres if it grows.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ALERT_BANDS } from './kpAlert';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'store.json');
const MAX_ALERTS = 100;

const DEFAULT_BANDS = [...ALERT_BANDS]; // all bands on by default

export type Alert = {
  id: string;
  kp: number;
  band: number;
  title: string;
  body: string;
  createdAt: number;
};

type Store = {
  alerts: Alert[]; // global log; per-user views are filtered by prefs
  prefs: Record<string, number[]>; // userId -> bands they want
  read: Record<string, number>; // userId -> lastReadAt (epoch ms)
  pushTokens: Record<string, string[]>; // userId -> FCM tokens
  alertState: { lastBand: number };
};

const EMPTY: Store = { alerts: [], prefs: {}, read: {}, pushTokens: {}, alertState: { lastBand: 0 } };

function load(): Store {
  try {
    return { ...EMPTY, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch {
    return structuredClone(EMPTY);
  }
}

const data = load();

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export const store = {
  // --- preferences ---
  getPrefs(userId: string): number[] {
    return data.prefs[userId] ?? [...DEFAULT_BANDS];
  },
  setPrefs(userId: string, bands: number[]) {
    data.prefs[userId] = [...new Set(bands)].filter((b) => (ALERT_BANDS as readonly number[]).includes(b));
    persist();
  },

  // --- alerts ---
  addAlert(input: Omit<Alert, 'id' | 'createdAt'>): Alert {
    const alert: Alert = { ...input, id: crypto.randomUUID(), createdAt: Date.now() };
    data.alerts.unshift(alert);
    if (data.alerts.length > MAX_ALERTS) data.alerts.length = MAX_ALERTS;
    persist();
    return alert;
  },

  /** Alerts visible to a user = global alerts whose band is in the user's prefs. */
  listAlerts(userId: string, limit = 30): Alert[] {
    const bands = this.getPrefs(userId);
    return data.alerts.filter((a) => bands.includes(a.band)).slice(0, limit);
  },

  unreadCount(userId: string): number {
    const since = data.read[userId] ?? 0;
    const bands = this.getPrefs(userId);
    return data.alerts.filter((a) => bands.includes(a.band) && a.createdAt > since).length;
  },

  markRead(userId: string) {
    data.read[userId] = Date.now();
    persist();
  },

  // --- push tokens ---
  addPushToken(userId: string, token: string) {
    const list = data.pushTokens[userId] ?? [];
    if (!list.includes(token)) list.push(token);
    data.pushTokens[userId] = list;
    persist();
  },

  /** Tokens of users whose prefs include the given band (push targeting). */
  tokensForBand(band: number): string[] {
    const out: string[] = [];
    for (const [uid, tokens] of Object.entries(data.pushTokens)) {
      if (this.getPrefs(uid).includes(band)) out.push(...tokens);
    }
    return [...new Set(out)];
  },

  removePushTokens(tokens: string[]) {
    const dead = new Set(tokens);
    for (const uid of Object.keys(data.pushTokens)) {
      data.pushTokens[uid] = data.pushTokens[uid].filter((t) => !dead.has(t));
    }
    persist();
  },

  // --- dedup band state ---
  getLastBand(): number {
    return data.alertState.lastBand;
  },
  setLastBand(band: number) {
    data.alertState.lastBand = band;
    persist();
  },
};
