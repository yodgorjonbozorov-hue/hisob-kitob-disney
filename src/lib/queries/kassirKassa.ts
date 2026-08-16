import { prisma } from "@/lib/prisma";
import {
  kassaHarakatWhere,
  kassaQoldiqHisobi,
  kassirYozuvWhere,
  naqdYozuvWhere,
  toshkentBugunBoshi,
} from "@/lib/services/kassirKassa";

/**
 * KASSIR KASSASI — o'qish so'rovlari. Faqat o'qish; yozish
 * `lib/services/kassirKassa.ts` da. Hammasi tenant-scoped `prisma` orqali,
 * ya'ni izolyatsiya avtomatik.
 */

export interface TopshiriqDTO {
  id: string;
  /** "topshirish" | "berish" */
  turi: string;
  kassirId: string;
  kassirIsm: string | null;
  qabulIsm: string | null;
  hisoblangan: number;
  topshirilgan: number;
  /** topshirilgan − hisoblangan. Manfiy = KAMOMAD, musbat = ORTIQCHA. */
  farq: number;
  farqYopildi: boolean;
  holat: string;
  izoh: string | null;
  qarorIzoh: string | null;
  topshirilganAt: string;
  qabulAt: string | null;
  radAt: string | null;
}

/** Bitta kassirning kassa holati — "Mening kassam" kartasi va direktor ro'yxati. */
export interface KassaHolatDTO {
  kassirId: string;
  kassirIsm: string;
  /** Hozir kassirning qo'lida turgan naqd (hisoblangan, saqlanmagan). */
  qoldiq: number;
  /** Bugun (Toshkent kuni) kassaga tushgan va kassadan chiqqan naqd. */
  bugungiKirim: number;
  bugungiChiqim: number;
  /** Bugun qabul qilingan topshiriqlar jami. */
  bugunTopshirilgan: number;
  /** Bugun kassaga berilgan pul jami. */
  bugunBerilgan: number;
  /** Kun boshidagi qoldiq (qolganlaridan chiqariladi). */
  boshlangich: number;
  /** Tasdiq kutayotgan topshiriq (bo'lsa) — kassa hali kamaymagan. */
  kutilayotgan: TopshiriqDTO | null;
  /** Kassa yopilganmi (qoldiq 0) yoki ochiqmi. */
  ochiq: boolean;
}

function topshiriqDTO(r: {
  id: string;
  turi: string;
  kassirId: string;
  kassirIsm: string | null;
  qabulIsm: string | null;
  hisoblangan: number;
  topshirilgan: number;
  farq: number;
  farqYopildi: boolean;
  holat: string;
  izoh: string | null;
  qarorIzoh: string | null;
  topshirilganAt: Date;
  qabulAt: Date | null;
  radAt: Date | null;
}): TopshiriqDTO {
  return {
    id: r.id,
    turi: r.turi,
    kassirId: r.kassirId,
    kassirIsm: r.kassirIsm,
    qabulIsm: r.qabulIsm,
    hisoblangan: r.hisoblangan,
    topshirilgan: r.topshirilgan,
    farq: r.farq,
    farqYopildi: r.farqYopildi,
    holat: r.holat,
    izoh: r.izoh,
    qarorIzoh: r.qarorIzoh,
    topshirilganAt: r.topshirilganAt.toISOString(),
    qabulAt: r.qabulAt?.toISOString() ?? null,
    radAt: r.radAt?.toISOString() ?? null,
  };
}

/**
 * "MENING KASSAM" — bitta foydalanuvchining to'liq kassa holati.
 *
 * "Bugungi" oynasi yozuvning `sana` siga emas, `createdAt` iga qarab
 * kesiladi: kassirning qo'lidagi pul yozuv qaysi sana bilan yozilganiga
 * emas, QACHON kiritilganiga qarab to'planadi (smena bilan bir xil qoida).
 */
export async function getKassaHolat(
  businessId: string,
  kassir: { id: string; ism: string }
): Promise<KassaHolatDTO> {
  const kunBoshi = toshkentBugunBoshi();

  const [kirim, chiqim, harakatlar, bugungiKirim, bugungiChiqim, bugungiHarakat, kutilayotgan] =
    await Promise.all([
      prisma.transaction.aggregate({
        where: kassirYozuvWhere(businessId, kassir.id, "kirim"),
        _sum: { summa: true },
      }),
      prisma.transaction.aggregate({
        where: kassirYozuvWhere(businessId, kassir.id, "chiqim"),
        _sum: { summa: true },
      }),
      prisma.cashHandover.groupBy({
        by: ["turi", "farqYopildi"],
        where: kassaHarakatWhere(businessId, kassir.id),
        _sum: { topshirilgan: true, farq: true },
      }),
      prisma.transaction.aggregate({
        where: { ...kassirYozuvWhere(businessId, kassir.id, "kirim"), createdAt: { gte: kunBoshi } },
        _sum: { summa: true },
      }),
      prisma.transaction.aggregate({
        where: { ...kassirYozuvWhere(businessId, kassir.id, "chiqim"), createdAt: { gte: kunBoshi } },
        _sum: { summa: true },
      }),
      prisma.cashHandover.groupBy({
        by: ["turi"],
        where: { ...kassaHarakatWhere(businessId, kassir.id), qabulAt: { gte: kunBoshi } },
        _sum: { topshirilgan: true },
      }),
      prisma.cashHandover.findFirst({
        where: { businessId, kassirId: kassir.id, holat: "kutilmoqda" },
        orderBy: { topshirilganAt: "desc" },
      }),
    ]);

  const qoldiq = kassaQoldiqHisobi(
    kirim._sum.summa ?? 0,
    chiqim._sum.summa ?? 0,
    harakatlar.map((r) => ({
      turi: r.turi,
      farqYopildi: r.farqYopildi,
      topshirilgan: r._sum.topshirilgan ?? 0,
      farq: r._sum.farq ?? 0,
    }))
  );

  const bugunSum = (turi: string) =>
    bugungiHarakat.find((r) => r.turi === turi)?._sum.topshirilgan ?? 0;
  const kirimBugun = bugungiKirim._sum.summa ?? 0;
  const chiqimBugun = bugungiChiqim._sum.summa ?? 0;
  const topshirilganBugun = bugunSum("topshirish");
  const berilganBugun = bugunSum("berish");

  return {
    kassirId: kassir.id,
    kassirIsm: kassir.ism,
    qoldiq,
    bugungiKirim: kirimBugun,
    bugungiChiqim: chiqimBugun,
    bugunTopshirilgan: topshirilganBugun,
    bugunBerilgan: berilganBugun,
    // Kun boshidagi qoldiq — bugungi harakatlarni orqaga qaytarib chiqariladi.
    // (Yopilgan kamomad shu yerda hisobga olinmaydi: u kunlik emas, bir
    // martalik tuzatish — shuning uchun "boshlang'ich" faqat taxminiy ko'rsatkich.)
    boshlangich: qoldiq - kirimBugun + chiqimBugun + topshirilganBugun - berilganBugun,
    kutilayotgan: kutilayotgan ? topshiriqDTO(kutilayotgan) : null,
    ochiq: qoldiq !== 0,
  };
}

/** Bitta kassirning kassa tarixi (topshiriq va pul berishlar). */
export async function listKassaTarix(
  businessId: string,
  kassirId: string,
  limit = 30
): Promise<TopshiriqDTO[]> {
  const rows = await prisma.cashHandover.findMany({
    where: { businessId, kassirId },
    orderBy: { topshirilganAt: "desc" },
    take: limit,
  });
  return rows.map(topshiriqDTO);
}

/** Direktor paneli: tasdiq kutayotgan topshiriqlar. */
export async function listKutilayotganTopshiriqlar(
  businessId: string,
  limit = 50
): Promise<TopshiriqDTO[]> {
  const rows = await prisma.cashHandover.findMany({
    where: { businessId, turi: "topshirish", holat: "kutilmoqda" },
    orderBy: { topshirilganAt: "asc" },
    take: limit,
  });
  return rows.map(topshiriqDTO);
}

/** Biznesdagi barcha topshiriq tarixi (direktor paneli). */
export async function listTopshiriqlar(
  businessId: string,
  limit = 30
): Promise<TopshiriqDTO[]> {
  const rows = await prisma.cashHandover.findMany({
    where: { businessId },
    orderBy: { topshirilganAt: "desc" },
    take: limit,
  });
  return rows.map(topshiriqDTO);
}

/** Kassa qoldig'i bo'lgan bitta foydalanuvchi (direktor ro'yxati qatori). */
export interface KassirQoldiqDTO {
  kassirId: string;
  kassirIsm: string;
  qoldiq: number;
  /** Tasdiq kutayotgan topshiriqlar jami (kassadan hali ayrilmagan). */
  kutilayotganSumma: number;
  ochiq: boolean;
}

/**
 * BARCHA KASSIRLAR QOLDIG'I — direktor paneli va superadmin uchun.
 *
 * Foydalanuvchilar ro'yxati emas, PUL HARAKATI bo'yicha yig'iladi: shu
 * bizneste naqd yozuv kiritgan yoki kassa harakati bo'lgan har kim qatorga
 * tushadi. Shu tarzda "kassir emas, lekin qo'lida pul qolib ketgan" xodim
 * ham ko'rinmay qolmaydi.
 *
 * So'rovlar soni foydalanuvchilar soniga BOG'LIQ EMAS: uchta `groupBy`.
 */
export async function listKassirQoldiqlari(businessId: string): Promise<KassirQoldiqDTO[]> {
  const [yozuvlar, harakatlar, kutilayotganlar] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["userId", "turi"],
      where: { businessId, deletedAt: null, ...naqdYozuvWhere() },
      _sum: { summa: true },
    }),
    prisma.cashHandover.groupBy({
      by: ["kassirId", "turi", "farqYopildi"],
      where: { businessId, holat: "qabul" },
      _sum: { topshirilgan: true, farq: true },
    }),
    prisma.cashHandover.groupBy({
      by: ["kassirId"],
      where: { businessId, holat: "kutilmoqda" },
      _sum: { topshirilgan: true },
    }),
  ]);

  const bosh = () => ({ kirim: 0, chiqim: 0, harakat: 0, kutilayotgan: 0 });
  const map = new Map<string, ReturnType<typeof bosh>>();
  const olish = (id: string) => {
    let q = map.get(id);
    if (!q) map.set(id, (q = bosh()));
    return q;
  };

  for (const r of yozuvlar) {
    const q = olish(r.userId);
    if (r.turi === "kirim") q.kirim += r._sum.summa ?? 0;
    else q.chiqim += r._sum.summa ?? 0;
  }
  for (const r of harakatlar) {
    const q = olish(r.kassirId);
    const topshirilgan = r._sum.topshirilgan ?? 0;
    const farq = r._sum.farq ?? 0;
    q.harakat +=
      r.turi === "berish" ? topshirilgan : -(topshirilgan - (r.farqYopildi ? farq : 0));
  }
  for (const r of kutilayotganlar) {
    olish(r.kassirId).kutilayotgan += r._sum.topshirilgan ?? 0;
  }

  if (map.size === 0) return [];

  const userlar = await prisma.user.findMany({
    where: { id: { in: Array.from(map.keys()) } },
    select: { id: true, ism: true },
  });
  const ismlar = new Map(userlar.map((u) => [u.id, u.ism]));

  return Array.from(map.entries())
    .map(([kassirId, q]) => {
      const qoldiq = q.kirim - q.chiqim + q.harakat;
      return {
        kassirId,
        // Ism topilmasa — foydalanuvchi o'chirilgan; pul esa tarixda qolgan.
        kassirIsm: ismlar.get(kassirId) ?? "O'chirilgan foydalanuvchi",
        qoldiq,
        kutilayotganSumma: q.kutilayotgan,
        ochiq: qoldiq !== 0,
      };
    })
    // Qoldig'i 0 bo'lganlar ham ro'yxatda QOLADI — "Yopilgan" holati ham
    // direktorga kerakli ma'lumot (kim topshirdi, kimda pul qoldi).
    .sort((a, b) => b.qoldiq - a.qoldiq || a.kassirIsm.localeCompare(b.kassirIsm));
}
