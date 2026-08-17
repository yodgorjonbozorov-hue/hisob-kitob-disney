import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { ortachaKgNarxi } from "@/lib/kg";

/**
 * KG SAVDOSI HISOBOTI (mijozga xos — Fortex Selos, lib/mijozXos.ts).
 *
 * MANBA — YOZUVLARNING O'ZI (`Transaction`), ikkinchi balans tizimi
 * yaratilmaydi: pul allaqachon kassaga tushgan, bu yerda faqat KESIM
 * olinadi. Shu bois:
 *
 *   PUL (`summa`)      — moliyaviy balans, kassa qoldig'ida hisobga olingan;
 *   OG'IRLIK (`miqdorGr`) — mahsulot ko'rsatkichi, kassa qoldig'iga KIRMAYDI.
 *
 * O'rtacha narx — faqat statistik ko'rsatkich (jami summa / jami kg).
 * Har yozuvdagi real `kgNarxi` o'zgarmaydi.
 */

export interface KgSavdoQatori {
  id: string;
  /** Yozuv sanasi (ISO). */
  sana: string;
  createdAt: string;
  miqdorGr: number;
  kgNarxi: number;
  summa: number;
  kategoriya: string;
  sotuvchi: string | null;
  kassa: string | null;
  izoh: string | null;
}

/** Kesim (sotuvchi / kassa / kategoriya bo'yicha jamlanma). */
export interface KgKesim {
  id: string;
  nomi: string;
  miqdorGr: number;
  summa: number;
  /** Shu kesimdagi o'rtacha sotuv narxi (so'm/kg) — statistik. */
  ortacha: number;
}

export interface KgSavdoHisoboti {
  jamiGr: number;
  jamiSumma: number;
  /** Jami summa / jami kg — statistik ko'rsatkich. */
  ortachaNarx: number;
  savdoSoni: number;
  sotuvchilar: KgKesim[];
  kassalar: KgKesim[];
  kategoriyalar: KgKesim[];
  qatorlar: KgSavdoQatori[];
}

/** Bir kunlik (yoki `to` berilsa — davr) kg savdosi. */
export async function getKgSavdo(
  businessId: string,
  from: string,
  to?: string
): Promise<KgSavdoHisoboti> {
  const boshi = dateOnlyStringToUTCDate(from);
  const oxiri = new Date(dateOnlyStringToUTCDate(to ?? from).getTime() + 24 * 60 * 60 * 1000);

  // Bir biznesning bir kunidagi kg savdolari — o'nlab qator. Jamlash JS'da
  // qilinadi: sotuvchi/kassa/kategoriya kesimlari va qatorlar ro'yxati
  // uchun BITTA so'rov yetadi (uchta groupBy o'rniga).
  const rows = await prisma.transaction.findMany({
    where: {
      businessId,
      deletedAt: null,
      turi: "kirim",
      sana: { gte: boshi, lt: oxiri },
      miqdorGr: { not: null },
      category: { kgAsosli: true },
    },
    include: {
      category: { select: { id: true, nomi: true } },
      user: { select: { id: true, ism: true } },
      account: { select: { id: true, nomi: true } },
    },
    orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });

  const sotuvchilar = new Map<string, KgKesim>();
  const kassalar = new Map<string, KgKesim>();
  const kategoriyalar = new Map<string, KgKesim>();
  let jamiGr = 0;
  let jamiSumma = 0;

  function qosh(map: Map<string, KgKesim>, id: string, nomi: string, gr: number, summa: number) {
    const bor = map.get(id);
    if (bor) {
      bor.miqdorGr += gr;
      bor.summa += summa;
      bor.ortacha = ortachaKgNarxi(bor.summa, bor.miqdorGr);
      return;
    }
    map.set(id, { id, nomi, miqdorGr: gr, summa, ortacha: ortachaKgNarxi(summa, gr) });
  }

  const qatorlar: KgSavdoQatori[] = rows.map((t) => {
    const gr = t.miqdorGr ?? 0;
    jamiGr += gr;
    jamiSumma += t.summa;
    qosh(sotuvchilar, t.userId, t.user?.ism ?? "Noma'lum", gr, t.summa);
    // Qarzga yozilgan savdo hech qaysi kassaga bog'lanmaydi (accountId null) —
    // u "Qarz" kesimida ko'rinadi, aks holda kassa hisobiga soxta pul qo'shilardi.
    qosh(kassalar, t.accountId ?? "qarz", t.account?.nomi ?? "Qarz (kassasiz)", gr, t.summa);
    qosh(kategoriyalar, t.category.id, t.category.nomi, gr, t.summa);
    return {
      id: t.id,
      sana: t.sana.toISOString(),
      createdAt: t.createdAt.toISOString(),
      miqdorGr: gr,
      kgNarxi: t.kgNarxi ?? 0,
      summa: t.summa,
      kategoriya: t.category.nomi,
      sotuvchi: t.user?.ism ?? null,
      kassa: t.account?.nomi ?? null,
      izoh: t.izoh,
    };
  });

  const kamayish = (a: KgKesim, b: KgKesim) => b.miqdorGr - a.miqdorGr;

  return {
    jamiGr,
    jamiSumma,
    ortachaNarx: ortachaKgNarxi(jamiSumma, jamiGr),
    savdoSoni: rows.length,
    sotuvchilar: [...sotuvchilar.values()].sort(kamayish),
    kassalar: [...kassalar.values()].sort(kamayish),
    kategoriyalar: [...kategoriyalar.values()].sort(kamayish),
    qatorlar,
  };
}

export interface KgSavdoJami {
  jamiGr: number;
  jamiSumma: number;
  ortachaNarx: number;
}

/**
 * Yengil variant — faqat jamilar (dashboard "Bugun" bloki va kunlik hisobot
 * uchun). Qatorlar o'qilmaydi.
 */
export async function getKgSavdoJami(businessId: string, sana: string): Promise<KgSavdoJami> {
  const boshi = dateOnlyStringToUTCDate(sana);
  const oxiri = new Date(boshi.getTime() + 24 * 60 * 60 * 1000);

  const jami = await prisma.transaction.aggregate({
    where: {
      businessId,
      deletedAt: null,
      turi: "kirim",
      sana: { gte: boshi, lt: oxiri },
      miqdorGr: { not: null },
      category: { kgAsosli: true },
    },
    _sum: { miqdorGr: true, summa: true },
  });

  const jamiGr = jami._sum.miqdorGr ?? 0;
  const jamiSumma = jami._sum.summa ?? 0;
  return { jamiGr, jamiSumma, ortachaNarx: ortachaKgNarxi(jamiSumma, jamiGr) };
}

/**
 * Har kg kategoriyasidagi OXIRGI sotuv narxi — kg oynasidagi boshlang'ich
 * qiymat. Faqat taklif: sotuvchi uni har savdoda o'zgartira oladi va yozuv
 * o'z narxini saqlaydi (narx hech qayerga qotirilmaydi).
 */
export async function oxirgiKgNarxlari(
  businessId: string,
  categoryIds: string[]
): Promise<Record<string, number>> {
  const natija: Record<string, number> = {};
  await Promise.all(
    categoryIds.map(async (categoryId) => {
      const oxirgi = await prisma.transaction.findFirst({
        where: { businessId, categoryId, deletedAt: null, kgNarxi: { not: null } },
        orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
        select: { kgNarxi: true },
      });
      if (oxirgi?.kgNarxi) natija[categoryId] = oxirgi.kgNarxi;
    })
  );
  return natija;
}

/** Biznesda kg savdosi kategoriyasi bormi (UI blokini bekorga ko'rsatmaslik uchun). */
export async function kgKategoriyaBormi(businessId: string): Promise<boolean> {
  const bor = await prisma.category.findFirst({
    where: { businessId, kgAsosli: true },
    select: { id: true },
  });
  return !!bor;
}
