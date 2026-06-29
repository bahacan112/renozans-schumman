/**
 * Logto Management API client driven by the M2M (client_credentials) app.
 * Caches the access token in-memory and refreshes shortly before expiry.
 */
import { config } from '../config';

const { endpoint, mgmtResource, clientId, clientSecret } = config.logto;

export type LogtoUser = {
  id: string;
  username: string | null;
  primaryEmail: string | null;
  name: string | null;
  avatar: string | null;
  customData: Record<string, unknown>;
  isSuspended?: boolean;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getMgmtToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${endpoint}/oidc/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      resource: mgmtResource,
      scope: 'all',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Logto token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return data.access_token;
}

async function mgmt<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; data: T }> {
  const token = await getMgmtToken();
  const res = await fetch(`${endpoint}/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const status = res.status;
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status, data: data as T };
}

/**
 * Create a user. `password` is optional so social (Google) users can be
 * created without one.
 */
export async function createUser(input: {
  email: string;
  password?: string;
  name?: string;
  avatar?: string;
  customData?: Record<string, unknown>;
}): Promise<LogtoUser> {
  const { status, data } = await mgmt<LogtoUser & { code?: string; message?: string }>(
    '/users',
    {
      method: 'POST',
      body: JSON.stringify({
        primaryEmail: input.email,
        ...(input.password ? { password: input.password } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.avatar ? { avatar: input.avatar } : {}),
        ...(input.customData ? { customData: input.customData } : {}),
      }),
    }
  );
  if (status >= 400) {
    throw new HttpError(status === 422 ? 409 : status, (data as any)?.message || 'create_user_failed');
  }
  return data;
}

/** Find a user by exact primary email (case-insensitive). Returns null if none. */
export async function findUserByEmail(email: string): Promise<LogtoUser | null> {
  const q = new URLSearchParams({
    page: '1',
    page_size: '20',
    search: email,
  });
  const { data } = await mgmt<LogtoUser[]>(`/users?${q.toString()}`);
  if (!Array.isArray(data)) return null;
  const target = email.toLowerCase();
  return data.find((u) => (u.primaryEmail || '').toLowerCase() === target) ?? null;
}

export async function getUser(userId: string): Promise<LogtoUser | null> {
  const { status, data } = await mgmt<LogtoUser>(`/users/${userId}`);
  if (status === 404) return null;
  if (status >= 400) throw new HttpError(status, 'get_user_failed');
  return data;
}

/** Verify a user's password via Logto. Returns true on match. */
export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  const { status } = await mgmt(`/users/${userId}/password/verify`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (status === 204) return true;
  if (status === 422 || status === 400) return false;
  throw new HttpError(status, 'verify_password_failed');
}

/** Set a user's password via the Management API. */
export async function setPassword(userId: string, password: string): Promise<void> {
  const { status } = await mgmt(`/users/${userId}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  });
  if (status >= 400) throw new HttpError(status, 'set_password_failed');
}

/** Read/modify/write the user's customData (preserves other keys). */
export async function patchCustomData(
  userId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const user = await getUser(userId);
  if (!user) throw new HttpError(404, 'user_not_found');
  const merged = { ...(user.customData || {}), ...patch };
  const { status, data } = await mgmt<{ customData: Record<string, unknown> }>(
    `/users/${userId}`,
    { method: 'PATCH', body: JSON.stringify({ customData: merged }) }
  );
  if (status >= 400) throw new HttpError(status, 'patch_custom_data_failed');
  return (data as any).customData ?? merged;
}

/** Small typed error carrying an HTTP status for the route layer. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
