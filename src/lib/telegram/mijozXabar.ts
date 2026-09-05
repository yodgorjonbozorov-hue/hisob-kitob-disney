import { formatSom, uzOyNomi } from "@/lib/format";
import { TOLOV_BOLIMI_BELGI, TOLOV_BOLIMI_NOMI } from "@/lib/tolovBolimi";
import type { BuyurtmaMalumot, BuyurtmaSatr, BuyurtmaTolovi, QarzSnapshot } from "./buyurtma";

/**
 * MIJOZGA KETADIGAN TELEGRAM MATNLARI — formatterlar.
 *
 * ATAYLAB SOF FUNKSIYALAR: baza ham, bot ham bu yerda chaqirilmaydi.
 * Sababi — matn mijoz ko'radigan yagona narsa, ya'ni uni testdan o'tkazish
 * eng oson va eng zarur joy (`npm run test:mijoz-telegram`).
 *
 * TO'LOV KANALLARI QOTIRILMAGAN (spec 7): qatorlar bazadagi HAQIQIY
 * to'lovlardan chiqadi va nomlari `lib/tolovBolimi.ts` dan olinadi. Yangi
 * kassa turi qo'shilsa xabar o'zi kengayadi, bu fayl tegilmaydi.
 *
 * QARZ QIYMATLARI ARGUMENT SIFATIDA KELADI (`QarzSnapshot`), buyurtmadan
 * QAYTA HISOBLANMAYDI. Sababi: qayta urinishda mijoz AYNAN o'sha paytdagi
 * raqamlarni ko'rishi kerak — snapshot esa `TelegramNotification` da yotadi.
 */

/** "5-sentabr 2026" — mijoz uchun odatiy o'zbekcha sana. */
export function sanaMatni(sana: Date): string {
  return `${sana.getUTCDate()}-${uzOyNomi(sana.getUTCMonth()).toLowerCase()} ${sana.getUTCFullYear()}`;
}

/** "11:37" — Asia/Tashkent (UTC+5, DSTsiz), server mintaqasidan mustaqil. */
export function soatMatni(vaqt: Date): string {
  const t = new Date(vaqt.getTime() + 5 * 60 * 60 * 1000);
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * "20 dona × 12 000 so'm" — miqdor HAR DOIM o'z birligi bilan.
 *
 * Birlik `Sale.birlik` snapshot'idan keladi, ya'ni katalogda keyin
 * o'zgartirilsa ham eski xabar o'zgarmaydi.
 */
export function satrMatni(satr: BuyurtmaSatr, tartib: number): string {
  return (
    `${tartib}. ${satr.nomi}\n` +
    `   ${formatSom(satr.miqdor)} ${satr.birlik} × ${formatSom(satr.birlikNarx)} so'm\n` +
    `   = ${formatSom(satr.jamiSumma)} so'm`
  );
}

/** To'lov kanallari bo'yicha qatorlar: "💵 Naqd: 1 000 000". */
function tolovQatorlari(tolovlar: BuyurtmaTolovi[]): string[] {
  return tolovlar.map(
    (t) => `${TOLOV_BOLIMI_BELGI[t.bolim]} ${TOLOV_BOLIMI_NOMI[t.bolim]}: ${formatSom(t.summa)} so'm`
  );
}

/**
 * PUL BLOKI — jami, to'lov taqsimoti va qarz.
 *
 * QATORLAR MA'LUMOTDAN CHIQADI, ro'yxatdan emas:
 *   - bitta kanal bo'lsa faqat o'sha ko'rinadi ("💵 Naqd: 200 000") —
 *     ustiga "To'landi" qo'yish o'sha raqamni ikki marta yozish bo'lardi;
 *   - bir necha kanal bo'lsa har biri alohida, ostida yig'indi turadi
 *     (spec 7: naqd + click + qarz);
 *   - kanal aniqlanmagan eski yozuvda (tolovTuri ham, kassa ham null)
 *     umumiy "To'landi" qatoriga qaytiladi — raqam yo'qolib qolmasin.
 */
function pulBloki(b: BuyurtmaMalumot): string[] {
  const qatorlar = ["——————————", `💰 Jami: ${formatSom(b.jami)} so'm`];
  qatorlar.push(...tolovQatorlari(b.tolovlar));

  const kanallarJami = b.tolovlar.reduce((a, t) => a + t.summa, 0);
  if (b.tolangan > 0 && (b.tolovlar.length !== 1 || kanallarJami !== b.tolangan)) {
    qatorlar.push(`💳 To'landi: ${formatSom(b.tolangan)} so'm`);
  }
  if (b.qarz > 0) {
    qatorlar.push(`📕 Qarzga: ${formatSom(b.qarz)} so'm`);
  }
  return qatorlar;
}

/**
 * QARZ BLOKI — oldingi / yangi / jami. HAMMASI SNAPSHOT'dan.
 *
 * Faqat mijozda oldindan qarz bo'lganda ko'rinadi: qarzsiz mijozga
 * "Oldingi qarz: 0" deb yozish xabarni ma'nosiz uzaytiradi.
 */
function qarzBloki(q: QarzSnapshot): string[] {
  if (q.debtBefore <= 0 || q.debtAdded <= 0) return [];
  return [
    "",
    `Oldingi qarz: ${formatSom(q.debtBefore)} so'm`,
    `Yangi qarz: +${formatSom(q.debtAdded)} so'm`,
    `📕 Jami qarz: ${formatSom(q.debtAfter)} so'm`,
  ];
}

function imzo(b: BuyurtmaMalumot): string[] {
  return ["", `👤 Sotuvchi: ${b.sotuvchi}`, `Buyurtma №${b.raqam}`];
}

/** 📦 Yangi xarid (SALE_CREATED). */
export function xaridXabari(b: BuyurtmaMalumot, qarz: QarzSnapshot): string {
  return [
    "📦 Xaridingiz",
    `📅 ${sanaMatni(b.sana)}`,
    `🕐 ${soatMatni(b.vaqt)}`,
    "",
    ...b.satrlar.map((s, i) => satrMatni(s, i + 1)),
    "",
    ...pulBloki(b),
    ...qarzBloki(qarz),
    ...imzo(b),
  ].join("\n");
}

/**
 * ⚠️ O'zgartirilgan xarid (SALE_UPDATED).
 *
 * Mijoz eski xabarni qidirib solishtirmasligi uchun YANGILANGAN to'liq
 * tarkib qayta yuboriladi — faqat "o'zgardi" deb qo'yilmaydi.
 */
export function ozgarishXabari(b: BuyurtmaMalumot, qarz: QarzSnapshot): string {
  return [
    "⚠️ Xaridingizga o'zgartirish kiritildi",
    `📅 ${sanaMatni(b.sana)}`,
    `🕐 ${soatMatni(b.vaqt)}`,
    "",
    ...b.satrlar.map((s, i) => satrMatni(s, i + 1)),
    "",
    ...pulBloki(b),
    ...qarzBloki(qarz),
    ...imzo(b),
  ].join("\n");
}

/**
 * ❌ Bekor qilingan xarid (SALE_CANCELLED).
 *
 * Qarz shu paytga kelib allaqachon QAYTARILGAN bo'ladi (bekor qilish
 * tranzaksiyasi qarz yozuvini o'chiradi), shuning uchun "Jami qarz" — bekor
 * qilinganDAN KEYINGI haqiqiy qoldiq (spec 10).
 */
export function bekorXabari(b: BuyurtmaMalumot, qarz: QarzSnapshot): string {
  const qatorlar = [
    "❌ Xarid bekor qilindi",
    `📅 ${sanaMatni(b.sana)}`,
    `Buyurtma №${b.raqam}`,
    "",
    `Bekor qilingan summa: ${formatSom(b.jami)} so'm`,
  ];
  if (b.bekorSababi) qatorlar.push(`Sabab: ${b.bekorSababi}`);
  qatorlar.push("", `📕 Joriy qarzingiz: ${formatSom(qarz.debtAfter)} so'm`);
  return qatorlar.join("\n");
}

/** 💵 Qarzga to'lov qabul qilindi (PAYMENT_RECEIVED). */
export function tolovXabari(params: {
  summa: number;
  sana: Date;
  qolganQarz: number;
  bolim?: BuyurtmaTolovi["bolim"] | null;
}): string {
  const usul = params.bolim
    ? ` (${TOLOV_BOLIMI_NOMI[params.bolim]})`
    : "";
  return [
    "✅ To'lovingiz qabul qilindi",
    `📅 ${sanaMatni(params.sana)}`,
    "",
    `💵 To'lov: ${formatSom(params.summa)} so'm${usul}`,
    `📕 Qolgan qarz: ${formatSom(params.qolganQarz)} so'm`,
  ].join("\n");
}

/** 🔔 Qarz eslatmasi (DEBT_REMINDER). */
export function qarzEslatmaXabari(params: { qarz: number; muddat?: Date | null }): string {
  const qatorlar = ["🔔 Qarz eslatmasi", "", `📕 Joriy qarzingiz: ${formatSom(params.qarz)} so'm`];
  if (params.muddat) qatorlar.push(`📅 Kelishilgan muddat: ${sanaMatni(params.muddat)}`);
  return qatorlar.join("\n");
}

/** Buyurtma ro'yxatidagi bitta qator: "05.09.2026 — 445 000 so'm". */
export function royxatQatori(sana: Date, summa: number): string {
  const d = String(sana.getUTCDate()).padStart(2, "0");
  const m = String(sana.getUTCMonth() + 1).padStart(2, "0");
  return `${d}.${m}.${sana.getUTCFullYear()} — ${formatSom(summa)} so'm`;
}
