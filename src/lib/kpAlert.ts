/**
 * Kp alert banding + content.
 *
 * Bands (a user picks which ones they want notifications for):
 *   band 0: Kp < 3      -> Sakin (no alert)
 *   band 1: 3 <= Kp < 5 -> Hareketlenme
 *   band 2: 5 <= Kp < 7 -> Fırtına
 *   band 3: Kp >= 7     -> Portal
 *
 * Auto alerts (from NOAA poll) still fire only on an UPWARD band crossing to
 * avoid spam; per-user preferences then decide who receives each band.
 */
export const ALERT_BANDS = [1, 2, 3] as const;
export type AlertBand = (typeof ALERT_BANDS)[number];

export function bandOf(kp: number): number {
  if (kp >= 7) return 3;
  if (kp >= 5) return 2;
  if (kp >= 3) return 1;
  return 0;
}

export function bandLabel(band: number): string {
  if (band >= 3) return 'Portal (Kp 7+)';
  if (band === 2) return 'Fırtına (Kp 5-7)';
  if (band === 1) return 'Hareketlenme (Kp 3-5)';
  return 'Sakin';
}

export function alertContent(kp: number, band: number): { title: string; body: string } {
  if (band >= 3) {
    return {
      title: '🌀 Portal Geçişi Aktif',
      body: `Kp ${kp.toFixed(1)} — yoğun ışık kodları. Portal geçiş penceresi açıldı.`,
    };
  }
  if (band === 2) {
    return {
      title: '⚠️ Jeomanyetik Fırtına Başladı',
      body: `Kp ${kp.toFixed(1)} — kozmik akış yükseldi, fırtına penceresi açıldı.`,
    };
  }
  return {
    title: '🌌 Enerji Hareketlendi',
    body: `Kp ${kp.toFixed(1)} — manyetik alanda aktiflik ve hafif duyarlılık başladı.`,
  };
}
