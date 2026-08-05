import { prisma } from "@/lib/prisma";
import type { IlovaEntity } from "@/lib/validation/hujjat";

export interface IlovaDTO {
  id: string;
  nomi: string;
  url: string;
  saqlagich: string;
  mimeType: string | null;
  hajm: number | null;
  createdAt: string;
}

export interface ShartnomaDTO {
  id: string;
  raqam: string;
  nomi: string;
  turi: string;
  kontragentNomi: string | null;
  summa: number;
  boshlanish: string;
  tugash: string | null;
  eslatmaKun: number;
  holat: string;
  izoh: string | null;
  /** Tugashiga necha kun qolgan (tugash yo'q bo'lsa null; manfiy — o'tib ketgan). */
  kunQoldi: number | null;
  /** Eslatma oynasiga kirdimi (yoki muddati o'tdimi). */
  ogohlantirish: boolean;
  ilovalar: IlovaDTO[];
}

/** Ikki sana orasidagi to'liq kunlar (UTC yarim tunlari bo'yicha). */
function kunFarqi(dan: Date, gacha: Date): number {
  const KUN = 24 * 60 * 60 * 1000;
  const a = Date.UTC(dan.getUTCFullYear(), dan.getUTCMonth(), dan.getUTCDate());
  const b = Date.UTC(gacha.getUTCFullYear(), gacha.getUTCMonth(), gacha.getUTCDate());
  return Math.round((b - a) / KUN);
}

export async function listShartnomalar(
  businessId: string,
  bugun: Date = new Date()
): Promise<ShartnomaDTO[]> {
  const rows = await prisma.contract.findMany({
    where: { businessId, deletedAt: null },
    include: {
      contact: { select: { ism: true } },
      supplier: { select: { nomi: true } },
    },
    // Muddati yaqinlari tepada: `tugash` bo'yicha o'sish tartibida.
    orderBy: [{ tugash: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  if (rows.length === 0) return [];

  // Bitta so'rovda barcha ilovalar — shartnoma soni qancha bo'lsa ham N+1 yo'q.
  const ilovalar = await prisma.attachment.findMany({
    where: {
      businessId,
      entity: "contract",
      entityId: { in: rows.map((r) => r.id) },
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  const ilovaMap = new Map<string, IlovaDTO[]>();
  for (const i of ilovalar) {
    const royxat = ilovaMap.get(i.entityId) ?? [];
    royxat.push({
      id: i.id,
      nomi: i.nomi,
      url: i.url,
      saqlagich: i.saqlagich,
      mimeType: i.mimeType,
      hajm: i.hajm,
      createdAt: i.createdAt.toISOString(),
    });
    ilovaMap.set(i.entityId, royxat);
  }

  return rows.map((r) => {
    const kunQoldi = r.tugash ? kunFarqi(bugun, r.tugash) : null;
    return {
      id: r.id,
      raqam: r.raqam,
      nomi: r.nomi,
      turi: r.turi,
      kontragentNomi: r.contact?.ism ?? r.supplier?.nomi ?? r.kontragent,
      summa: r.summa,
      boshlanish: r.boshlanish.toISOString(),
      tugash: r.tugash ? r.tugash.toISOString() : null,
      eslatmaKun: r.eslatmaKun,
      holat: r.holat,
      izoh: r.izoh,
      kunQoldi,
      ogohlantirish: r.holat === "faol" && kunQoldi !== null && kunQoldi <= r.eslatmaKun,
      ilovalar: ilovaMap.get(r.id) ?? [],
    };
  });
}

/** Bitta yozuvga biriktirilgan ilovalar (tranzaksiya, qarz, bitim, vazifa). */
export async function listIlovalar(
  businessId: string,
  entity: IlovaEntity,
  entityId: string
): Promise<IlovaDTO[]> {
  const rows = await prisma.attachment.findMany({
    where: { businessId, entity, entityId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((i) => ({
    id: i.id,
    nomi: i.nomi,
    url: i.url,
    saqlagich: i.saqlagich,
    mimeType: i.mimeType,
    hajm: i.hajm,
    createdAt: i.createdAt.toISOString(),
  }));
}

export interface HujjatStats {
  faolShartnoma: number;
  /** Muddati yaqinlashgan yoki o'tib ketgan faol shartnomalar. */
  ogohlantirish: number;
  jamiIlova: number;
}

export async function getHujjatStats(
  businessId: string,
  bugun: Date = new Date()
): Promise<HujjatStats> {
  const [faollar, jamiIlova] = await Promise.all([
    prisma.contract.findMany({
      where: { businessId, deletedAt: null, holat: "faol" },
      select: { tugash: true, eslatmaKun: true },
    }),
    prisma.attachment.count({ where: { businessId, deletedAt: null } }),
  ]);

  const ogohlantirish = faollar.filter(
    (c) => c.tugash !== null && kunFarqi(bugun, c.tugash) <= c.eslatmaKun
  ).length;

  return { faolShartnoma: faollar.length, ogohlantirish, jamiIlova };
}

/** Bildirishnomalar ro'yxati uchun — muddati yaqinlashgan shartnomalar. */
export async function muddatiYaqinShartnomalar(
  businessId: string,
  bugun: Date = new Date()
): Promise<{ raqam: string; nomi: string; kunQoldi: number }[]> {
  const rows = await prisma.contract.findMany({
    where: { businessId, deletedAt: null, holat: "faol", tugash: { not: null } },
    select: { raqam: true, nomi: true, tugash: true, eslatmaKun: true },
  });
  return rows
    .map((c) => ({
      raqam: c.raqam,
      nomi: c.nomi,
      kunQoldi: kunFarqi(bugun, c.tugash!),
      eslatmaKun: c.eslatmaKun,
    }))
    .filter((c) => c.kunQoldi <= c.eslatmaKun)
    .sort((a, b) => a.kunQoldi - b.kunQoldi)
    .map(({ raqam, nomi, kunQoldi }) => ({ raqam, nomi, kunQoldi }));
}
