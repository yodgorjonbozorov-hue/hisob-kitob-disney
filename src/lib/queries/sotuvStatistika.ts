import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";

/**
 * SOTILGAN MAHSULOTLAR STATISTIKASI — "Kirim" (Yozuvlar) sahifasidagi blok.
 *
 * MANBA: `Sale` jadvali va FAQAT U. Ombordan sotuv qaysi yo'l bilan bo'lmasin
 * (Sotuv sahifasi, POS cheki, bot) — har satr uchun bitta `Sale` yozuvi
 * tushadi, shuning uchun bu yerda hech narsa qo'lda kiritilmaydi va
 * statistika sotuv bilan BIR VAQTDA shakllanadi.
 *
 * NEGA `Transaction` EMAS: naqd sotuv bitta kirim tranzaksiya yozadi, POS
 * cheki esa 10 satr uchun ham BITTA tranzaksiya yozadi, qarzga sotuv esa
 * umuman tranzaksiya yozmaydi. Ya'ni tranzaksiyadan mahsulot kesimini
 * tiklab bo'lmaydi. `Sale` esa uchala holatda ham bir xil to'ldiriladi —
 * shu bois IKKI MARTA HAM sanalmaydi (chek satrlari bitta chekdan keladi,
 * chekning o'zi bu yerda umuman ishtirok etmaydi).
 *
 * QAYTARISH: sotuvni bekor qilish (`cancelSale`) va chekni qaytarish
 * (`chekniBekorQilish`) `Sale.deletedAt` ni belgilaydi va ombor qoldig'ini
 * tiklaydi. Shuning uchun `deletedAt: null` sharti qaytarilgan mahsulotni
 * statistikadan AVTOMATIK ayiradi — qoldiq bilan statistika bir xil
 * qoidadan yuradi va hech qachon ajralib ketmaydi.
 *
 * SANA: `Sale.sana` (UTC yarim tuni) — `createdAt` emas. Kechagi sotuvni
 * bugun kiritish mumkin va u kechagi kunga tushishi kerak.
 */

/** Bitta mahsulot kesimi — kun davomidagi barcha sotuvlar JAMLANGAN holda. */
export interface SotilganMahsulotDTO {
  productId: string;
  nomi: string;
  kategoriya: string;
  /** "dona" | "kg" | "litr" ... — miqdor shu birlikda o'qiladi. */
  birlik: string;
  miqdor: number;
  summa: number;
  /** Necha marta sotilgani — bitta qatorga nechta sotuv jamlangani. */
  sotuvSoni: number;
}

/** Miqdor BIRLIKLAR bo'yicha: "500 dona + 120 kg = 620" ma'nosiz raqam. */
export interface SotuvBirlikDTO {
  birlik: string;
  miqdor: number;
}

export interface SotuvKategoriyaDTO {
  /** Kategoriyasiz mahsulotlar guruhida null. */
  kategoriyaId: string | null;
  nomi: string;
  summa: number;
  birliklar: SotuvBirlikDTO[];
  mahsulotlar: SotilganMahsulotDTO[];
}

export interface SotuvYakuniDTO {
  jamiSumma: number;
  /** Sotilgan mahsulot TURLARI soni ("24 xil"). */
  mahsulotTurlari: number;
  /** Ro'yxatda ko'rinadigan guruhlar soni. */
  kategoriyalar: number;
  birliklar: SotuvBirlikDTO[];
  /** Shu oraliqda qaytarilgan (bekor qilingan) sotuvlar — yuqoridagi
   *  raqamlardan ALLAQACHON ayrilgan, faqat ma'lumot uchun ko'rsatiladi. */
  qaytarilgan: { soni: number; summa: number };
}

export interface SotuvStatistikaDTO {
  from: string;
  to: string;
  yakun: SotuvYakuniDTO;
  kategoriyalar: SotuvKategoriyaDTO[];
}

const KATEGORIYASIZ = "Kategoriyasiz";

/** Bo'sh natija — biznes yo'q yoki oraliqda sotuv bo'lmagan holat uchun. */
export function boshSotuvStatistika(from: string, to: string): SotuvStatistikaDTO {
  return {
    from,
    to,
    yakun: {
      jamiSumma: 0,
      mahsulotTurlari: 0,
      kategoriyalar: 0,
      birliklar: [],
      qaytarilgan: { soni: 0, summa: 0 },
    },
    kategoriyalar: [],
  };
}

/** Birliklar bo'yicha yig'indi — eng ko'p miqdorli birlik birinchi. */
function birliklarniJamla(satrlar: { birlik: string; miqdor: number }[]): SotuvBirlikDTO[] {
  const jamlangan = new Map<string, number>();
  for (const s of satrlar) {
    jamlangan.set(s.birlik, (jamlangan.get(s.birlik) ?? 0) + s.miqdor);
  }
  return Array.from(jamlangan, ([birlik, miqdor]) => ({ birlik, miqdor })).sort(
    (a, b) => b.miqdor - a.miqdor || a.birlik.localeCompare(b.birlik)
  );
}

/**
 * Sana oralig'idagi sotuvlar — kategoriya va mahsulot kesimida.
 *
 * `from`/`to` — "YYYY-MM-DD", ikkalasi ham oraliqqa KIRADI. Yuqori chegara
 * keyingi kunning yarim tuni bilan (`lt`) olinadi: `sana` har doim UTC yarim
 * tuni bo'lsa ham, vaqt komponenti bor yozuv kelib qolsa ham tushib qolmasin.
 */
export async function getSotuvStatistika(
  businessId: string,
  opts: { from: string; to: string }
): Promise<SotuvStatistikaDTO> {
  const sana = {
    gte: dateOnlyStringToUTCDate(opts.from),
    lt: new Date(dateOnlyStringToUTCDate(opts.to).getTime() + 24 * 60 * 60 * 1000),
  };

  // GURUHLASH BAZADA: 100 000 sotuvli bizneste barcha satrlarni RAM'ga
  // yuklab JS'da jamlash serverni yiqitardi. Natija qatorlari soni —
  // sotilgan mahsulot TURLARI soni, ya'ni o'nlab/yuzlab.
  const [satrlar, qaytarilgan] = await Promise.all([
    prisma.sale.groupBy({
      by: ["productId"],
      where: { businessId, deletedAt: null, sana },
      _sum: { miqdor: true, jamiSumma: true },
      _count: { _all: true },
    }),
    prisma.sale.aggregate({
      where: { businessId, deletedAt: { not: null }, sana },
      _sum: { jamiSumma: true },
      _count: { _all: true },
    }),
  ]);

  const qaytarilganYakun = {
    soni: qaytarilgan._count._all,
    summa: qaytarilgan._sum.jamiSumma ?? 0,
  };

  if (satrlar.length === 0) {
    const bosh = boshSotuvStatistika(opts.from, opts.to);
    bosh.yakun.qaytarilgan = qaytarilganYakun;
    return bosh;
  }

  // `IN (...)` BO'LAKLARGA BO'LINADI: SQLite bitta so'rovdagi parametrlar
  // soniga chek qo'yadi va katta katalogli bizneste ro'yxat o'sha chekdan
  // oshib ketishi mumkin edi. Postgres'da chek yo'q, lekin bitta yo'l
  // ikkala provayderda ham ishlashi kerak.
  const BOLAK = 500;
  const idlar = satrlar.map((s) => s.productId);
  const bolaklar = [];
  for (let i = 0; i < idlar.length; i += BOLAK) {
    bolaklar.push(
      prisma.product.findMany({
        where: { businessId, id: { in: idlar.slice(i, i + BOLAK) } },
        select: {
          id: true,
          nomi: true,
          birlik: true,
          categoryId: true,
          category: { select: { id: true, nomi: true, tartib: true } },
        },
      })
    );
  }
  const mahsulotlar = (await Promise.all(bolaklar)).flat();
  const mahsulotById = new Map(mahsulotlar.map((m) => [m.id, m]));

  // Kategoriya guruhlari. `tartib` — kategoriya ro'yxatidagi qo'lda
  // belgilangan tartib (POS'dagi bilan bir xil bo'lishi uchun).
  const guruhlar = new Map<string, SotuvKategoriyaDTO & { tartib: number }>();

  for (const s of satrlar) {
    const mahsulot = mahsulotById.get(s.productId);
    // Mahsulot topilmasa (o'chirilgan/boshqa biznesniki) — satr tashlanadi.
    if (!mahsulot) continue;

    const kategoriya = mahsulot.category;
    const kalit = kategoriya?.id ?? "";
    let guruh = guruhlar.get(kalit);
    if (!guruh) {
      guruh = {
        kategoriyaId: kategoriya?.id ?? null,
        nomi: kategoriya?.nomi ?? KATEGORIYASIZ,
        summa: 0,
        birliklar: [],
        mahsulotlar: [],
        // Kategoriyasiz guruh har doim oxirida.
        tartib: kategoriya ? kategoriya.tartib : Number.MAX_SAFE_INTEGER,
      };
      guruhlar.set(kalit, guruh);
    }

    const miqdor = s._sum.miqdor ?? 0;
    const summa = s._sum.jamiSumma ?? 0;
    guruh.mahsulotlar.push({
      productId: mahsulot.id,
      nomi: mahsulot.nomi,
      kategoriya: guruh.nomi,
      birlik: mahsulot.birlik,
      miqdor,
      summa,
      sotuvSoni: s._count._all,
    });
    guruh.summa += summa;
  }

  const kategoriyalar = Array.from(guruhlar.values())
    .map((g) => ({
      kategoriyaId: g.kategoriyaId,
      nomi: g.nomi,
      summa: g.summa,
      birliklar: birliklarniJamla(g.mahsulotlar),
      // Ichkarida eng ko'p pul keltirgan mahsulot yuqorida.
      mahsulotlar: g.mahsulotlar.sort((a, b) => b.summa - a.summa || a.nomi.localeCompare(b.nomi)),
      tartib: g.tartib,
    }))
    .sort((a, b) => a.tartib - b.tartib || b.summa - a.summa || a.nomi.localeCompare(b.nomi))
    .map(({ tartib: _tartib, ...guruh }) => guruh);

  const hammaMahsulotlar = kategoriyalar.flatMap((k) => k.mahsulotlar);

  return {
    from: opts.from,
    to: opts.to,
    yakun: {
      jamiSumma: hammaMahsulotlar.reduce((a, m) => a + m.summa, 0),
      mahsulotTurlari: hammaMahsulotlar.length,
      kategoriyalar: kategoriyalar.length,
      birliklar: birliklarniJamla(hammaMahsulotlar),
      qaytarilgan: qaytarilganYakun,
    },
    kategoriyalar,
  };
}
