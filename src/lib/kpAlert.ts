/**
 * Kp alert banding + content. Alerts fire only on an UPWARD band crossing
 * (handled by the caller via store.getLastBand/setLastBand) to avoid spam.
 *
 * band 0: Kp < 5   -> no alert
 * band 1: 5 <= Kp < 7  -> geomagnetic storm started
 * band 2: Kp >= 7  -> portal / intense
 */
export function bandOf(kp: number): number {
  if (kp >= 7) return 2;
  if (kp >= 5) return 1;
  return 0;
}

export function alertContent(kp: number, band: number): { title: string; body: string } {
  if (band >= 2) {
    return {
      title: '🌀 Portal Geçişi Aktif',
      body: `Kp ${kp.toFixed(1)} — yoğun ışık kodları. Portal geçiş penceresi açıldı.`,
    };
  }
  return {
    title: '⚠️ Jeomanyetik Fırtına Başladı',
    body: `Kp ${kp.toFixed(1)} — kozmik akış yükseldi, fırtına penceresi açıldı.`,
  };
}
