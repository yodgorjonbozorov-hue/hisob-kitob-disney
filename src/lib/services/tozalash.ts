import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { currentTenantId } from "@/lib/db/tenantContext";
import { ZAXIRA_JADVALLARI } from "@/lib/backup/dump";
import { logAudit } from "@/lib/services/audit";

/**
 * BIZNESNI BOSHLANG'ICH HOLATGA QAYTARISH ("test ma'lumotlarini tozalash").
 *
 * ═══ NIMA UCHUN KERAK ═══
 * Mijoz tizimni sinab ko'radi: bir necha yozuv kiritadi, kassa ochadi, pul
 * o'tkazadi. Haqiqiy ish boshlanishidan oldin bu raqamlar YO'QOLISHI kerak,
 * aks holda birinchi oylik hisobot test puli bilan aralashib ketadi.
 *
 * Yozuvni bittalab o'chirish ish bermaydi: kassaga bog'langan tranzaksiyani
 * butunlay o'chirish ataylab TAQIQLANGAN (u ledger qatori). Shuning uchun
 * "hammasini birdan, bilib turib" degan alohida amal kerak.
 *
 * ═══ NIMA O'CHADI, NIMA QOLADI ═══
 * O'chadi — ISH MA'LUMOTLARI: yozuvlar, o'tkazmalar, sotuvlar, qarzlar,
 * kunlik hisobotlar, smenalar, xaridlar, HR hisob-kitoblari.
 * Qoladi — SOZLAMALAR: kassalar, kategoriyalar, mahsulotlar, mijozlar,
 * ta'minotchilar, xodimlar, rollar va foydalanuvchilar.
 *
 * AUDIT JURNALI ATAYLAB O'CHIRILMAYDI: u "kim nima qildi" tarixi va uni
 * tozalashning ma'nosi yo'q — aksincha, tozalashning o'zi ham shu yerga
 * yoziladi.
 *
 * ═══ TARTIB ═══
 * `ZAXIRA_JADVALLARI` bog'liqlik tartibida (ota-jadval oldin) tuzilgan va
 * `tests/backup.test.ts` buni majburlaydi. Shuning uchun bu yerda ro'yxat
 * TESKARI aylantiriladi — bola-jadvallar birinchi o'chadi va FK buzilmaydi.
 * Yangi model qo'shilganda alohida tartib yozish shart emas.
 */

/** O'chiriladigan jadvallar — ish ma'lumotlari (sozlamalar emas). */
const TOZALANADIGAN: ReadonlySet<string> = new Set([
  "transaction",
  "shiftClose",
  "productExpense",
  "stockEntry",
  "stockAdjustment",
  "sale",
  "debt",
  "debtPayment",
  "deal",
  "task",
  "activity",
  "accountTransfer",
  "purchaseOrder",
  "purchaseOrderItem",
  "approvalRequest",
  "attendance",
  "payroll",
  "payrollAdvance",
  "attachment",
  "dailyReport",
  "dailyTransaction",
  "smena",
  "cashHandover",
]);

/**
 * Ro'yxatdagi har nom `ZAXIRA_JADVALLARI` da bo'lishi SHART — aks holda
 * xato yozilgan nom jimgina e'tiborsiz qolardi va o'sha jadval tozalanmasdi.
 * Modul yuklanganda bir marta tekshiriladi (tests/tozalash.test.ts qo'riqlaydi).
 */
for (const jadval of TOZALANADIGAN) {
  if (!(ZAXIRA_JADVALLARI as readonly string[]).includes(jadval)) {
    throw new Error(`Tozalash ro'yxatidagi '${jadval}' ZAXIRA_JADVALLARI da yo'q`);
  }
}

export interface TozalashNatija {
  /** Jadval → o'chirilgan yozuvlar soni. */
  ochirilgan: Record<string, number>;
  jami: number;
  /** O'chirilgan kassalar (shaxsiy bo'lmaganlari, so'ralgan bo'lsa). */
  ochirilganKassalar: string[];
  /** Yangi ochilgan shaxsiy kassalar (rejim shu yerda yoqilgan bo'lsa). */
  yaratilganKassalar: string[];
  /** Tozalashdan keyingi jami kassa qoldig'i — 0 bo'lishi SHART. */
  keyingiQoldiq: number;
}

export interface TozalashAktor {
  userId: string;
  ism: string;
  rol: string;
}

/**
 * @param tasdiqNomi Foydalanuvchi qo'lda yozgan biznes nomi. Aynan mos
 *   kelmasa amal bajarilmaydi — tasodifiy bosishdan yagona himoya shu.
 */
export async function biznesTozala(
  businessId: string,
  aktor: TozalashAktor,
  opts: { tasdiqNomi: string; kassalarniOchir: boolean }
): Promise<TozalashNatija> {
  if (aktor.rol !== "OWNER") {
    throw new ForbiddenError("Tozalashni faqat direktor bajara oladi");
  }

  const natija = await runBusinessTx(businessId, async (tx) => {
    // runBusinessTx kelishuvi: xom `tx` — businessId sharti QO'LDA.
    const biznes = await tx.business.findFirst({
      where: { id: businessId },
      select: { nomi: true },
    });
    if (!biznes) throw new ForbiddenError("Biznes topilmadi");
    if (biznes.nomi.trim() !== opts.tasdiqNomi.trim()) {
      throw new BadRequestError("Biznes nomi mos kelmadi — tozalash bekor qilindi");
    }

    const ochirilgan: Record<string, number> = {};
    let jami = 0;

    // Bola-jadvaldan ota-jadvalga (ro'yxat teskari aylantiriladi).
    for (const jadval of [...ZAXIRA_JADVALLARI].reverse()) {
      if (!TOZALANADIGAN.has(jadval)) continue;
      const delegate = (tx as unknown as Record<string, { deleteMany: (a: unknown) => Promise<{ count: number }> }>)[
        jadval
      ];
      if (!delegate?.deleteMany) {
        throw new Error(`Tozalash: '${jadval}' jadvali Prisma clientda topilmadi`);
      }
      const r = await delegate.deleteMany({ where: { businessId } });
      if (r.count > 0) {
        ochirilgan[jadval] = r.count;
        jami += r.count;
      }
    }

    // Ombor qoldig'i tranzaksiyalardan EMAS, `Product.miqdor` da saqlanadi —
    // kirim/sotuv yozuvlari o'chgach u ham nolga tushirilishi shart, aks holda
    // ombor "tovar bor" deb turaveradi.
    const mahsulot = await tx.product.updateMany({
      where: { businessId, miqdor: { not: 0 } },
      data: { miqdor: 0 },
    });
    if (mahsulot.count > 0) ochirilgan["product.miqdor→0"] = mahsulot.count;

    // Kassalar: SHAXSIY kassalar (Account.userId) har doim qoladi — ular
    // xodimga biriktirilgan sozlama.
    //
    // Shaxsiy kassa umuman bo'lmasa amal RAD ETILMAYDI, balki avval har faol
    // xodimga kassa ochiladi va shaxsiy kassa rejimi yoqiladi. Aks holda
    // foydalanuvchi "avval rejimni yoq, keyin tozala" degan tartibni o'zi
    // eslab qolishi kerak bo'lardi — va tartibni buzsa xato oladi.
    const ochirilganKassalar: string[] = [];
    const yaratilganKassalar: string[] = [];
    if (opts.kassalarniOchir) {
      const shaxsiy = await tx.account.count({ where: { businessId, userId: { not: null } } });
      if (shaxsiy === 0) {
        yaratilganKassalar.push(...(await shaxsiyKassalarniOchTx(tx, businessId)));
        if (yaratilganKassalar.length === 0) {
          throw new BadRequestError(
            "Shaxsiy kassa ochish uchun faol xodim topilmadi — umumiy kassalarni " +
              "o'chirsak biznes kassasiz qolardi."
          );
        }
        await tx.business.updateMany({ where: { id: businessId }, data: { shaxsiyKassa: true } });
      }

      const umumiy = await tx.account.findMany({
        where: { businessId, userId: null },
        select: { id: true, nomi: true },
      });
      for (const k of umumiy) {
        await tx.account.deleteMany({ where: { id: k.id, businessId } });
        ochirilganKassalar.push(k.nomi);
      }
    }

    const keyingiQoldiq = await qoldiqJamiTx(tx, businessId);
    if (keyingiQoldiq !== 0) {
      // Bu yerga tushish — mantiqiy xato: barcha yozuv va o'tkazma o'chdi,
      // demak qoldiq 0 bo'lishi shart. Tranzaksiya qaytariladi.
      throw new Error(`Tozalashdan keyin qoldiq 0 emas (${keyingiQoldiq}) — amal bekor qilindi`);
    }

    return { ochirilgan, jami, ochirilganKassalar, yaratilganKassalar, keyingiQoldiq };
  });

  await logAudit({
    businessId,
    action: "delete",
    entity: "business",
    entityId: businessId,
    after: {
      amal: "tozalash",
      jami: natija.jami,
      jadvallar: natija.ochirilgan,
      kassalar: natija.ochirilganKassalar,
      yangiKassalar: natija.yaratilganKassalar,
    },
  });
  return natija;
}

/**
 * Har faol xodimga shaxsiy kassa ochadi (tranzaksiya ichida).
 *
 * `api/businesses/[id]` dagi bir xil amalning tranzaksiya varianti: u yerda
 * rejim tugmasi bosilganda, bu yerda esa tozalash paytida chaqiriladi.
 * Nom to'qnashsa raqam qo'shiladi — Account [businessId, nomi] UNIQUE.
 */
async function shaxsiyKassalarniOchTx(tx: BusinessTx, businessId: string): Promise<string[]> {
  const tenantId = currentTenantId();
  // runBusinessTx kelishuvi: xom `tx` — tenant/business sharti QO'LDA.
  const xodimlar = await tx.user.findMany({
    where: { tenantId, isActive: true, OR: [{ businessId }, { businessId: null }] },
    select: { id: true, ism: true },
    orderBy: { ism: "asc" },
  });
  const band = new Set(
    (await tx.account.findMany({ where: { businessId }, select: { nomi: true } })).map((a) => a.nomi)
  );

  const yaratilgan: string[] = [];
  for (const x of xodimlar) {
    let nomi = `${x.ism} kassasi`;
    for (let i = 2; band.has(nomi) && i <= 20; i++) nomi = `${x.ism} kassasi ${i}`;
    band.add(nomi);
    await tx.account.create({
      data: { businessId, nomi, turi: "naqd", userId: x.id, tartib: 10 },
    });
    yaratilgan.push(nomi);
  }
  return yaratilgan;
}

/** Tozalashdan keyingi jami kassa qoldig'i — nol ekanini tasdiqlash uchun. */
async function qoldiqJamiTx(tx: BusinessTx, businessId: string): Promise<number> {
  const [kirim, chiqim] = await Promise.all([
    tx.transaction.aggregate({
      where: { businessId, deletedAt: null, turi: "kirim", accountId: { not: null } },
      _sum: { summa: true },
    }),
    tx.transaction.aggregate({
      where: { businessId, deletedAt: null, turi: "chiqim", accountId: { not: null } },
      _sum: { summa: true },
    }),
  ]);
  // O'tkazmalar jami qoldiqni o'zgartirmaydi (bir kassadan chiqib boshqasiga
  // kiradi), shuning uchun kirim − chiqim yetarli.
  return (kirim._sum.summa ?? 0) - (chiqim._sum.summa ?? 0);
}
