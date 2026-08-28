/**
 * Excel katagi formula/havola/sana bo'lishi mumkin — hammasi matnga
 * keltiriladi. Alohida faylda turadi, chunki bir xil mantiq ikki joyda
 * kerak: serverdagi XLSX->CSV aylantirish va brauzerdagi katta fayl
 * o'qish (rasmli import).
 */
export function katakMatn(qiymat: unknown): string {
  if (qiymat === null || qiymat === undefined) return "";
  if (typeof qiymat === "object") {
    const o = qiymat as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
    if (qiymat instanceof Date) return qiymat.toISOString().slice(0, 10);
    return "";
  }
  return String(qiymat);
}
