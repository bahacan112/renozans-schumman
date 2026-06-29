/**
 * Fetches the current geomagnetic Kp from NOAA SWPC (planetary K-index forecast).
 * The endpoint returns an array of objects:
 *   { time_tag: "2026-06-22T00:00:00", kp: 1.33, observed: "observed"|"predicted", noaa_scale: null }
 * We return the latest observed/estimated value (<= now).
 */
const NOAA_URL =
  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';

type NoaaItem = { time_tag: string; kp: number | string; observed?: string };

const asUtc = (t: string) => (t.endsWith('Z') ? t : t + 'Z');

export async function fetchCurrentKp(): Promise<number> {
  const res = await fetch(NOAA_URL);
  if (!res.ok) throw new Error(`NOAA error ${res.status}`);
  const list = (await res.json()) as NoaaItem[];

  const items = list.filter(
    (o) => o && typeof o === 'object' && !Array.isArray(o) && o.kp !== undefined
  );
  if (items.length === 0) throw new Error('NOAA empty');

  const now = Date.now();
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const t = new Date(asUtc(it.time_tag)).getTime();
    if ((it.observed === 'observed' || it.observed === 'estimated') && t <= now) {
      const kp = Number(it.kp);
      if (!Number.isNaN(kp)) return kp;
    }
  }

  const kp = Number(items[items.length - 1].kp);
  if (Number.isNaN(kp)) throw new Error('NOAA unparseable');
  return kp;
}
