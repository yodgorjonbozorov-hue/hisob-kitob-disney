import { prisma } from "@/lib/prisma";

export interface MijozDTO {
  id: string;
  ism: string;
  tel: string | null;
  telegram: string | null;
  izoh: string | null;
  qarzLimit: number | null;
  /** Bekor qilinmagan sotuvlar summasi. */
  jamiSotuv: number;
  sotuvSoni: number;
  /** Yopilmagan "olinadigan" qarz qoldig'i. */
  ochiqQarz: number;
  /** Limit belgilangan va qarz undan oshib ketgan (yoki teng). */
  limitToldi: boolean;
}

/**
 * Mijozlar ro'yxati. Sotuv va qarz jamlanmalari ikkita `groupBy` bilan
 * olinadi — mijoz soni qancha bo'lsa ham 3 ta so'rov (N+1 emas).
 */
export async function listMijozlar(businessId: string): Promise<MijozDTO[]> {
  const contacts = await prisma.contact.findMany({
    where: { businessId, deletedAt: null },
    orderBy: { ism: "asc" },
  });
  if (contacts.length === 0) return [];

  const [sotuvlar, qarzlar] = await Promise.all([
    prisma.sale.groupBy({
      by: ["contactId"],
      where: { businessId, deletedAt: null, contactId: { not: null } },
      _sum: { jamiSumma: true },
      _count: { _all: true },
    }),
    prisma.debt.groupBy({
      by: ["contactId"],
      where: { businessId, isYopilgan: false, turi: "olinadigan", contactId: { not: null } },
      _sum: { jamiSumma: true, tolangan: true },
    }),
  ]);

  const sotuvMap = new Map(
    sotuvlar.map((s) => [s.contactId as string, { summa: s._sum.jamiSumma ?? 0, soni: s._count._all }])
  );
  const qarzMap = new Map(
    qarzlar.map((q) => [
      q.contactId as string,
      (q._sum.jamiSumma ?? 0) - (q._sum.tolangan ?? 0),
    ])
  );

  return contacts.map((c) => {
    const sotuv = sotuvMap.get(c.id);
    const ochiqQarz = qarzMap.get(c.id) ?? 0;
    return {
      id: c.id,
      ism: c.ism,
      tel: c.tel,
      telegram: c.telegram,
      izoh: c.izoh,
      qarzLimit: c.qarzLimit,
      jamiSotuv: sotuv?.summa ?? 0,
      sotuvSoni: sotuv?.soni ?? 0,
      ochiqQarz,
      limitToldi: c.qarzLimit !== null && ochiqQarz >= c.qarzLimit,
    };
  });
}

export interface KartochkaSotuv {
  id: string;
  sana: string;
  mahsulot: string;
  miqdor: number;
  jamiSumma: number;
  tolovTuri: string;
  bekor: boolean;
}

export interface KartochkaQarz {
  id: string;
  sana: string;
  jamiSumma: number;
  tolangan: number;
  qoldiq: number;
  isYopilgan: boolean;
  muddat: string | null;
  izoh: string | null;
}

export interface KartochkaBitim {
  id: string;
  nomi: string;
  summa: number;
  bosqich: string;
}

export interface MijozKartochka {
  mijoz: MijozDTO;
  sotuvlar: KartochkaSotuv[];
  qarzlar: KartochkaQarz[];
  bitimlar: KartochkaBitim[];
}

/** Bitta mijozning butun tarixi — sotuv, qarz va CRM bitimlari bitta joyda. */
export async function getMijozKartochka(
  businessId: string,
  contactId: string
): Promise<MijozKartochka | null> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, businessId, deletedAt: null },
  });
  if (!contact) return null;

  const [sotuvlar, qarzlar, bitimlar] = await Promise.all([
    prisma.sale.findMany({
      where: { businessId, contactId },
      include: { product: { select: { nomi: true } } },
      orderBy: { sana: "desc" },
      take: 50,
    }),
    prisma.debt.findMany({
      where: { businessId, contactId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.deal.findMany({
      where: { businessId, contactId },
      include: { stage: { select: { nomi: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const jamiSotuv = sotuvlar
    .filter((s) => s.deletedAt === null)
    .reduce((a, s) => a + s.jamiSumma, 0);
  const sotuvSoni = sotuvlar.filter((s) => s.deletedAt === null).length;
  const ochiqQarz = qarzlar
    .filter((d) => !d.isYopilgan && d.turi === "olinadigan")
    .reduce((a, d) => a + (d.jamiSumma - d.tolangan), 0);

  return {
    mijoz: {
      id: contact.id,
      ism: contact.ism,
      tel: contact.tel,
      telegram: contact.telegram,
      izoh: contact.izoh,
      qarzLimit: contact.qarzLimit,
      jamiSotuv,
      sotuvSoni,
      ochiqQarz,
      limitToldi: contact.qarzLimit !== null && ochiqQarz >= contact.qarzLimit,
    },
    sotuvlar: sotuvlar.map((s) => ({
      id: s.id,
      sana: s.sana.toISOString(),
      mahsulot: s.product.nomi,
      miqdor: s.miqdor,
      jamiSumma: s.jamiSumma,
      tolovTuri: s.tolovTuri,
      bekor: s.deletedAt !== null,
    })),
    qarzlar: qarzlar.map((d) => ({
      id: d.id,
      sana: d.createdAt.toISOString(),
      jamiSumma: d.jamiSumma,
      tolangan: d.tolangan,
      qoldiq: d.jamiSumma - d.tolangan,
      isYopilgan: d.isYopilgan,
      muddat: d.muddat ? d.muddat.toISOString() : null,
      izoh: d.izoh,
    })),
    bitimlar: bitimlar.map((b) => ({
      id: b.id,
      nomi: b.nomi,
      summa: b.summa,
      bosqich: b.stage.nomi,
    })),
  };
}
