import { prisma } from "@/lib/prisma";
import { amaldagiBolim, type TolovBolimi } from "@/lib/tolovBolimi";

/**
 * BUYURTMA MA'LUMOTI — mijozga yuboriladigan raqamlarning YAGONA MANBAI.
 *
 * ENG MUHIM QOIDA (spec 17): Telegramdagi har bir raqam bazadagi TASDIQLANGAN
 * yozuvdan chiqadi. Frontend hisoblab yuborgan "jami" ga ISHONILMAYDI va bu
 * yerda umuman ko'rilmaydi — hammasi qaytadan o'qiladi:
 *
 *   satr summasi   → `Sale.birlikNarx` × `Sale.miqdor` (savdo paytidagi snapshot);
 *   to'langan pul  → kirim `Transaction` + `DebtPayment` yozuvlari;
 *   qarz           → `Debt` (jamiSumma − tolangan), ya'ni butun tizim
 *                    ishlatadigan O'SHA ledger. Telegram uchun ALOHIDA qarz
 *                    hisoblash algoritmi YO'Q (spec 8).
 *
 * BALANSA'DA "ORDER" NIMA. Alohida Order jadvali yaratilmadi — u mavjud
 * savdo yozuvlarining ikkinchi nusxasi bo'lardi va hisobotlar ikki manbadan
 * o'qiy boshlardi. Buyurtma sifatida mavjud ikkita shakl o'qiladi:
 *
 *   "chek"  — `PosChek` + satrlari (`Sale[]`): ko'p mahsulotli savdo,
 *             biznes ichida ketma-ket raqam bilan (mijoz ko'radigan "Order №");
 *   "sotuv" — chekka kirmagan yakka `Sale` (OMBOR moduli, bir mahsulot).
 *
 * HOLAT/EVENT (spec 3). Balansa'da DRAFT → CONFIRMED → DELIVERED zanjiri
 * YO'Q va sun'iy ravishda qo'shilmadi. Chek/sotuv yozuvining O'ZI "tovar
 * mijozga berildi" hodisasi: aynan o'sha atomik tranzaksiyada ombor
 * qoldig'i kamayadi, pul kassaga tushadi yoki qarz ochiladi. Shuning uchun
 * xabar shu nuqtada yuboriladi — undan oldin tovar hali berilmagan, undan
 * keyin esa boshqa hodisa yo'q.
 */

export interface BuyurtmaSatr {
  nomi: string;
  miqdor: number;
  /** "dona" | "kg" | "quti" | ... — savdo paytidagi snapshot. */
  birlik: string;
  birlikNarx: number;
  jamiSumma: number;
}

/** To'lov kanali bo'yicha bitta qator (naqd / click / plastik / bank). */
export interface BuyurtmaTolovi {
  bolim: TolovBolimi;
  summa: number;
}

export interface BuyurtmaMijozi {
  id: string;
  ism: string;
  telegramChatId: string | null;
}

export interface BuyurtmaMalumot {
  manba: "chek" | "sotuv";
  id: string;
  /** Mijoz ko'radigan buyurtma raqami. */
  raqam: string;
  /** Savdo sanasi (UTC-yarim tun). */
  sana: Date;
  /** Savdo yozilgan aniq payt (soat ko'rsatish uchun). */
  vaqt: Date;
  satrlar: BuyurtmaSatr[];
  /** Satrlar yig'indisi — bazadagi snapshot narxlardan qayta hisoblanadi. */
  jami: number;
  /** Haqiqatda tushgan pul (kirim tranzaksiya + qarz to'lovlari). */
  tolangan: number;
  /** Shu buyurtmadan qolgan qarz (Debt: jamiSumma − tolangan). */
  qarz: number;
  /** To'lov kanallari bo'yicha taqsimot (qarz bu yerda YO'Q — u alohida). */
  tolovlar: BuyurtmaTolovi[];
  sotuvchi: string;
  bekorQilingan: boolean;
  bekorSababi: string | null;
  mijoz: BuyurtmaMijozi;
  /** Mijozning HOZIRGI umumiy ochiq qarzi (barcha savdolari bo'yicha). */
  joriyQarz: number;
}

/**
 * QARZ SNAPSHOT'i — xabar YOZILGAN PAYTDAGI holat.
 *
 * NEGA SNAPSHOT, HISOB EMAS. "Oldingi qarz" ni har o'qishda
 * `joriyQarz − buyurtma qarzi` deb chiqarish mumkin edi, lekin u FAQAT
 * xabar yozilgan lahzada to'g'ri bo'ladi. Xabar kech ketsa (Telegram
 * yiqilib, keyin qayta urinilsa) oradan boshqa savdo yoki to'lov o'tgan
 * bo'lishi mumkin — va mijoz O'SHA savdo haqida butunlay boshqa raqamlarni
 * ko'rardi. Shu bois qiymatlar `TelegramNotification` ga yoziladi va qayta
 * urinishda AYNAN o'sha yozuvdan olinadi.
 *
 * Chegara aniq:
 *   savdo xabari         → TARIXIY snapshot (shu tur);
 *   botdagi "Mening qarzim" → REAL-TIME ledger (`mijozJoriyQarzi`).
 */
export interface QarzSnapshot {
  /** Shu savdogacha bo'lgan qarz. */
  debtBefore: number;
  /** Shu savdodan qo'shilgan qarz. */
  debtAdded: number;
  /** Shu savdodan keyingi jami qarz (= debtBefore + debtAdded). */
  debtAfter: number;
}

/**
 * Buyurtmadan snapshot yasaydi — FAQAT xabar birinchi marta yozilayotganda
 * chaqiriladi (qayta urinishda saqlangan snapshot ishlatiladi).
 */
export function qarzSnapshoti(b: BuyurtmaMalumot): QarzSnapshot {
  return {
    debtBefore: b.joriyQarz - b.qarz,
    debtAdded: b.qarz,
    debtAfter: b.joriyQarz,
  };
}

/** Bo'sh birlik ("") ni ham "dona" ga qaytaradi — xabarda birlik doim bo'ladi. */
function birlikOr(...nomzodlar: (string | null | undefined)[]): string {
  for (const n of nomzodlar) {
    const t = n?.trim();
    if (t) return t;
  }
  return "dona";
}

/** Kanal qatorlarini bo'lim bo'yicha jamlaydi va bo'shlarini tashlaydi. */
function tolovlarniJamla(
  xom: { bolim: TolovBolimi | null; summa: number }[]
): BuyurtmaTolovi[] {
  const map = new Map<TolovBolimi, number>();
  for (const t of xom) {
    if (!t.bolim || t.summa <= 0) continue;
    map.set(t.bolim, (map.get(t.bolim) ?? 0) + t.summa);
  }
  return [...map.entries()].map(([bolim, summa]) => ({ bolim, summa }));
}

/**
 * Mijozning HOZIRGI ochiq qarzi — `lib/services/mijoz.ts` dagi
 * `mijozQarzHolati` bilan AYNAN bir xil kesim (yopilmagan "olinadigan").
 * Ikkinchi algoritm emas, o'sha shart.
 */
export async function mijozJoriyQarzi(businessId: string, contactId: string): Promise<number> {
  const agg = await prisma.debt.aggregate({
    where: { businessId, contactId, isYopilgan: false, turi: "olinadigan" },
    _sum: { jamiSumma: true, tolangan: true },
  });
  return (agg._sum.jamiSumma ?? 0) - (agg._sum.tolangan ?? 0);
}

/** Kirim tranzaksiyasini to'lov qatoriga aylantiradi (bekor qilingani hisobga olinmaydi). */
async function kirimTolovi(
  businessId: string,
  transactionId: string | null
): Promise<{ bolim: TolovBolimi | null; summa: number } | null> {
  if (!transactionId) return null;
  const txn = await prisma.transaction.findFirst({
    where: { id: transactionId, businessId, deletedAt: null },
    select: { summa: true, tolovTuri: true, account: { select: { turi: true } } },
  });
  if (!txn) return null;
  return { bolim: amaldagiBolim(txn.tolovTuri, txn.account?.turi), summa: txn.summa };
}

/** Qarz yozuvi va unga tushgan to'lovlar. */
async function qarzHolati(businessId: string, debtId: string | null) {
  if (!debtId) return { qarz: 0, tolovlar: [] as { bolim: TolovBolimi | null; summa: number }[] };
  const debt = await prisma.debt.findFirst({
    where: { id: debtId, businessId },
    select: {
      jamiSumma: true,
      tolangan: true,
      status: true,
      payments: {
        select: { summa: true, tolovTuri: true, accountId: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!debt) return { qarz: 0, tolovlar: [] };

  // To'lov kassalarining turlari bitta so'rovda (N+1 bo'lmasin).
  const accountIds = [...new Set(debt.payments.map((p) => p.accountId).filter(Boolean))] as string[];
  const kassalar = accountIds.length
    ? await prisma.account.findMany({
        where: { id: { in: accountIds }, businessId },
        select: { id: true, turi: true },
      })
    : [];
  const kassaTuri = new Map(kassalar.map((k) => [k.id, k.turi]));

  return {
    // Bekor qilingan qarz mijozdan talab qilinmaydi — qoldiq 0.
    qarz: debt.status === "CANCELLED" ? 0 : debt.jamiSumma - debt.tolangan,
    tolovlar: debt.payments.map((p) => ({
      bolim: amaldagiBolim(p.tolovTuri, p.accountId ? kassaTuri.get(p.accountId) : null),
      summa: p.summa,
    })),
  };
}

/** Sotuvchi ismi (yozuvda faqat `userId` bor). */
async function sotuvchiIsmi(userId: string): Promise<string> {
  const u = await prisma.user.findFirst({ where: { id: userId }, select: { ism: true } });
  return u?.ism ?? "—";
}

/**
 * CHEK (ko'p mahsulotli buyurtma) ma'lumotini yig'adi.
 *
 * Bekor qilingan chekda satrlar yumshoq o'chirilgan bo'ladi — shuning uchun
 * `deletedAt` bo'yicha FILTRLANMAYDI: mijozga "nima bekor qilindi" ni
 * ko'rsatish uchun aynan o'sha satrlar kerak.
 */
export async function chekBuyurtmasi(
  businessId: string,
  chekId: string
): Promise<BuyurtmaMalumot | null> {
  const chek = await prisma.posChek.findFirst({
    where: { id: chekId, businessId },
    include: {
      satrlar: {
        orderBy: { createdAt: "asc" },
        select: {
          miqdor: true,
          birlikNarx: true,
          jamiSumma: true,
          birlik: true,
          mahsulotNomi: true,
          product: { select: { nomi: true, birlik: true } },
        },
      },
      contact: { select: { id: true, ism: true, telegramChatId: true } },
    },
  });
  if (!chek || !chek.contact) return null;

  const [kirim, qarzInfo, sotuvchi, joriyQarz] = await Promise.all([
    kirimTolovi(businessId, chek.transactionId),
    qarzHolati(businessId, chek.debtId),
    sotuvchiIsmi(chek.userId),
    mijozJoriyQarzi(businessId, chek.contact.id),
  ]);

  const satrlar: BuyurtmaSatr[] = chek.satrlar.map((s) => ({
    nomi: s.mahsulotNomi ?? s.product.nomi,
    miqdor: s.miqdor,
    birlik: birlikOr(s.birlik, s.product.birlik),
    birlikNarx: s.birlikNarx,
    jamiSumma: s.jamiSumma,
  }));
  const tolovlar = tolovlarniJamla([...(kirim ? [kirim] : []), ...qarzInfo.tolovlar]);

  return {
    manba: "chek",
    id: chek.id,
    raqam: String(chek.raqam),
    sana: chek.sana,
    vaqt: chek.createdAt,
    satrlar,
    jami: satrlar.reduce((a, s) => a + s.jamiSumma, 0),
    tolangan: tolovlar.reduce((a, t) => a + t.summa, 0),
    qarz: qarzInfo.qarz,
    tolovlar,
    sotuvchi,
    bekorQilingan: chek.deletedAt !== null,
    bekorSababi: chek.cancelReason,
    mijoz: chek.contact,
    joriyQarz,
  };
}

/** YAKKA SOTUV (chekka kirmagan) — OMBOR modulidagi bir mahsulotli savdo. */
export async function sotuvBuyurtmasi(
  businessId: string,
  saleId: string
): Promise<BuyurtmaMalumot | null> {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, businessId },
    include: {
      product: { select: { nomi: true, birlik: true } },
      contact: { select: { id: true, ism: true, telegramChatId: true } },
      debt: { select: { id: true } },
    },
  });
  if (!sale || !sale.contact) return null;

  const [kirim, qarzInfo, sotuvchi, joriyQarz] = await Promise.all([
    kirimTolovi(businessId, sale.transactionId),
    qarzHolati(businessId, sale.debt?.id ?? null),
    sotuvchiIsmi(sale.userId),
    mijozJoriyQarzi(businessId, sale.contact.id),
  ]);

  const satrlar: BuyurtmaSatr[] = [
    {
      nomi: sale.mahsulotNomi ?? sale.product.nomi,
      miqdor: sale.miqdor,
      birlik: birlikOr(sale.birlik, sale.product.birlik),
      birlikNarx: sale.birlikNarx,
      jamiSumma: sale.jamiSumma,
    },
  ];
  const tolovlar = tolovlarniJamla([...(kirim ? [kirim] : []), ...qarzInfo.tolovlar]);

  return {
    manba: "sotuv",
    id: sale.id,
    // Yakka sotuvda chek raqami yo'q — id ning oxirgi 6 belgisi barqaror
    // va mijoz uchun yetarli ("Buyurtma №a1b2c3").
    raqam: sale.id.slice(-6).toUpperCase(),
    sana: sale.sana,
    vaqt: sale.createdAt,
    satrlar,
    jami: sale.jamiSumma,
    tolangan: tolovlar.reduce((a, t) => a + t.summa, 0),
    qarz: qarzInfo.qarz,
    tolovlar,
    sotuvchi,
    bekorQilingan: sale.deletedAt !== null,
    bekorSababi: sale.cancelReason,
    mijoz: sale.contact,
    joriyQarz,
  };
}

/** Manbaga qarab to'g'ri o'quvchini tanlaydi. */
export function buyurtmaOqi(
  businessId: string,
  manba: { chekId?: string | null; saleId?: string | null }
): Promise<BuyurtmaMalumot | null> {
  if (manba.chekId) return chekBuyurtmasi(businessId, manba.chekId);
  if (manba.saleId) return sotuvBuyurtmasi(businessId, manba.saleId);
  return Promise.resolve(null);
}
