import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { currentTenantId } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { TOSHKENT_OFFSET_MS } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import type { PulBerishInput, QarorInput, TopshirishInput } from "@/lib/validation/kassirKassa";

/**
 * KASSIR KASSASI — kassirning QO'LIDAGI real naqd pul.
 *
 * ═══ ASOSIY INVARIANT ═══
 * Bu modul biznes hisobotiga (Kirim / Chiqim / Naqd / Click / Qarz / Sof)
 * UMUMAN TEGMAYDI. Bu yerda:
 *   - hech qanday `Transaction` yozilmaydi, o'zgartirilmaydi, o'chirilmaydi;
 *   - hech qanday `Account`/`AccountTransfer` (biznes kassalari ledgeri)
 *     qo'zg'atilmaydi.
 * Kassir pulni direktorga topshirsa, pul biznesdan CHIQMAYDI — faqat egasi
 * almashadi. Shuning uchun kirim/chiqim/sof va barcha hisobotlar avvalgidek
 * qoladi; o'zgaradigan yagona narsa — kassirning kassa qoldig'i.
 *
 * ═══ QOLDIQ FORMULASI ═══
 *   qoldiq = naqd kirim(kassir) − naqd chiqim(kassir)
 *          + qabul qilingan "berish"lar
 *          − qabul qilingan "topshirish"lar (yopilgan farq bilan tuzatilib)
 *
 * Qoldiq BAZADA SAQLANMAYDI — har safar ledgerdan hisoblanadi. Saqlangan
 * `currentBalance` ustuni bo'lganda ikkita haqiqat manbai paydo bo'lardi va
 * ular birinchi uzilishdayoq ajralib ketardi.
 *
 * ═══ NIMA "KASSAGA TUSHGAN NAQD" ═══
 * Faqat NAQD pul: Click (plastik/bank) kassirning qo'liga tushmaydi, qarz
 * esa umuman pul emas. Naqdlik qoidasi smena bilan BIR XIL (`naqdChiqimmi`):
 * yozuvda to'lov turi ko'rsatilgan bo'lsa — o'sha, ko'rsatilmagan eski
 * yozuvlarda kassa turidan chiqariladi. Qarz keyin naqd to'langanda odatdagi
 * naqd kirim yozuvi paydo bo'ladi va kassaga o'sha payt tushadi.
 *
 * ═══ NEGA QABUL QILUVCHIGA QO'SHILMAYDI ═══
 * Topshiriq qabul qilinganda pul kassirdan AYRILADI, lekin qabul qiluvchining
 * kassasiga QO'SHILMAYDI. Sabab: qabul qiluvchi — zanjirning oxiri (seyf),
 * va o'sha pul biznes darajasida allaqachon `Account` (Kassalar) ledgerida
 * turibdi. Qo'shilsa bir pul ikki marta sanalardi. Shuning uchun "jami
 * kassalardagi pul" = HALI TOPSHIRILMAGAN naqd — nazorat uchun kerak bo'lgan
 * aynan shu raqam.
 */

/** Toshkent bo'yicha bugungi kun boshining UTC instanti. */
export function toshkentBugunBoshi(now: Date = new Date()): Date {
  const siljigan = new Date(now.getTime() + TOSHKENT_OFFSET_MS);
  const yarimTun = Date.UTC(
    siljigan.getUTCFullYear(),
    siljigan.getUTCMonth(),
    siljigan.getUTCDate()
  );
  return new Date(yarimTun - TOSHKENT_OFFSET_MS);
}

/**
 * NAQD yozuv filtri — `naqdChiqimmi()` qoidasining Prisma ko'rinishi.
 * Uchala shart o'sha funksiyaning uchala tarmog'iga aynan mos keladi.
 */
export function naqdYozuvWhere(): Prisma.TransactionWhereInput {
  return {
    OR: [
      { tolovTuri: "naqd" },
      { tolovTuri: null, account: { turi: "naqd" } },
      { tolovTuri: null, accountId: null },
    ],
  };
}

/** Bitta kassirning naqd yozuvlari filtri (kirim yoki chiqim). */
export function kassirYozuvWhere(
  businessId: string,
  kassirId: string,
  turi: "kirim" | "chiqim"
): Prisma.TransactionWhereInput {
  return { businessId, userId: kassirId, turi, deletedAt: null, ...naqdYozuvWhere() };
}

/** Qoldiqqa ta'sir qiladigan kassa harakatlari (faqat QABUL qilinganlari). */
export function kassaHarakatWhere(
  businessId: string,
  kassirId: string
): Prisma.CashHandoverWhereInput {
  return { businessId, kassirId, holat: "qabul" };
}

/** Bitta kassa harakati qatorining qoldiqqa ta'siri (sof funksiya). */
export interface KassaHarakatQatori {
  turi: string;
  farqYopildi: boolean;
  topshirilgan: number;
  farq: number;
}

/**
 * Harakatning qoldiqqa qo'shadigan (musbat) yoki ayiradigan (manfiy) ta'siri.
 *
 *  - "berish": kassirga pul berildi -> +topshirilgan.
 *  - "topshirish", farq YOPILGAN: kassadan `topshirilgan − farq` ayriladi.
 *    Kamomadda (farq < 0) bu topshirilgandan KO'P ayiradi — yetishmagan pul
 *    ham hisobdan chiqadi va kassa 0 ga tushadi. Ortiqchada (farq > 0) kamroq
 *    ayiradi — ortiqcha pul kassaga kiritiladi va kassa yana 0 bo'ladi.
 *  - "topshirish", farq OCHIQ: faqat `topshirilgan` ayriladi — kamomad
 *    kassirning kassasida qarz bo'lib qolib ketadi.
 */
export function harakatTasiri(h: KassaHarakatQatori): number {
  if (h.turi === "berish") return h.topshirilgan;
  return -(h.topshirilgan - (h.farqYopildi ? h.farq : 0));
}

/** Xom agregatlardan kassa qoldig'ini yig'adi — SOF funksiya (test oson). */
export function kassaQoldiqHisobi(
  naqdKirim: number,
  naqdChiqim: number,
  harakatlar: KassaHarakatQatori[]
): number {
  return (
    naqdKirim - naqdChiqim + harakatlar.reduce((a, h) => a + harakatTasiri(h), 0)
  );
}

/** Prisma groupBy natijasini sof funksiya kutgan shaklga keltiradi. */
function harakatQatorlari(
  rows: { turi: string; farqYopildi: boolean; _sum: { topshirilgan: number | null; farq: number | null } }[]
): KassaHarakatQatori[] {
  return rows.map((r) => ({
    turi: r.turi,
    farqYopildi: r.farqYopildi,
    topshirilgan: r._sum.topshirilgan ?? 0,
    farq: r._sum.farq ?? 0,
  }));
}

/**
 * KASSA QOLDIG'I — tranzaksiya ICHIDA (xom `tx`, businessId qo'lda).
 * Topshiriq yaratish va qabul qilishda aynan shu qiymat muzlatiladi.
 */
export async function kassaQoldiqTx(
  tx: BusinessTx,
  businessId: string,
  kassirId: string
): Promise<number> {
  const [kirim, chiqim, harakatlar] = await Promise.all([
    tx.transaction.aggregate({
      where: kassirYozuvWhere(businessId, kassirId, "kirim"),
      _sum: { summa: true },
    }),
    tx.transaction.aggregate({
      where: kassirYozuvWhere(businessId, kassirId, "chiqim"),
      _sum: { summa: true },
    }),
    tx.cashHandover.groupBy({
      by: ["turi", "farqYopildi"],
      where: kassaHarakatWhere(businessId, kassirId),
      _sum: { topshirilgan: true, farq: true },
    }),
  ]);
  return kassaQoldiqHisobi(
    kirim._sum.summa ?? 0,
    chiqim._sum.summa ?? 0,
    harakatQatorlari(harakatlar)
  );
}

/** KASSA QOLDIG'I — sahifa/API o'qishi uchun (tenant-scoped `prisma`). */
export async function kassaQoldiq(businessId: string, kassirId: string): Promise<number> {
  const [kirim, chiqim, harakatlar] = await Promise.all([
    prisma.transaction.aggregate({
      where: kassirYozuvWhere(businessId, kassirId, "kirim"),
      _sum: { summa: true },
    }),
    prisma.transaction.aggregate({
      where: kassirYozuvWhere(businessId, kassirId, "chiqim"),
      _sum: { summa: true },
    }),
    prisma.cashHandover.groupBy({
      by: ["turi", "farqYopildi"],
      where: kassaHarakatWhere(businessId, kassirId),
      _sum: { topshirilgan: true, farq: true },
    }),
  ]);
  return kassaQoldiqHisobi(
    kirim._sum.summa ?? 0,
    chiqim._sum.summa ?? 0,
    harakatQatorlari(harakatlar)
  );
}

export interface KassaAktor {
  userId: string;
  ism: string;
  rol: string;
}

/** Foydalanuvchi shu tenantda va faolmi — tranzaksiya ichida tekshiriladi. */
async function faolUserTx(tx: BusinessTx, userId: string): Promise<{ id: string; ism: string }> {
  const tenantId = currentTenantId();
  // runBusinessTx kelishuvi: xom `tx` — tenant sharti QO'LDA.
  const user = await tx.user.findFirst({
    where: { id: userId, tenantId, isActive: true },
    select: { id: true, ism: true },
  });
  if (!user) throw new ForbiddenError("Foydalanuvchi topilmadi yoki faol emas");
  return user;
}

/**
 * KASSANI TOPSHIRISH — kassir tizim hisoblagan qoldiqni topshiradi.
 *
 * `hisoblangan` serverda, tranzaksiya ICHIDA hisoblanadi va muzlatiladi:
 * kassir so'rov tanasida boshqa raqam yuborsa ham e'tiborga olinmaydi.
 * Bir vaqtda bittadan ortiq kutilayotgan topshiriq bo'lmaydi — aks holda
 * bir pul ikki marta topshirilgandek ko'rinardi.
 */
export async function topshiriqYarat(
  businessId: string,
  aktor: KassaAktor,
  data: TopshirishInput
) {
  const topshiriq = await runBusinessTx(businessId, async (tx) => {
    const kassir = await faolUserTx(tx, aktor.userId);

    const kutayotgan = await tx.cashHandover.findFirst({
      where: { businessId, kassirId: kassir.id, holat: "kutilmoqda" },
      select: { id: true },
    });
    if (kutayotgan) {
      throw new BadRequestError(
        "Sizda tasdiq kutayotgan topshiriq bor — avval direktor uni qabul qilsin yoki uni bekor qiling"
      );
    }

    const hisoblangan = await kassaQoldiqTx(tx, businessId, kassir.id);
    // Ikkalasi ham 0 bo'lsa topshiriqning ma'nosi yo'q. Manfiy qoldiq
    // (ochiq kamomad) esa RUXSAT etiladi: 0 topshirish + direktor farqni
    // yopishi — kamomadni hisobdan chiqarishning yagona yo'li.
    if (hisoblangan === 0 && data.topshirilgan === 0) {
      throw new BadRequestError("Kassangiz bo'sh — topshiriladigan pul yo'q");
    }

    return tx.cashHandover.create({
      data: {
        businessId,
        turi: "topshirish",
        kassirId: kassir.id,
        kassirIsm: kassir.ism,
        hisoblangan,
        topshirilgan: data.topshirilgan,
        farq: data.topshirilgan - hisoblangan,
        holat: "kutilmoqda",
        izoh: data.izoh?.trim() || undefined,
        topshirilganAt: new Date(),
      },
    });
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "cashHandover",
    entityId: topshiriq.id,
    after: {
      turi: "topshirish",
      kassirIsm: topshiriq.kassirIsm,
      hisoblangan: topshiriq.hisoblangan,
      topshirilgan: topshiriq.topshirilgan,
      farq: topshiriq.farq,
      holat: topshiriq.holat,
    },
  });
  return topshiriq;
}

/**
 * DIREKTOR QARORI — qabul qilish yoki rad etish.
 *
 * ATOMIK va IDEMPOTENT EMAS ATAYLAB: qator faqat `holat = "kutilmoqda"`
 * bo'lgandagina yangilanadi (`updateMany` + `count` tekshiruvi), shuning
 * uchun ikkinchi marta "Qabul qilish" bosilsa yoki ikki direktor bir vaqtda
 * bossa — ikkinchisi xato oladi va pul ikki marta hisobdan chiqmaydi.
 */
export async function topshiriqQaror(
  businessId: string,
  aktor: KassaAktor,
  topshiriqId: string,
  qaror: QarorInput
) {
  const natija = await runBusinessTx(businessId, async (tx) => {
    const mavjud = await tx.cashHandover.findFirst({
      where: { id: topshiriqId, businessId },
    });
    if (!mavjud) throw new BadRequestError("Topshiriq topilmadi");
    if (mavjud.turi !== "topshirish") {
      throw new BadRequestError("Kassaga pul berish qarorni talab qilmaydi");
    }
    if (mavjud.holat !== "kutilmoqda") {
      throw new BadRequestError("Bu topshiriq bo'yicha qaror allaqachon qabul qilingan");
    }

    if (qaror.amal === "bekor") {
      // Bekor qilish — TOPSHIRUVCHINING o'zi yoki boshqaruvchi.
      if (mavjud.kassirId !== aktor.userId && !isManager(aktor.rol)) {
        throw new ForbiddenError("Bu topshiriqni bekor qila olmaysiz");
      }
      const n = await tx.cashHandover.updateMany({
        where: { id: mavjud.id, businessId, holat: "kutilmoqda" },
        data: { holat: "bekor" },
      });
      if (n.count !== 1) throw new BadRequestError("Topshiriq holati o'zgarib ketdi, sahifani yangilang");
      return { eski: mavjud, holat: "bekor" as const, farqYopildi: false };
    }

    if (!isManager(aktor.rol)) {
      throw new ForbiddenError("Kassa topshirig'ini faqat direktor yoki admin qabul qiladi");
    }
    const qabulQiluvchi = await faolUserTx(tx, aktor.userId);

    if (qaror.amal === "rad") {
      const n = await tx.cashHandover.updateMany({
        where: { id: mavjud.id, businessId, holat: "kutilmoqda" },
        data: {
          holat: "rad",
          qabulId: qabulQiluvchi.id,
          qabulIsm: qabulQiluvchi.ism,
          radAt: new Date(),
          qarorIzoh: qaror.qarorIzoh?.trim() || undefined,
        },
      });
      if (n.count !== 1) throw new BadRequestError("Topshiriq holati o'zgarib ketdi, sahifani yangilang");
      return { eski: mavjud, holat: "rad" as const, farqYopildi: false };
    }

    // QABUL QILISH. Ortiqchada farq har doim yopiladi — manfiy kassa
    // qoldig'ining ma'nosi yo'q. Kamomadda qaror direktorniki: yopilmasa
    // yetishmagan pul kassirning kassasida ochiq qarz bo'lib qoladi.
    const farqYopildi = mavjud.farq > 0 ? true : qaror.farqYopildi === true;

    const n = await tx.cashHandover.updateMany({
      where: { id: mavjud.id, businessId, holat: "kutilmoqda" },
      data: {
        holat: "qabul",
        qabulId: qabulQiluvchi.id,
        qabulIsm: qabulQiluvchi.ism,
        qabulAt: new Date(),
        farqYopildi,
        qarorIzoh: qaror.qarorIzoh?.trim() || undefined,
      },
    });
    if (n.count !== 1) throw new BadRequestError("Topshiriq holati o'zgarib ketdi, sahifani yangilang");

    // Qabuldan KEYINGI qoldiq — kassirga ko'rsatiladigan raqam.
    const yangiQoldiq = await kassaQoldiqTx(tx, businessId, mavjud.kassirId);
    return { eski: mavjud, holat: "qabul" as const, farqYopildi, yangiQoldiq };
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "cashHandover",
    entityId: topshiriqId,
    before: { holat: "kutilmoqda" },
    after: {
      holat: natija.holat,
      qabulIsm: aktor.ism,
      hisoblangan: natija.eski.hisoblangan,
      topshirilgan: natija.eski.topshirilgan,
      farq: natija.eski.farq,
      farqYopildi: natija.farqYopildi,
    },
  });
  return natija;
}

/**
 * KASSAGA PUL BERISH — direktor kassirga boshlang'ich (yoki qaytim) puli beradi.
 *
 * Bu ham kirim/chiqim EMAS: pul biznes seyfidan kassirning qo'liga o'tdi,
 * xolos. Tasdiq talab qilmaydi — direktorning o'zi yozadi, shuning uchun
 * darhol "qabul" holatida yaraladi.
 */
export async function kassagaPulBer(
  businessId: string,
  aktor: KassaAktor,
  data: PulBerishInput
) {
  if (!isManager(aktor.rol)) {
    throw new ForbiddenError("Kassaga pulni faqat direktor yoki admin bera oladi");
  }

  const yozuv = await runBusinessTx(businessId, async (tx) => {
    const kassir = await faolUserTx(tx, data.kassirId);
    const beruvchi = await faolUserTx(tx, aktor.userId);
    const now = new Date();
    return tx.cashHandover.create({
      data: {
        businessId,
        turi: "berish",
        kassirId: kassir.id,
        kassirIsm: kassir.ism,
        qabulId: beruvchi.id,
        qabulIsm: beruvchi.ism,
        hisoblangan: 0,
        topshirilgan: data.summa,
        farq: 0,
        holat: "qabul",
        farqYopildi: false,
        izoh: data.izoh?.trim() || undefined,
        topshirilganAt: now,
        qabulAt: now,
      },
    });
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "cashHandover",
    entityId: yozuv.id,
    after: {
      turi: "berish",
      kassirIsm: yozuv.kassirIsm,
      summa: yozuv.topshirilgan,
      bergan: yozuv.qabulIsm,
    },
  });
  return yozuv;
}
