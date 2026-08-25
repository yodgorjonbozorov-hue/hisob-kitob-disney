import type { XodimDTO } from "@/lib/queries/xodimlar";

/** Foydalanuvchilar sahifasining umumiy turlari va matnlari. */

export interface BusinessOption {
  id: string;
  nomi: string;
}

/** "Rollar va huquqlar" modulidan kelgan maxsus rol (PRO tarif). */
export interface MaxsusRol {
  id: string;
  nomi: string;
  izoh: string | null;
}

/**
 * Rol tanlagichdagi bitta variant.
 *
 * `qiymat` — tizim roli ("OWNER" | "CASHIER" | "SELLER") YOKI "custom:<roleId>".
 * Ikkalasi bitta satrda saqlanadi, chunki tanlagich uchun bu bitta savol:
 * "bu odam kim?". Serverga yuborishda `rolBody()` uni ikkiga ajratadi.
 */
export interface RolVariant {
  qiymat: string;
  nomi: string;
  izoh: string;
}

/**
 * TIZIM ROLLARI — izohlar HUQUQ RO'YXATI EMAS, odam tilidagi tavsif.
 * Haqiqiy huquqlar `lib/permissions/` da; bu yerda ularni takrorlash
 * ikkita manba yaratardi va ular vaqt o'tib bir-biridan uzoqlashardi.
 */
export const TIZIM_ROLLARI: RolVariant[] = [
  { qiymat: "CASHIER", nomi: "Kassir", izoh: "Kassa va kundalik moliyaviy ishlar." },
  { qiymat: "SELLER", nomi: "Sotuvchi", izoh: "Savdo, mijozlar va qarzlar bilan ishlaydi." },
  { qiymat: "OWNER", nomi: "Direktor", izoh: "Barcha bo'limlarni va xodimlarni boshqaradi." },
];

/** Tanlagich uchun to'liq variantlar ro'yxati (tizim + maxsus rollar). */
export function rolVariantlari(maxsus: MaxsusRol[]): RolVariant[] {
  return [
    ...TIZIM_ROLLARI,
    ...maxsus.map((r) => ({
      qiymat: `custom:${r.id}`,
      nomi: r.nomi,
      izoh: r.izoh ?? "Maxsus rol — huquqlari «Rollar va huquqlar» bo'limida.",
    })),
  ];
}

/**
 * Tahrirlash oynasi uchun variantlar — xodimning JORIY roli doim ro'yxatda.
 *
 * Tarif PRO dan tushsa maxsus rollar ro'yxati bo'shab qoladi, xodimda esa
 * o'sha rol qolgan bo'ladi. Uni ro'yxatga qo'shmasak, tanlagichda hech narsa
 * belgilanmagan ko'rinadi va direktor bilmasdan rolni almashtirib yuboradi.
 */
export function rolVariantlariXodimUchun(maxsus: MaxsusRol[], xodim: XodimDTO): RolVariant[] {
  const royxat = rolVariantlari(maxsus);
  const joriy = xodimRolQiymati(xodim);
  if (royxat.some((v) => v.qiymat === joriy)) return royxat;
  return [
    ...royxat,
    { qiymat: joriy, nomi: xodim.rolNomi, izoh: "Xodimning joriy roli." },
  ];
}

/** Xodimning joriy rol qiymati (maxsus rol ustun turadi). */
export function xodimRolQiymati(x: XodimDTO): string {
  return x.roleId ? `custom:${x.roleId}` : x.rol;
}

/** Rol qiymatini API tanaga aylantiradi: maxsus rolmi yoki tizim rolimi. */
export function rolBody(qiymat: string): { rol?: string; roleId: string | null } {
  return qiymat.startsWith("custom:")
    ? { roleId: qiymat.slice(7) }
    : { rol: qiymat, roleId: null };
}

/**
 * Biznes ustuni matni.
 *
 * Bo'sh ro'yxat "biriktirilmagan" degani — ya'ni cheklov yo'q. Buni "—" deb
 * ko'rsatish chalg'itardi (xodim hech qayerda ishlamaydigandek), shuning
 * uchun ochiq yozamiz: "Barcha bizneslar".
 */
export function biznesMatni(x: XodimDTO): string {
  if (x.bizneslar.length === 0) return "Barcha bizneslar";
  if (x.bizneslar.length === 1) return x.bizneslar[0].nomi;
  return `${x.bizneslar.length} ta biznes`;
}

export type { XodimDTO };
