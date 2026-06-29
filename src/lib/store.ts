/**
 * Tiny JSON-file persistence (single-instance). Holds global Kp alerts,
 * per-user read pointers, device push tokens, and the dedup band state.
 * Good enough for this volume; swap for SQLite/Postgres if it grows.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'store.json');
const MAX_ALERTS = 50;

export type Alert = {
  id: string;
  kp: number;
  band: number;
  title: string;
  body: string;
  createdAt: number;
};

type Store = {
  alerts: Alert[];
  read: Record<string, number>; // userId -> lastReadAt (epoch ms)
  pushTokens: Record<string, string[]>; // userId -> FCM tokens
  alertState: { lastBand: number };
};

const EMPTY: Store = { alerts: [], read: {}, pushTokens: {}, alertState: { lastBand: 0 } };

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
  addAlert(input: Omit<Alert, 'id' | 'createdAt'>): Alert {
    const alert: Alert = { ...input, id: crypto.randomUUID(), createdAt: Date.now() };
    data.alerts.unshift(alert);
    if (data.alerts.length > MAX_ALERTS) data.alerts.length = MAX_ALERTS;
    persist();
    return alert;
  },

  listAlerts(limit = 30): Alert[] {
    return data.alerts.slice(0, limit);
  },

  unreadCount(userId: string): number {
    const since = data.read[userId] ?? 0;
    return data.alerts.filter((a) => a.createdAt > since).length;
  },

  markRead(userId: string) {
    data.read[userId] = Date.now();
    persist();
  },

  addPushToken(userId: string, token: string) {
    const list = data.pushTokens[userId] ?? [];
    if (!list.includes(token)) list.push(token);
    data.pushTokens[userId] = list;
    persist();
  },

  allPushTokens(): string[] {
    return Object.values(data.pushTokens).flat();
  },

  getLastBand(): number {
    return data.alertState.lastBand;
  },

  setLastBand(band: number) {
    data.alertState.lastBand = band;
    persist();
  },
};
