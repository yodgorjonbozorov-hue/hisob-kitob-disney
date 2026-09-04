import { BadRequestError } from "@/lib/auth/guard";
import type { Prisma } from "@prisma/client";

/**
 * ZAKAZ TO'LOVLARI — BITTA ZAKAZ, BIR NECHA KANAL.
 *
 * Misol: 1 000 000 lik zakaz — naqd 300 000 + click 400 000 + terminal
 * 200 000, qolgan 100 000 esa QARZ.
 *
 * IKKI QOIDA, ular buzilsa moliya yolg'on ko'rsatadi:
 *
 * 1. QARZ — KANAL EMAS. Qarz "to'lov turi" sifatida yozilmaydi: u zakaz
 *    summasidan QOLGAN qism (`lib/crm/pipeline.ts` → `qarzUlushi`). Shu
 *    sabab bu yerdagi kanallar ro'yxatida "qarz" YO'Q — aks holda bir
 *    zakazda qarz ikki xil joyda (qator va qoldiq) turib, ikki xil javob
 *    berardi.
 *
 * 2. HAR KANAL — ALOHIDA KIRIM. Bitta `Transaction` da bitta `accountId`
 *    bo'ladi, ya'ni bitta yozuv pulni ikki kassaga bo'la olmaydi. Shuning
 *    uchun naqd qism naqd kassaga, click/terminal qismi karta/hisob
 *    kassasiga ALOHIDA yozuv bilan tushadi ("naqd kassa faqat naqd qismga
 *    oshsin" talabi shundan bajariladi).
 *
 * ORQAGA MOSLIK: eski, bir kanalli zakazlarda qator UMUMAN YO'Q — pul
 * `Deal.tolangan` + `Deal.tolovTuri` da turadi va hamma joyda avvalgidek
 * ishlaydi. `kirimSatrlari()` o'sha holatni bitta sun'iy qator qilib
 * beradi, shunda yakunlash kodi ikki xil yo'lni bilishi shart emas.
 */

/**
 * CRM to'lov kanallari. "boshqa" — nomi boshqacha bo'lgan pul kanali
 * (bank o'tkazmasi va h.k.): moliyada u ham naqd EMAS deb hisoblanadi.
 */
export const TOLOV_KANALLARI = ["naqd", "click", "terminal", "boshqa"] as const;
export type TolovKanali = (typeof TOLOV_KANALLARI)[number];

export const TOLOV_KANAL_NOMI: Record<TolovKanali, string> = {
  naqd: "Naqd",
  click: "Click",
  terminal: "Terminal",
  boshqa: "Boshqa",
};

/** Bir zakazdagi to'lov qatorlarining sog'lom chegarasi. */
export const TOLOV_SATR_LIMITI = 10;

/**
 * ARALASH to'lovli zakazning `Deal.tolovTuri` belgisi. Faqat CRM ichida
 * ko'rsatish uchun: moliyaga har qator O'Z kanali bilan tushadi.
 */
export const ARALASH = "aralash";

export interface TolovSatri {
  kanal: string;
  summa: number;
}

export function tolovKanalimi(v: unknown): v is TolovKanali {
  return TOLOV_KANALLARI.includes(v as TolovKanali);
}

/**
 * KANAL → MOLIYA TO'LOV TURI.
 *
 * Moliya modulining lug'ati ATAYLAB kengaytirilmaydi: `Transaction.tolovTuri`
 * "naqd" | "click" | "qarz" | null bo'lib qoladi (`lib/tolovBolimi.ts` shu
 * uchtasiga qurilgan — hisobotlar, kunlik kassa, filtrlar). Terminal va
 * "boshqa" — naqd EMAS, demak ular karta/hisob kassasiga tushadi, ya'ni
 * moliya uchun "click" bilan bir xil yo'nalish. Kanalning O'ZI esa
 * `DealTolov.kanal` da saqlanib qoladi — CRM tarixi yo'qolmaydi.
 */
export function kanalTolovTuri(kanal: string): "naqd" | "click" {
  return kanal === "naqd" ? "naqd" : "click";
}

/** Qatorlar yig'indisi (so'm). */
export function tolovlarJami(satrlar: TolovSatri[]): number {
  return satrlar.reduce((s, t) => s + t.summa, 0);
}

/**
 * ZAKAZ TO'LOV BELGISI (`Deal.tolovTuri`) qatorlardan hisoblanadi:
 * bitta qator — o'sha kanal (eski zakazlar bilan bir xil ko'rinish),
 * bir nechta — "aralash", qatorsiz — tanlov (odatda `null` yoki "qarz").
 */
export function tolovTuriBelgisi(satrlar: TolovSatri[], tanlov: string | null | undefined): string | null {
  if (satrlar.length === 1) return satrlar[0].kanal;
  if (satrlar.length > 1) return ARALASH;
  return tanlov ?? null;
}

/**
 * QATORLARNI TEKSHIRISH — yozishdan OLDIN, yagona joyda.
 *
 * Zakaz summasidan oshib ketgan to'lov RAD ETILADI (5-test): aks holda
 * kirim zakazdan katta bo'lib, qoldiq manfiy qarzga aylanardi.
 */
export function tolovlarniTekshir(summa: number, satrlar: TolovSatri[]): void {
  if (satrlar.length > TOLOV_SATR_LIMITI) {
    throw new BadRequestError(`Bir zakazda ${TOLOV_SATR_LIMITI} tadan ko'p to'lov qatori bo'lmaydi`);
  }
  for (const t of satrlar) {
    if (!tolovKanalimi(t.kanal)) throw new BadRequestError("To'lov kanali noto'g'ri");
    if (!Number.isInteger(t.summa) || t.summa <= 0) {
      throw new BadRequestError("To'lov summasi butun va noldan katta bo'lishi kerak");
    }
  }
  const jami = tolovlarJami(satrlar);
  if (jami > summa) {
    throw new BadRequestError("To'lovlar yig'indisi zakaz summasidan ko'p bo'lmasligi kerak");
  }
}

/** Kirim yoziladigan bitta qator (haqiqiy yoki eski zakaz uchun sun'iy). */
export interface KirimSatri {
  /** `DealTolov.id` — eski (qatorsiz) zakazda `null`. */
  satrId: string | null;
  /** Moliya to'lov turi (`Transaction.tolovTuri`). */
  tolovTuri: "naqd" | "click" | null;
  /** CRM kanali — izohda ko'rsatiladi. */
  kanal: string | null;
  summa: number;
  /** Allaqachon yozilgan kirim (bo'lsa qayta yozilmaydi). */
  transactionId: string | null;
}

/**
 * YAKUNLASHDA KIRIM YOZILADIGAN QATORLAR.
 *
 * Qatorlar bo'lsa — o'shalar; bo'lmasa (eski, bir kanalli zakaz) bitta
 * sun'iy qator: summa `kirimSumma`, to'lov turi esa zakazning o'zidan.
 * "qarz" belgisi kirimga UZATILMAYDI — bu yerda yoziladigan pul HAQIQATDA
 * olingan pul (qolgani alohida qarz yozuvi bo'ladi).
 */
export function kirimSatrlari(
  deal: { tolovTuri: string | null; transactionId: string | null },
  satrlar: Array<{ id: string; kanal: string; summa: number; transactionId: string | null }>,
  kirimSumma: number
): KirimSatri[] {
  if (satrlar.length > 0) {
    return satrlar.map((s) => ({
      satrId: s.id,
      tolovTuri: kanalTolovTuri(s.kanal),
      kanal: s.kanal,
      summa: s.summa,
      transactionId: s.transactionId,
    }));
  }
  if (kirimSumma <= 0) return [];
  const turi = deal.tolovTuri && deal.tolovTuri !== "qarz" ? kanalTolovTuri(deal.tolovTuri) : null;
  return [
    {
      satrId: null,
      tolovTuri: turi,
      kanal: null,
      summa: kirimSumma,
      transactionId: deal.transactionId,
    },
  ];
}

/** Kirim izohi: bir nechta kanal bo'lsa qaysi kanal ekani ko'rinib tursin. */
export function satrIzohi(izoh: string, kanal: string | null, kopKanal: boolean): string {
  if (!kopKanal || !kanal) return izoh;
  const nom = tolovKanalimi(kanal) ? TOLOV_KANAL_NOMI[kanal] : kanal;
  return `${izoh} · ${nom}`;
}

/** Tranzaksiya ichida ham, tashqarisida ham ishlaydigan minimal shakl. */
export type TolovYozuvchi = Pick<Prisma.TransactionClient, "dealTolov">;

/**
 * ZAKAZ TO'LOV QATORLARINI TO'LIQ ALMASHTIRISH.
 *
 * Kirim yozilgan qator O'CHIRILMAYDI: pul allaqachon kassaga tushgan, uni
 * CRM formasidan o'chirish moliyani CRM bilan zid holatga tushirardi
 * (API qatlami ham moliyaga o'tgan zakazning to'lovini qulflaydi).
 * Chaqiruvchi `Deal.tolangan` va `Deal.tolovTuri` ni AYNI tranzaksiyada
 * yangilaydi — yig'indi va qatorlar hech qachon ajralib qolmasin.
 */
export async function tolovSatrlariniYoz(
  db: TolovYozuvchi,
  businessId: string,
  dealId: string,
  satrlar: TolovSatri[]
): Promise<void> {
  const mavjud = await db.dealTolov.findMany({
    where: { businessId, dealId },
    select: { id: true, transactionId: true },
  });
  if (mavjud.some((m) => m.transactionId)) {
    throw new BadRequestError("Kirim yozilgan to'lov o'zgartirilmaydi — Kirim bo'limidan tuzating");
  }
  if (mavjud.length > 0) {
    await db.dealTolov.deleteMany({ where: { businessId, dealId } });
  }
  for (const t of satrlar) {
    await db.dealTolov.create({ data: { businessId, dealId, kanal: t.kanal, summa: t.summa } });
  }
}
