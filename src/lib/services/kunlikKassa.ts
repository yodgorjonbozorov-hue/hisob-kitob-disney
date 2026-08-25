import type { Prisma } from "@prisma/client";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import type { BusinessTx } from "@/lib/db/businessTx";
import { ensureUserKassaTx, kassaQoldiqTx } from "@/lib/services/userKassa";
import { QOLDIQ_HOLATLARI } from "@/lib/validation/account";

/**
 * KUN YAKUNINING PUL TOMONI — kassa topshirish.
 *
 * ═══ ASOSIY INVARIANT (buzilmaydi) ═══
 * Bu modul HECH QACHON `Transaction` yozmaydi. Kassirdan direktorga pul
 * topshirish — KIRIM ham, CHIQIM ham EMAS: pul biznesdan chiqmadi, faqat
 * EGASI almashdi. Shuning uchun u mavjud `AccountTransfer` ledgerida
 * yoziladi (`turi = "smena"`), xuddi Kassalar sahifasidagi o'tkazma kabi.
 *
 * Natijada:
 *   - Dashboard "Jami Kirim"  — o'zgarmaydi (u faqat Transaction'dan);
 *   - Dashboard "Jami Chiqim" — o'zgarmaydi (u ham faqat Transaction'dan);
 *   - o'zgaradigan YAGONA narsa — kassa qoldiqlari.
 *
 * ═══ NEGA YANGI JADVAL YO'Q ═══
 * `CashHandover` (eski tizim) ledgerga ataylab tegmasdi va shu sababli
 * "kassir kassasi 0 bo'lsin" talabini bajara olmasdi. Uning o'rniga kelgan
 * `AccountTransfer` esa haqiqiy ikki tomonlama harakat: yuboruvchidan
 * ayriladi, qabul qiluvchiga qo'shiladi. Kun yakuni SHU ledgerga bog'lanadi
 * — aks holda uchinchi haqiqat manbai paydo bo'lardi.
 *
 * ═══ TRANZAKSIYA ICHIDA ═══
 * Barcha funksiyalar xom `tx` bilan ishlaydi, ya'ni kun holatini o'zgartirish
 * va pulni ko'chirish BITTA atomik tranzaksiyada bo'ladi (CLAUDE.md talabi).
 * Shuning uchun HAR so'rovda `businessId` sharti QO'LDA yozilgan.
 */

/** NAQD kassa filtri — jismoniy pul faqat shu turdagi kassalarda yotadi. */
const NAQD_KASSA: Prisma.AccountWhereInput = { turi: "naqd" };

export interface KunlikKassaManba {
  /** Kassirning shaxsiy kassasi (shaxsiy kassa rejimida) — bo'lmasa null. */
  accountId: string | null;
  /** Shu kassadagi (yoki biznes naqd kassalaridagi) hozirgi qoldiq. */
  qoldiq: number;
  /** Pul aynan kassirning shaxsiy kassasidami — topshirish shunda mumkin. */
  shaxsiy: boolean;
}

/**
 * BIZNESNING JAMI NAQD QOLDIG'I — shaxsiy kassa rejimi YO'Q bizneslar uchun.
 *
 * Naqd kassalar ledgeri: yozuvlar (kirim − chiqim) + o'tkazmalar (kirgan −
 * chiqqan). Ikkala uchi ham naqd bo'lgan o'tkazma ikkala tomonda ham
 * ko'ringani uchun o'z-o'zini nolga chiqaradi — bu to'g'ri.
 */
export async function biznesNaqdQoldiqTx(tx: BusinessTx, businessId: string): Promise<number> {
  const [kirim, chiqim, kirgan, chiqqan] = await Promise.all([
    tx.transaction.aggregate({
      where: { businessId, turi: "kirim", deletedAt: null, account: NAQD_KASSA },
      _sum: { summa: true },
    }),
    tx.transaction.aggregate({
      where: { businessId, turi: "chiqim", deletedAt: null, account: NAQD_KASSA },
      _sum: { summa: true },
    }),
    tx.accountTransfer.aggregate({
      where: { businessId, holat: { in: [...QOLDIQ_HOLATLARI] }, toAccount: NAQD_KASSA },
      _sum: { summa: true },
    }),
    tx.accountTransfer.aggregate({
      where: { businessId, holat: { in: [...QOLDIQ_HOLATLARI] }, fromAccount: NAQD_KASSA },
      _sum: { summa: true },
    }),
  ]);
  return (
    (kirim._sum.summa ?? 0) -
    (chiqim._sum.summa ?? 0) +
    (kirgan._sum.summa ?? 0) -
    (chiqqan._sum.summa ?? 0)
  );
}

/**
 * TOPSHIRUVCHINING KASSASI — "kassada bo'lishi kerak" raqamining manbai.
 *
 * Shaxsiy kassa rejimida naqd yozuv uni KIRITGAN xodimning kassasiga tushadi
 * (`kassaTanlash.ts`), shuning uchun uning qoldig'i aynan xodim qo'lidagi
 * pul. Rejim yoqilmagan bizneslarda shaxsiy kassa yo'q — u holda biznesning
 * jami naqdi ko'rsatiladi va pul ko'chirilmaydi (ko'chiradigan manzil yo'q).
 */
export async function topshiruvchiKassaTx(
  tx: BusinessTx,
  businessId: string,
  userId: string
): Promise<KunlikKassaManba> {
  const shaxsiy = await tx.account.findFirst({
    where: { businessId, userId, isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (shaxsiy) {
    return {
      accountId: shaxsiy.id,
      qoldiq: await kassaQoldiqTx(tx, businessId, shaxsiy.id),
      shaxsiy: true,
    };
  }
  return { accountId: null, qoldiq: await biznesNaqdQoldiqTx(tx, businessId), shaxsiy: false };
}

/**
 * QABUL QILUVCHI KASSA (markaziy kassa) — pul qayerga boradi.
 *
 * Tayinlangan direktor bo'lsa — uning shaxsiy kassasi (yo'q bo'lsa ochiladi).
 * Direktor tayinlanmagan bo'lsa — biznesning birinchi UMUMIY (egasiz) naqd
 * kassasi, ya'ni seyf. Ikkalasi ham topilmasa null: pul ko'chmaydi va
 * kun faqat solishtiruv sifatida yopiladi (UI ogohlantiradi).
 */
export async function markaziyKassaTx(
  tx: BusinessTx,
  businessId: string,
  direktorId: string | null
): Promise<{ id: string; nomi: string } | null> {
  if (direktorId) {
    const direktor = await tx.user.findFirst({
      where: { id: direktorId, isActive: true },
      select: { id: true, ism: true },
    });
    if (direktor) return ensureUserKassaTx(tx, businessId, direktor);
  }
  return tx.account.findFirst({
    where: { businessId, isActive: true, userId: null, ...NAQD_KASSA },
    select: { id: true, nomi: true },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
  });
}

export interface TopshiriqYaratNatija {
  transferId: string | null;
  /** Ledgerda HAQIQATDA ko'chiriladigan summa (pastdagi qoidaga qarang). */
  kochadi: number;
  /** Pul ko'chirilmagan bo'lsa — sababi (UI'da ko'rsatiladi). */
  sabab: string | null;
}

/**
 * LEDGERDA KO'CHADIGAN SUMMA — kassir SANAGAN puldan farq qilishi mumkin.
 *
 * Uch holat:
 *   1. MOS (sanalgan = qoldiq)     -> hammasi ko'chadi, kassa 0 bo'ladi;
 *   2. KAMOMAD (sanalgan < qoldiq) -> faqat sanalgani ko'chadi. Yetishmagan
 *      pul kassirning kassasida OCHIQ QARZ bo'lib qoladi — u hali javobgar;
 *   3. ORTIQCHA (sanalgan > qoldiq) -> qoldiqdan ORTIG'I ko'chmaydi.
 *      Sabab: ortiqcha pulning ledgerda MANBASI yo'q (u hech qaysi kirim
 *      yozuvidan kelmagan). Uni ham ko'chirsak kassirning qoldig'i MANFIYga
 *      tushib, "kassada minus pul" degan ma'nosiz holat paydo bo'lardi.
 *      Ortiqcha `kassaFarq` da yozib qoldiriladi: direktor uni ko'rib,
 *      kerak bo'lsa alohida KIRIM yozuvi sifatida rasmiylashtiradi
 *      (avtomatik kirim yozib statistikani buzmaymiz).
 *
 * Manfiy qoldiqda (kassadan chiqim kirimdan ko'p) 0 qaytadi — minus pulni
 * ko'chirib bo'lmaydi.
 */
export function kochadiganSumma(sanalganNaqd: number, qoldiq: number): number {
  return Math.max(0, Math.min(sanalganNaqd, qoldiq));
}

/**
 * KUN TOPSHIRIG'INI YARATISH — "kutilmoqda" holatidagi o'tkazma.
 *
 * Pul HALI kassirda turadi (`QOLDIQ_HOLATLARI` da "kutilmoqda" yo'q) —
 * direktor qabul qilgandagina ko'chadi. Bu ataylab: tasdiqlanmagan pul
 * hech kimning kassasida bo'lmagan "limbo" holatga tushmasligi kerak.
 *
 * `summa === 0` bo'lsa o'tkazma yaratilmaydi: naqdsiz kun ham yopiladi,
 * lekin bo'sh pul harakati yozib tarixni ifloslantirmaymiz.
 */
export async function kunTopshiriqYaratTx(
  tx: BusinessTx,
  businessId: string,
  aktor: { userId: string; ism: string | null },
  direktorId: string | null,
  sanalganNaqd: number,
  izoh: string | null,
  /** Topshirish paytida MUZLATILGAN tizim qoldig'i (qayta so'ramaslik uchun). */
  kutilganNaqd: number
): Promise<TopshiriqYaratNatija> {
  const summa = kochadiganSumma(sanalganNaqd, kutilganNaqd);
  if (summa <= 0) return { transferId: null, kochadi: 0, sabab: null };

  const manba = await topshiruvchiKassaTx(tx, businessId, aktor.userId);
  if (!manba.shaxsiy || !manba.accountId) {
    return {
      transferId: null,
      kochadi: 0,
      sabab:
        "Bu bizneste shaxsiy kassa rejimi yoqilmagan — pul allaqachon biznes " +
        "kassasida turibdi, shuning uchun ko'chirilmaydi. Kun yakuni faqat " +
        "solishtiruv sifatida yoziladi.",
    };
  }

  const manzil = await markaziyKassaTx(tx, businessId, direktorId);
  if (!manzil) {
    return {
      transferId: null,
      kochadi: 0,
      sabab: "Qabul qiluvchi kassa topilmadi — direktor tayinlang yoki naqd kassa oching.",
    };
  }
  if (manzil.id === manba.accountId) {
    return {
      transferId: null,
      kochadi: 0,
      sabab: "Topshiruvchi va qabul qiluvchi kassa bir xil — pul ko'chirilmaydi.",
    };
  }

  // IKKI MARTA TOPSHIRISHDAN HIMOYA (birinchi qavat — ikkinchisi kun
  // holatining `OPEN` sharti). Shu kassadan tasdiq kutayotgan kun
  // topshirig'i bo'lsa yangisi yaratilmaydi.
  const ochiq = await tx.accountTransfer.findFirst({
    where: { businessId, fromAccountId: manba.accountId, turi: "smena", holat: "kutilmoqda" },
    select: { id: true },
  });
  if (ochiq) {
    throw new BadRequestError(
      "Sizda tasdiq kutayotgan kassa topshirig'i bor — avval direktor uni qabul qilsin"
    );
  }

  const egalar = await tx.account.findMany({
    where: { id: { in: [manba.accountId, manzil.id] }, businessId },
    select: { id: true, userId: true },
  });
  const egaId = (accId: string) => egalar.find((a) => a.id === accId)?.userId ?? null;
  const toUserId = egaId(manzil.id);
  const ismlar = await tx.user.findMany({
    where: { id: { in: [aktor.userId, toUserId].filter((x): x is string => !!x) } },
    select: { id: true, ism: true },
  });
  const ism = (id: string | null) => (id ? ismlar.find((u) => u.id === id)?.ism ?? null : null);

  const transfer = await tx.accountTransfer.create({
    data: {
      businessId,
      fromAccountId: manba.accountId,
      toAccountId: manzil.id,
      summa,
      valyuta: "UZS",
      // Pul KIRITILGAN paytga yoziladi — kassadagi naqd sanaga emas,
      // haqiqiy harakat paytiga qarab yuradi (kassaTransfer bilan bir xil).
      sana: new Date(),
      izoh: izoh?.trim() || "Kun yakuni — kassa topshirish",
      userId: aktor.userId,
      turi: "smena",
      fromUserId: aktor.userId,
      fromUserIsm: aktor.ism,
      toUserId,
      toUserIsm: ism(toUserId),
      holat: "kutilmoqda",
    },
    select: { id: true },
  });
  return { transferId: transfer.id, kochadi: summa, sabab: null };
}

/**
 * KUN TOPSHIRIG'INI QABUL QILISH — pul haqiqatda ko'chadi.
 *
 * IDEMPOTENT EMAS ATAYLAB: `updateMany` + `holat = "kutilmoqda"` sharti.
 * Ikkinchi marta bosilsa `count === 0` bo'ladi va biz jimgina `false`
 * qaytaramiz — chaqiruvchi (kun tasdiqlash) allaqachon o'z holat qulfiga
 * ega, shuning uchun bu yerda ikkinchi xato tashlash kerak emas; muhimi —
 * PUL IKKI MARTA KO'CHMAYDI.
 */
export async function kunTopshiriqQabulTx(
  tx: BusinessTx,
  businessId: string,
  aktor: { userId: string; ism: string | null },
  transferId: string,
  qarorIzoh: string | null
): Promise<boolean> {
  const mavjud = await tx.accountTransfer.findFirst({
    where: { id: transferId, businessId },
    select: { id: true, fromAccountId: true, summa: true, holat: true },
  });
  if (!mavjud || mavjud.holat !== "kutilmoqda") return false;

  // Oradan boshqa oqim (xarid to'lovi, qo'lda o'tkazma) o'tgan bo'lishi
  // mumkin — kassada pul yetmasa qabul qilib bo'lmaydi, aks holda qoldiq
  // manfiyga tushib ketardi.
  const qoldiq = await kassaQoldiqTx(tx, businessId, mavjud.fromAccountId);
  if (qoldiq < mavjud.summa) {
    throw new BadRequestError(
      `Topshiruvchi kassada endi yetarli pul yo'q (qoldiq: ${qoldiq.toLocaleString("ru-RU")} so'm). ` +
        `Kunni qayta ochib, topshiriqni qaytadan yarating.`
    );
  }

  const n = await tx.accountTransfer.updateMany({
    where: { id: mavjud.id, businessId, holat: "kutilmoqda" },
    data: {
      holat: "bajarildi",
      tasdiqlaganId: aktor.userId,
      tasdiqlaganIsm: aktor.ism,
      tasdiqlanganAt: new Date(),
      qarorIzoh: qarorIzoh?.trim() || undefined,
    },
  });
  return n.count === 1;
}

/**
 * KUN TOPSHIRIG'INI ORQAGA QAYTARISH — kun rad etilganda yoki qayta ochilganda.
 *
 * Ikki holat ATAYLAB turlicha ishlanadi (ledger append-only qoidasi):
 *   - hali "kutilmoqda" bo'lsa — pul umuman ko'chmagan, qator "rad" bo'ladi;
 *   - allaqachon "bajarildi" bo'lsa — o'chirilmaydi, teskari yo'nalishda
 *     STORNO yoziladi va asl qator "bekor" deb belgilanadi. Ikkalasi ham
 *     qoldiqda qoladi va bir-birini nolga chiqaradi.
 */
export async function kunTopshiriqOrqagaTx(
  tx: BusinessTx,
  businessId: string,
  aktor: { userId: string; ism: string | null },
  transferId: string,
  sabab: string | null
): Promise<"rad" | "storno" | "yoq"> {
  const asl = await tx.accountTransfer.findFirst({
    where: { id: transferId, businessId },
  });
  if (!asl) return "yoq";

  if (asl.holat === "kutilmoqda") {
    const n = await tx.accountTransfer.updateMany({
      where: { id: asl.id, businessId, holat: "kutilmoqda" },
      data: {
        holat: "rad",
        tasdiqlaganId: aktor.userId,
        tasdiqlaganIsm: aktor.ism,
        radAt: new Date(),
        qarorIzoh: sabab?.trim() || undefined,
      },
    });
    return n.count === 1 ? "rad" : "yoq";
  }

  if (asl.holat !== "bajarildi") return "yoq";

  // STORNO — qabul qiluvchi kassada pul turibdimi.
  const qoldiq = await kassaQoldiqTx(tx, businessId, asl.toAccountId);
  if (qoldiq < asl.summa) {
    throw new BadRequestError(
      `Qabul qilgan kassada pul qolmagan (qoldiq: ${qoldiq.toLocaleString("ru-RU")} so'm) — ` +
        `topshiriqni orqaga qaytarib bo'lmaydi.`
    );
  }
  await tx.accountTransfer.create({
    data: {
      businessId,
      fromAccountId: asl.toAccountId,
      toAccountId: asl.fromAccountId,
      summa: asl.summa,
      valyuta: asl.valyuta,
      sana: new Date(),
      izoh: `Storno: kun yakuni qayta ochildi${sabab ? ` — ${sabab.trim()}` : ""}`,
      userId: aktor.userId,
      turi: "smena",
      fromUserId: asl.toUserId,
      fromUserIsm: asl.toUserIsm,
      toUserId: asl.fromUserId,
      toUserIsm: asl.fromUserIsm,
      holat: "bajarildi",
      tasdiqlaganId: aktor.userId,
      tasdiqlaganIsm: aktor.ism,
      tasdiqlanganAt: new Date(),
      relatedType: "storno",
      relatedId: asl.id,
    },
  });
  const n = await tx.accountTransfer.updateMany({
    where: { id: asl.id, businessId, holat: "bajarildi" },
    data: { holat: "bekor" },
  });
  if (n.count !== 1) {
    throw new ForbiddenError("O'tkazma holati o'zgarib ketdi, sahifani yangilang");
  }
  return "storno";
}
