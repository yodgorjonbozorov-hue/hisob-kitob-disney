import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { qidiruvRejimi } from "@/lib/db/dialect";
import { businessQueryRaw, businessScope, songa } from "@/lib/db/businessRaw";
import { getOmborKartasi, type OmborBirlikDTO } from "@/lib/queries/inventory";
import type { OmborRoyxatInput } from "@/lib/validation/taminot";
// Holat qoidasi klient kartochkasi bilan BIR XIL manbadan (lib/omborHolat.ts):
// u yerda server importi yo'q, shuning uchun brauzer to'plamiga prisma tortilmaydi.
import { mahsulotHolati, type MahsulotHolati } from "@/lib/omborHolat";

/**
 * OMBOR SAHIFASINING O'QISH SO'ROVLARI.
 *
 * NEGA ALOHIDA FAYL: eski Ombor sahifasi BARCHA mahsulotni bir so'rovda
 * brauzerga yuborib, qidiruv va filtrni o'sha yerda qilardi. 1000+ tovarli
 * do'konda bu har ochilishda megabaytlarcha JSON va sekin telefon degani.
 * Bu yerdagi so'rovlar SERVER TOMONDA qidiradi va sahifalaydi — brauzerga
 * faqat ko'rinadigan 24 ta kartochka boradi.
 *
 * QOLDIQ MANBASI baribir `Product.miqdor` (yagona manba). Bu yerda hech
 * narsa qayta jamlanmaydi — aks holda ikkinchi, undan farq qiladigan
 * "haqiqat" paydo bo'lardi.
 */


export interface OmborMahsulotDTO {
  id: string;
  nomi: string;
  rasmUrl: string | null;
  categoryId: string | null;
  kategoriyaNomi: string | null;
  birlik: string;
  miqdor: number;
  minQoldiq: number;
  kelganNarx: number;
  sotuvNarx: number;
  sku: string | null;
  isActive: boolean;
  holat: MahsulotHolati;
  /** Qoldiqning tannarx bo'yicha qiymati (miqdor × kelganNarx). */
  qiymat: number;
}

export interface OmborRoyxatDTO {
  mahsulotlar: OmborMahsulotDTO[];
  jami: number;
  sahifa: number;
  limit: number;
  /** Yana sahifa bormi — "Ko'proq yuklash" tugmasi shunga qarab chiqadi. */
  yanaBor: boolean;
}

/**
 * Filtr shartini quradi.
 *
 * "Kam qolgan" — `minQoldiq` belgilangan va qoldiq undan past (lekin 0 emas:
 * nol alohida "Tugagan" holati). Chegarasi yo'q mahsulot hech qachon "kam"
 * bo'lmaydi — bu ataylab: tuxum sotuvchi bilan avtosalon uchun bitta sobit
 * chegara ma'nosiz.
 */
function mahsulotWhere(businessId: string, f: OmborRoyxatInput): Prisma.ProductWhereInput {
  const q = f.q?.trim();
  return {
    businessId,
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    ...(f.holat === "tugagan" ? { miqdor: { lte: 0 } } : {}),
    ...(f.holat === "kam"
      ? { AND: [{ miqdor: { gt: 0 } }, { minQoldiq: { gt: 0 } }] }
      : {}),
    ...(q
      ? {
          OR: [
            { nomi: { contains: q, ...qidiruvRejimi() } },
            { sku: { contains: q, ...qidiruvRejimi() } },
            { barcode: { contains: q, ...qidiruvRejimi() } },
          ],
        }
      : {}),
  };
}

/**
 * Sahifalangan mahsulotlar ro'yxati.
 *
 * "Kam qolgan" filtri ikki qadamda: SQL `minQoldiq > 0 AND miqdor > 0` ni
 * tanlaydi, `miqdor <= minQoldiq` esa ustunlar taqqoslovi bo'lgani uchun
 * Prisma `where` bilan ifodalanmaydi. Shuning uchun shu bitta holatda
 * chegarasi belgilangan mahsulotlar (odatda ozchilik) o'qilib, qolgan
 * shart kodda qo'llanadi va sahifalash O'SHA to'plamdan olinadi.
 */
export async function listOmborMahsulotlar(
  businessId: string,
  f: OmborRoyxatInput
): Promise<OmborRoyxatDTO> {
  const where = mahsulotWhere(businessId, f);
  const skip = (f.sahifa - 1) * f.limit;

  if (f.holat === "kam") {
    const hammasi = await prisma.product.findMany({
      where,
      orderBy: [{ nomi: "asc" }],
      include: { category: { select: { nomi: true } } },
    });
    const kamlar = hammasi.filter((p) => p.miqdor <= p.minQoldiq);
    return {
      mahsulotlar: kamlar.slice(skip, skip + f.limit).map(dto),
      jami: kamlar.length,
      sahifa: f.sahifa,
      limit: f.limit,
      yanaBor: skip + f.limit < kamlar.length,
    };
  }

  const [rows, jami] = await Promise.all([
    prisma.product.findMany({
      where,
      // Faol mahsulot yuqorida; keyin alifbo tartibida (kartochka gridida
      // "yaqinda qo'shilgan" tartibi foydalanuvchini adashtiradi).
      orderBy: [{ isActive: "desc" }, { nomi: "asc" }],
      skip,
      take: f.limit,
      include: { category: { select: { nomi: true } } },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    mahsulotlar: rows.map(dto),
    jami,
    sahifa: f.sahifa,
    limit: f.limit,
    yanaBor: skip + rows.length < jami,
  };
}

type ProductRow = Prisma.ProductGetPayload<{ include: { category: { select: { nomi: true } } } }>;

function dto(p: ProductRow): OmborMahsulotDTO {
  return {
    id: p.id,
    nomi: p.nomi,
    rasmUrl: p.rasmUrl,
    categoryId: p.categoryId,
    kategoriyaNomi: p.category?.nomi ?? null,
    birlik: p.birlik,
    miqdor: p.miqdor,
    minQoldiq: p.minQoldiq,
    kelganNarx: p.kelganNarx,
    sotuvNarx: p.sotuvNarx,
    sku: p.sku,
    isActive: p.isActive,
    holat: mahsulotHolati(p.miqdor, p.minQoldiq),
    qiymat: p.miqdor * p.kelganNarx,
  };
}

export interface OmborKpiDTO {
  /** Faol mahsulot turlari soni (qoldig'i yo'qlari ham). */
  turlarSoni: number;
  /**
   * Qoldiq BIRLIKLAR BO'YICHA. Ataylab bitta raqamga qo'shilmaydi:
   * "500 dona + 120 kg = 620" matematik jihatdan ma'nosiz.
   */
  birliklar: OmborBirlikDTO[];
  /** Eng ko'p tur shu birlikda — kartadagi katta raqam shundan. */
  asosiy: OmborBirlikDTO | null;
  /** Ombor qiymati (so'm) — tannarx bo'yicha. */
  omborQiymati: number;
  /** Chegarasidan past tushgan (lekin tugamagan) mahsulotlar soni. */
  kamQolgan: number;
  /** Qoldig'i nolga tushgan faol mahsulotlar soni. */
  tugagan: number;
}

/**
 * KPI kartalari — to'rt raqam, to'rttasi ham bitta so'rov to'plamidan.
 *
 * Ombor qiymati `getOmborKartasi` dan olinadi (bosh sahifadagi karta bilan
 * AYNI manba), shuning uchun ikki joyda ikki xil raqam chiqmaydi.
 */
export async function omborKpi(businessId: string): Promise<OmborKpiDTO> {
  const [karta, turlarSoni, holatlar] = await Promise.all([
    getOmborKartasi(businessId),
    prisma.product.count({ where: { businessId, isActive: true } }),
    businessQueryRaw<{ kam: unknown; tugagan: unknown }>(Prisma.sql`
      SELECT
        SUM(CASE WHEN p."miqdor" > 0 AND p."minQoldiq" > 0 AND p."miqdor" <= p."minQoldiq"
                 THEN 1 ELSE 0 END) AS kam,
        SUM(CASE WHEN p."miqdor" <= 0 THEN 1 ELSE 0 END) AS tugagan
      FROM "Product" p
      JOIN "Business" b ON b."id" = p."businessId"
      WHERE ${businessScope("p", businessId)}
        AND p."isActive" = ${true}
    `),
  ]);

  return {
    turlarSoni,
    birliklar: karta.birliklar,
    asosiy: karta.asosiy,
    omborQiymati: karta.jamiQiymat,
    kamQolgan: songa(holatlar[0]?.kam),
    tugagan: songa(holatlar[0]?.tugagan),
  };
}

// ---------------------------------------------------------------------------
// Mahsulot tafsiloti va harakatlar tarixi
// ---------------------------------------------------------------------------

export interface HarakatDTO {
  id: string;
  /** "taminot" | "sotuv" | "chiqarish" | "inventarizatsiya" | "taminot_bekor" */
  turi: string;
  /** Musbat — qoldiq oshdi, manfiy — kamaydi. */
  farq: number;
  /** Birlik narxi (ta'minotda tannarx, sotuvda sotuv narxi). Bo'lmasa null. */
  birlikNarx: number | null;
  izoh: string | null;
  sana: string;
}

export interface MahsulotDetalDTO extends OmborMahsulotDTO {
  barcode: string | null;
  izoh: string | null;
  harakatlar: HarakatDTO[];
}

/**
 * Mahsulot tafsiloti + harakatlar tarixi.
 *
 * Tarix UCH manbadan yig'iladi va sana bo'yicha birlashtiriladi:
 *   `StockEntry`      — ta'minot (+),
 *   `Sale`            — sotuv (−, bekor qilinganlari chiqmaydi),
 *   `StockAdjustment` — hisobdan chiqarish / inventarizatsiya / ta'minot bekori (±).
 * Bu qoldiqni QAYTA HISOBLAMAYDI — faqat "qoldiq nega o'zgardi" degan
 * savolga javob beradi; qoldiqning o'zi baribir `Product.miqdor` da.
 */
export async function mahsulotDetal(
  businessId: string,
  productId: string,
  harakatLimit = 30
): Promise<MahsulotDetalDTO | null> {
  const p = await prisma.product.findFirst({
    where: { id: productId, businessId },
    include: { category: { select: { nomi: true } } },
  });
  if (!p) return null;

  const [kirimlar, sotuvlar, togrilashlar] = await Promise.all([
    prisma.stockEntry.findMany({
      where: { businessId, productId },
      orderBy: { createdAt: "desc" },
      take: harakatLimit,
    }),
    prisma.sale.findMany({
      where: { businessId, productId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: harakatLimit,
    }),
    prisma.stockAdjustment.findMany({
      where: { businessId, productId },
      orderBy: { createdAt: "desc" },
      take: harakatLimit,
    }),
  ]);

  const harakatlar: HarakatDTO[] = [
    ...kirimlar.map((k) => ({
      id: `kirim:${k.id}`,
      turi: "taminot",
      farq: k.miqdor,
      birlikNarx: k.birlikNarx,
      izoh: k.izoh,
      sana: k.createdAt.toISOString(),
    })),
    ...sotuvlar.map((s) => ({
      id: `sotuv:${s.id}`,
      turi: "sotuv",
      farq: -s.miqdor,
      birlikNarx: s.birlikNarx,
      izoh: s.mijozNomi,
      sana: s.sana.toISOString(),
    })),
    ...togrilashlar.map((a) => ({
      id: `togri:${a.id}`,
      turi: a.turi,
      farq: a.farq,
      birlikNarx: null,
      izoh: a.sabab,
      sana: a.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => (a.sana < b.sana ? 1 : a.sana > b.sana ? -1 : 0))
    .slice(0, harakatLimit);

  return { ...dto(p), barcode: p.barcode, izoh: p.izoh, harakatlar };
}

/** Kategoriya chiplari — mavjud `ProductCategory` modeli qayta ishlatiladi. */
export interface OmborKategoriyaDTO {
  id: string;
  nomi: string;
  soni: number;
}

export async function listOmborKategoriyalar(businessId: string): Promise<OmborKategoriyaDTO[]> {
  const [kategoriyalar, sonlar] = await Promise.all([
    prisma.productCategory.findMany({
      where: { businessId, isActive: true, deletedAt: null },
      orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
      select: { id: true, nomi: true },
    }),
    // Bitta `groupBy` — kategoriya soni qancha bo'lsa ham N+1 bo'lmaydi.
    prisma.product.groupBy({
      by: ["categoryId"],
      where: { businessId, isActive: true },
      _count: { _all: true },
    }),
  ]);
  const soniMap = new Map(sonlar.map((s) => [s.categoryId, s._count._all]));
  return kategoriyalar.map((k) => ({ ...k, soni: soniMap.get(k.id) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Ta'minotlar (Ombor ichidagi ikkinchi tab)
// ---------------------------------------------------------------------------

export interface TaminotSatrDTO {
  productId: string;
  nomi: string;
  rasmUrl: string | null;
  birlik: string;
  miqdor: number;
  birlikNarx: number;
  jamiSumma: number;
}

export interface TaminotDTO {
  id: string;
  supplierId: string;
  supplierNomi: string;
  /** "qoralama" | "tasdiqlangan" | "qabul_qilingan" | "bekor" */
  holat: string;
  sana: string;
  qabulSana: string | null;
  /** "naqd" | "qarz" — bazadagi qiymat. */
  tolovTuri: string;
  jamiSumma: number;
  tolanganSumma: number;
  /** Qoldiq qarz — "Men qarzdorman" bo'limiga tushgan summa. */
  qoldiqQarz: number;
  /** Ochiq qarz yozuvi (bo'lsa) — tafsilotdan qarzga o'tish uchun. */
  debtId: string | null;
  mahsulotSoni: number;
  jamiMiqdor: number;
  izoh: string | null;
  bekorSabab: string | null;
  satrlar: TaminotSatrDTO[];
}

export interface TaminotRoyxatDTO {
  taminotlar: TaminotDTO[];
  jami: number;
  yanaBor: boolean;
}

/**
 * TA'MINOTLAR RO'YXATI.
 *
 * `listOrders` (lib/queries/xarid.ts) dan farqi: sahifalanadi, bekor qilish
 * izini ham qaytaradi va satrlarda mahsulot rasmi bor (ro'yxatdagi kichik
 * ko'rinish uchun). Ikkalasi ham bitta jadvaldan o'qiydi — `PurchaseOrder`.
 */
export async function listTaminotlar(
  businessId: string,
  opts: { sahifa?: number; limit?: number; supplierId?: string | null } = {}
): Promise<TaminotRoyxatDTO> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const sahifa = Math.max(opts.sahifa ?? 1, 1);
  const where = {
    businessId,
    ...(opts.supplierId ? { supplierId: opts.supplierId } : {}),
  };

  const [rows, jami] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { nomi: true } },
        items: {
          include: { product: { select: { nomi: true, birlik: true, rasmUrl: true } } },
        },
      },
      // Qabul sanasi bo'lsa o'sha — tovar HAQIQATDA kelgan kun; qoralamada
      // reja sanasi qoladi.
      orderBy: [{ qabulSana: "desc" }, { sana: "desc" }, { createdAt: "desc" }],
      skip: (sahifa - 1) * limit,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  const taminotlar = rows.map((o) => ({
    id: o.id,
    supplierId: o.supplierId,
    supplierNomi: o.supplier.nomi,
    holat: o.holat,
    sana: o.sana.toISOString(),
    qabulSana: o.qabulSana ? o.qabulSana.toISOString() : null,
    tolovTuri: o.tolovTuri,
    jamiSumma: o.jamiSumma,
    tolanganSumma: o.tolanganSumma,
    qoldiqQarz:
      o.holat === "qabul_qilingan" ? Math.max(0, o.jamiSumma - o.tolanganSumma) : 0,
    debtId: o.debtId,
    mahsulotSoni: o.items.length,
    jamiMiqdor: o.items.reduce((a, i) => a + i.miqdor, 0),
    izoh: o.izoh,
    bekorSabab: o.bekorSabab,
    satrlar: o.items.map((i) => ({
      productId: i.productId,
      nomi: i.product.nomi,
      rasmUrl: i.product.rasmUrl,
      birlik: i.product.birlik,
      miqdor: i.miqdor,
      birlikNarx: i.birlikNarx,
      jamiSumma: i.jamiSumma,
    })),
  }));

  return {
    taminotlar,
    jami,
    yanaBor: (sahifa - 1) * limit + rows.length < jami,
  };
}

/** Bitta ta'minot tafsiloti (biznes sharti bilan — begona yozuv ko'rinmaydi). */
export async function taminotDetal(
  businessId: string,
  orderId: string
): Promise<TaminotDTO | null> {
  const o = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, businessId },
    include: {
      supplier: { select: { nomi: true } },
      items: { include: { product: { select: { nomi: true, birlik: true, rasmUrl: true } } } },
    },
  });
  if (!o) return null;
  return {
    id: o.id,
    supplierId: o.supplierId,
    supplierNomi: o.supplier.nomi,
    holat: o.holat,
    sana: o.sana.toISOString(),
    qabulSana: o.qabulSana ? o.qabulSana.toISOString() : null,
    tolovTuri: o.tolovTuri,
    jamiSumma: o.jamiSumma,
    tolanganSumma: o.tolanganSumma,
    qoldiqQarz: o.holat === "qabul_qilingan" ? Math.max(0, o.jamiSumma - o.tolanganSumma) : 0,
    debtId: o.debtId,
    mahsulotSoni: o.items.length,
    jamiMiqdor: o.items.reduce((a, i) => a + i.miqdor, 0),
    izoh: o.izoh,
    bekorSabab: o.bekorSabab,
    satrlar: o.items.map((i) => ({
      productId: i.productId,
      nomi: i.product.nomi,
      rasmUrl: i.product.rasmUrl,
      birlik: i.product.birlik,
      miqdor: i.miqdor,
      birlikNarx: i.birlikNarx,
      jamiSumma: i.jamiSumma,
    })),
  };
}
