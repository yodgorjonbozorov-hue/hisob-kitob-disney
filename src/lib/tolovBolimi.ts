import type { Prisma } from "@prisma/client";

/**
 * PUL OQIMINING TO'LOV BO'LIMLARI — "Jami kirim/chiqim" kartasi ichidagi
 * taqsimot.
 *
 * MODEL HAQIQATI (qotirilgan ro'yxat emas, shuning uchun izoh muhim):
 *   `Transaction.tolovTuri` — faqat "naqd" | "click" | "qarz" | null;
 *   `Account.turi`          — "naqd" | "plastik" | "bank".
 * Ya'ni "Plastik" TO'LOV TURI emas, KASSA turi. Eski yozuvlarda `tolovTuri`
 * umuman null va usul faqat kassadan bilinadi.
 *
 * SHUNING UCHUN yagona qoida — "amaldagi usul":
 *   aniq `tolovTuri` bo'lsa — o'sha; bo'lmasa — kassa turi; kassa ham
 *   bo'lmasa — naqd (kassasiz eski yozuv naqd hisoblanadi, kunlik hisobot
 *   bilan bir xil qoida).
 *
 * Natijada bo'limlar RO'YXATDAN emas, MA'LUMOTDAN chiqadi: bazada plastik
 * yoki bank kassasi bo'lmasa, o'sha qator umuman ko'rinmaydi; yangi kassa
 * turi qo'shilsa — kodni o'zgartirmasdan paydo bo'ladi.
 *
 * QARZ ATAYLAB CHIQARILGAN: bosh sahifadagi "Jami kirim" ham qarzni hisobga
 * olmaydi (`lib/qarzFiltr.ts`). Bo'limlar yig'indisi kartadagi summa bilan
 * TENG bo'lishi shart, shuning uchun qarz bo'limlarga kirmaydi — u alohida
 * ma'lumot qatori sifatida qaytariladi.
 */

export const TOLOV_BOLIMLARI = ["naqd", "click", "plastik", "bank"] as const;
export type TolovBolimi = (typeof TOLOV_BOLIMLARI)[number];

export const TOLOV_BOLIMI_NOMI: Record<TolovBolimi, string> = {
  naqd: "Naqd",
  click: "Click",
  plastik: "Plastik",
  bank: "Bank",
};

export const TOLOV_BOLIMI_BELGI: Record<TolovBolimi, string> = {
  naqd: "\u{1F4B5}",
  click: "\u{1F4B3}",
  plastik: "\u{1F4B3}",
  bank: "\u{1F3E6}",
};

export function isTolovBolimi(v: unknown): v is TolovBolimi {
  return TOLOV_BOLIMLARI.includes(v as TolovBolimi);
}

/**
 * Yozuvni bo'limga biriktiradigan YAGONA funksiya.
 *
 * Jamlash (`getTolovTaqsimoti`) ham, ro'yxat filtri (`tolovBolimiWhere`) ham
 * shu qoidani takrorlaydi — ikkalasi bir joyda turgani uchun ular ajralib
 * ketmaydi. Qarz qaytmaydi: u bo'limlarga umuman kirmaydi.
 */
export function amaldagiBolim(
  tolovTuri: string | null,
  kassaTuri: string | null | undefined
): TolovBolimi | null {
  if (tolovTuri === "qarz") return null;
  if (tolovTuri === "naqd") return "naqd";
  if (tolovTuri === "click") return "click";
  // Eski yozuv: usul kassadan chiqariladi, kassasiz esa naqd.
  if (kassaTuri === "plastik") return "plastik";
  if (kassaTuri === "bank") return "bank";
  return "naqd";
}

/**
 * Bitta bo'lim uchun ro'yxat filtri — `amaldagiBolim` ning SQL ko'rinishi.
 *
 * Har yozuv ANIQ BITTA bo'limga tushadi (shartlar kesishmaydi), shuning
 * uchun bo'limlar bo'yicha ro'yxatlar yig'indisi to'liq to'plamga teng.
 */
export function tolovBolimiWhere(bolim: TolovBolimi): Prisma.TransactionWhereInput {
  // `tolovTuri` null bo'lgan (eski) yozuvlar — usul kassadan.
  const eski = (kassa: Prisma.TransactionWhereInput) => ({
    AND: [{ tolovTuri: null }, kassa],
  });

  switch (bolim) {
    case "click":
      return { tolovTuri: "click" };
    case "plastik":
      return eski({ account: { is: { turi: "plastik" } } });
    case "bank":
      return eski({ account: { is: { turi: "bank" } } });
    default:
      // Naqd: aniq "naqd" YOKI eski yozuv naqd kassada / kassasiz.
      return {
        OR: [
          { tolovTuri: "naqd" },
          eski({ OR: [{ accountId: null }, { account: { is: { turi: "naqd" } } }] }),
        ],
      };
  }
}
