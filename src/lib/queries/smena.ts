import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import {
  joriyChegara,
  kutilganNaqdHisobi,
  oynaJamla,
  type SmenaOynaSummasi,
} from "@/lib/services/smena";

/**
 * SMENA o'qish so'rovlari. Faqat o'qish — yozish `lib/services/smena.ts` da.
 * Hammasi tenant-scoped `prisma` orqali (izolyatsiya avtomatik).
 */

export interface SmenaDTO {
  id: string;
  raqam: number;
  /** ISO — oyna boshi va oxiri (UI'da Toshkent soati bilan ko'rsatiladi). */
  boshlanishAt: string;
  tugashAt: string;
  yopganIsm: string | null;
  naqd: number;
  click: number;
  qarz: number;
  naqdChiqim: number;
  boshlangichQoldiq: number;
  kutilganNaqd: number;
  sanalganNaqd: number;
  /** sanalganNaqd − kutilganNaqd. Manfiy = KAM. */
  farq: number;
  qoldirilganNaqd: number;
  izoh: string | null;
}

/** Joriy (hali yopilmagan) smena — jonli hisoblanadi, bazada qatori yo'q. */
export interface JoriySmenaDTO extends SmenaOynaSummasi {
  raqam: number;
  boshlanishAt: string;
  boshlangichQoldiq: number;
  kutilganNaqd: number;
}

export interface SmenaHolatDTO {
  /** Shu kunda yopilgan smenalar (tartib bo'yicha). */
  yopilganlar: SmenaDTO[];
  /** Joriy smena — faqat BUGUN uchun to'ldiriladi (o'tgan kunda null). */
  joriy: JoriySmenaDTO | null;
}

function smenaDTO(r: {
  id: string;
  raqam: number;
  boshlanishAt: Date;
  tugashAt: Date;
  yopganIsm: string | null;
  naqd: number;
  click: number;
  qarz: number;
  naqdChiqim: number;
  boshlangichQoldiq: number;
  kutilganNaqd: number;
  sanalganNaqd: number;
  farq: number;
  qoldirilganNaqd: number;
  izoh: string | null;
}): SmenaDTO {
  return {
    id: r.id,
    raqam: r.raqam,
    boshlanishAt: r.boshlanishAt.toISOString(),
    tugashAt: r.tugashAt.toISOString(),
    yopganIsm: r.yopganIsm,
    naqd: r.naqd,
    click: r.click,
    qarz: r.qarz,
    naqdChiqim: r.naqdChiqim,
    boshlangichQoldiq: r.boshlangichQoldiq,
    kutilganNaqd: r.kutilganNaqd,
    sanalganNaqd: r.sanalganNaqd,
    farq: r.farq,
    qoldirilganNaqd: r.qoldirilganNaqd,
    izoh: r.izoh,
  };
}

/**
 * Joriy smenaning JONLI holati: oxirgi yopilgan smenadan hozirgacha bo'lgan
 * oynadagi tushum va naqd chiqim.
 *
 * Xizmatdagi (`smenaYop`) hisob bilan bir xil formula ishlatiladi — farqi
 * shundaki, bu yerda oyna oxiri ochiq (hozirgi payt) va tenant-scoped
 * `prisma` orqali o'qiladi.
 */
export async function getJoriySmena(businessId: string, bugunStr: string): Promise<JoriySmenaDTO> {
  const [oxirgi, bugungiSoni] = await Promise.all([
    prisma.smena.findFirst({
      where: { businessId },
      orderBy: { tugashAt: "desc" },
      select: { tugashAt: true, qoldirilganNaqd: true },
    }),
    prisma.smena.count({ where: { businessId, sana: dateOnlyStringToUTCDate(bugunStr) } }),
  ]);
  const chegara = joriyChegara(oxirgi, bugungiSoni, bugunStr);
  const oynaFiltri = { gt: chegara.boshlanishAt };

  const [tushumlar, chiqimlar] = await Promise.all([
    prisma.dailyTransaction.groupBy({
      by: ["tolovTuri"],
      where: { businessId, deletedAt: null, createdAt: oynaFiltri },
      _sum: { summa: true },
    }),
    prisma.transaction.findMany({
      where: { businessId, turi: "chiqim", deletedAt: null, createdAt: oynaFiltri },
      select: { summa: true, tolovTuri: true, account: { select: { turi: true } } },
    }),
  ]);

  const oyna = oynaJamla(tushumlar, chiqimlar);
  return {
    raqam: chegara.raqam,
    boshlanishAt: chegara.boshlanishAt.toISOString(),
    boshlangichQoldiq: chegara.boshlangichQoldiq,
    ...oyna,
    kutilganNaqd: kutilganNaqdHisobi(chegara.boshlangichQoldiq, oyna),
  };
}

/** Bir kunning smena holati: yopilganlari va (bugun bo'lsa) joriysi. */
export async function getSmenaHolat(
  businessId: string,
  sanaStr: string,
  bugunStr: string
): Promise<SmenaHolatDTO> {
  const [yopilganlar, joriy] = await Promise.all([
    prisma.smena.findMany({
      where: { businessId, sana: dateOnlyStringToUTCDate(sanaStr) },
      orderBy: { raqam: "asc" },
    }),
    sanaStr === bugunStr ? getJoriySmena(businessId, bugunStr) : Promise.resolve(null),
  ]);
  return { yopilganlar: yopilganlar.map(smenaDTO), joriy };
}
