/**
 * SO'ROV PARAMETRLARINI XAVFSIZ O'QISH.
 *
 * Barcha ro'yxat endpointlari bir xil qoidaga tayanadi: bo'sh satr — filtr
 * YO'Q (null), noto'g'ri sana — filtr YO'Q. Bu yerda markazlashtirilmasa,
 * har route o'z qoidasini yozardi va ular bir-biridan farq qilib ketardi.
 */

export function matn(params: URLSearchParams, kalit: string): string | null {
  const v = params.get(kalit);
  if (v == null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export function sana(params: URLSearchParams, kalit: string): Date | null {
  const v = matn(params, kalit);
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function mantiq(params: URLSearchParams, kalit: string): boolean | null {
  const v = matn(params, kalit);
  if (v == null) return null;
  if (v === "ha" || v === "true" || v === "1") return true;
  if (v === "yoq" || v === "false" || v === "0") return false;
  return null;
}

export function son(params: URLSearchParams, kalit: string): number | null {
  const v = matn(params, kalit);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
