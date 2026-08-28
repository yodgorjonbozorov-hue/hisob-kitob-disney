/**
 * GEOGRAFIK MASOFA — Haversine formulasi (sof funksiya, testlanadigan).
 * Server tomonda ish joyi radiusini tekshirish uchun; frontend tekshiruviga
 * hech qachon ishonilmaydi.
 */

const YER_RADIUSI_M = 6_371_000;

/** Ikki nuqta orasidagi masofa (metr, butun songa yaxlitlangan). */
export function masofaM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(YER_RADIUSI_M * c);
}
