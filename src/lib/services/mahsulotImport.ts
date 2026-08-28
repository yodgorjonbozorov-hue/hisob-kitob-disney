import { runBusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";
import { csvQatorniBol, csvSatrlar, ajratgichniTop, ustunKaliti } from "@/lib/csv";
import { RASM_USTUN_KALITLARI } from "@/lib/excel/rasmUstun";
import { mahsulotImportQatorSchema, BIRLIKLAR, type Birlik } from "@/lib/validation/inventory";

/**
 * MAHSULOT IMPORTI — katalogni boshqa dasturdan ko'chirish.
 *
 * Nima uchun kerak: do'kon Balansa'ga o'tayotganda yuzlab tovarni qo'lda
 * kiritish real to'siq. Eski dastur (Bito, MoySklad, 1C, oddiy Excel) doim
 * CSV/Excel eksport bera oladi — shu fayl to'g'ridan-to'g'ri qabul qilinadi.
 *
 * Asosiy qarorlar:
 *
 *  1. USTUN NOMLARI MOSLASHTIRILADI. Har dastur ustunni o'zicha ataydi
 *     ("Mahsulot", "Tovar nomi", "Name"). Foydalanuvchini faylni qayta
 *     yozishga majburlash — importning ma'nosini yo'qotadi.
 *
 *  2. FAYLDA YO'Q USTUNGA TEGILMAYDI. Narx ustuni bo'lmagan fayl bilan
 *     yangilash butun katalog narxini nolga tushirmasligi kerak.
 *
 *  3. BOSHLANG'ICH QOLDIQ PUL YOZMAYDI. Ko'chirilayotgan tovar allaqachon
 *     sotib olingan va eski dasturda hisoblangan — unga chiqim tranzaksiya
 *     yozish mijozning hisobotini buzadi. Shuning uchun qoldiq
 *     `StockAdjustment` (inventarizatsiya) sifatida yoziladi: tovar hodisasi,
 *     pul harakati emas. Bu mavjud "Inventarizatsiya" yo'li bilan bir xil.
 *
 *  4. YARIM IMPORT BO'LMAYDI — hammasi bitta tranzaksiyada.
 */

/** Balansa formatidagi ustunlar — eksport ham aynan shu tartibda beriladi. */
export const MAHSULOT_USTUNLARI = [
  "nomi",
  "sku",
  "barcode",
  "kategoriya",
  "birlik",
  "kelganNarx",
  "sotuvNarx",
  "miqdor",
  "minQoldiq",
  "izoh",
  // Oxirida turadi — eksport ustun harflari (F..I raqam formati) siljimasin.
  "rasmUrl",
] as const;

export type MahsulotUstuni = (typeof MAHSULOT_USTUNLARI)[number];

/** Foydalanuvchi ko'radigan sarlavhalar (eksport fayli shu bilan chiqadi). */
export const USTUN_SARLAVHALARI: Record<MahsulotUstuni, string> = {
  nomi: "Nomi",
  sku: "SKU",
  barcode: "Shtrix kod",
  kategoriya: "Kategoriya",
  birlik: "Birlik",
  kelganNarx: "Tannarx",
  sotuvNarx: "Sotuv narxi",
  miqdor: "Qoldiq",
  minQoldiq: "Min qoldiq",
  izoh: "Izoh",
  rasmUrl: "Rasm",
};

/**
 * Ustun nomlarining muqobillari.
 *
 * Kalitlar `ustunKaliti()` orqali soddalashtirilgan holda solishtiriladi,
 * ya'ni "O'lchov birligi", "olchov_birligi" va "Olchov Birligi" bir xil.
 * Ro'yxatda Bito, MoySklad va Excel eksportlarida amalda uchragan nomlar bor.
 */
const USTUN_MUQOBILLARI: Record<string, MahsulotUstuni> = {
  nomi: "nomi",
  nom: "nomi",
  mahsulot: "nomi",
  mahsulotnomi: "nomi",
  tovar: "nomi",
  tovarnomi: "nomi",
  name: "nomi",
  productname: "nomi",

  sku: "sku",
  artikul: "sku",
  kod: "sku",
  omborkodi: "sku",
  code: "sku",

  barcode: "barcode",
  shtrixkod: "barcode",
  shtrikhkod: "barcode",
  shtrixkodi: "barcode",
  shtrixkodlar: "barcode",
  ean: "barcode",

  kategoriya: "kategoriya",
  guruh: "kategoriya",
  category: "kategoriya",
  group: "kategoriya",

  birlik: "birlik",
  olchovbirligi: "birlik",
  olchov: "birlik",
  unit: "birlik",

  tannarx: "kelganNarx",
  kelgannarx: "kelganNarx",
  kirimnarx: "kelganNarx",
  xaridnarxi: "kelganNarx",
  costprice: "kelganNarx",

  sotuvnarxi: "sotuvNarx",
  sotuvnarx: "sotuvNarx",
  narx: "sotuvNarx",
  narxi: "sotuvNarx",
  price: "sotuvNarx",
  sellprice: "sotuvNarx",

  qoldiq: "miqdor",
  miqdor: "miqdor",
  soni: "miqdor",
  ombordagiqoldiq: "miqdor",
  quantity: "miqdor",
  stock: "miqdor",

  minqoldiq: "minQoldiq",
  minimalqoldiq: "minQoldiq",
  minstock: "minQoldiq",

  izoh: "izoh",
  tavsif: "izoh",
  description: "izoh",
  comment: "izoh",
};
// Rasm ustuni nomlari bitta manbadan olinadi (`lib/excel/rasmUstun.ts`) —
// brauzerdagi rasmli import ham aynan shu ro'yxat bilan ishlaydi.
for (const kalit of RASM_USTUN_KALITLARI) USTUN_MUQOBILLARI[kalit] = "rasmUrl";

/** O'lchov birligi muqobillari — noma'lum birlik xato emas, "dona" bo'ladi. */
const BIRLIK_MUQOBILLARI: Record<string, Birlik> = {
  dona: "dona",
  ta: "dona",
  pc: "dona",
  pcs: "dona",
  piece: "dona",
  unit: "dona",
  kg: "kg",
  kilogramm: "kg",
  kilogram: "kg",
  kilo: "kg",
  litr: "litr",
  liter: "litr",
  l: "litr",
  metr: "metr",
  meter: "metr",
  m: "metr",
  quti: "quti",
  box: "quti",
  paket: "paket",
  pack: "paket",
};

/**
 * Bir yurishdagi maksimal qator.
 *
 * Cheklovning sababi texnik: import bitta tranzaksiyada ishlaydi va
 * `runBusinessTx` 15 soniyalik chegara qo'yadi. Undan kattaroq katalog
 * bo'laklab import qilinadi — chegara jimgina kesib tashlanmaydi, ochiq
 * xato sifatida ko'rsatiladi.
 */
export const MAKS_MAHSULOT = 500;

export type ImportRejimi = "qoshish" | "yangilash";

export interface MahsulotXatoQatori {
  /** Fayldagi qator raqami (sarlavha 1-qator). */
  qator: number;
  xato: string;
  matn: string;
}

export interface MahsulotQatori {
  qator: number;
  nomi: string;
  sku: string | null;
  barcode: string | null;
  kategoriya: string | null;
  birlik: Birlik | undefined;
  kelganNarx: number | null | undefined;
  sotuvNarx: number | null | undefined;
  miqdor: number | null | undefined;
  minQoldiq: number | null | undefined;
  izoh: string | null | undefined;
  rasmUrl: string | null | undefined;
}

export interface OqishNatijasi {
  /** Faylda topilgan (tanilgan) ustunlar. */
  ustunlar: MahsulotUstuni[];
  qatorlar: MahsulotQatori[];
  xatolar: MahsulotXatoQatori[];
}

/** "1 250 000", "1250000.00", "1,250,000" — hammasi 1250000 ga aylanadi. */
function sonniOqi(raw: string): number | null {
  const tozalangan = raw.replace(/\s/g, "").replace(/,/g, ".").replace(/[^\d.-]/g, "");
  if (!tozalangan) return null;
  const son = Number(tozalangan);
  if (!Number.isFinite(son)) return NaN;
  return Math.round(son);
}

function birlikniOqi(raw: string): Birlik | undefined {
  const kalit = ustunKaliti(raw);
  if (!kalit) return undefined;
  const topilgan = BIRLIK_MUQOBILLARI[kalit];
  if (topilgan) return topilgan;
  // Ro'yxatga tushmagan birlik — importni to'xtatmaydi, standart birlik olinadi.
  return BIRLIKLAR.includes(kalit as Birlik) ? (kalit as Birlik) : "dona";
}

/**
 * CSV matnni tahlil qiladi.
 *
 * Sarlavha MAJBURIY: ustunlarni tartib bo'yicha taxmin qilish xavfli — narx
 * bilan qoldiq joyi almashib ketsa mijoz buni faqat kassada sezadi.
 */
export function mahsulotlarniOqi(matn: string): OqishNatijasi {
  const satrlar = csvSatrlar(matn).filter((s, i) => i === 0 || s.trim() !== "");
  const xatolar: MahsulotXatoQatori[] = [];
  const qatorlar: MahsulotQatori[] = [];

  const sarlavhaSatri = satrlar[0] ?? "";
  if (!sarlavhaSatri.trim()) {
    return { ustunlar: [], qatorlar: [], xatolar: [{ qator: 1, xato: "Fayl bo'sh", matn: "" }] };
  }

  const ajratgich = ajratgichniTop(sarlavhaSatri);
  const sarlavha = csvQatorniBol(sarlavhaSatri, ajratgich);

  // Ustun indeksi -> maydon nomi.
  const xarita = new Map<number, MahsulotUstuni>();
  const ustunlar: MahsulotUstuni[] = [];
  sarlavha.forEach((nom, i) => {
    const maydon = USTUN_MUQOBILLARI[ustunKaliti(nom)];
    // Bir maydon ikki marta uchrasa birinchisi qoladi.
    if (maydon && !ustunlar.includes(maydon)) {
      xarita.set(i, maydon);
      ustunlar.push(maydon);
    }
  });

  if (!ustunlar.includes("nomi")) {
    return {
      ustunlar,
      qatorlar: [],
      xatolar: [
        {
          qator: 1,
          xato: "Tovar nomi ustuni topilmadi. Sarlavhada \"Nomi\" (yoki \"Mahsulot\") ustuni bo'lishi shart",
          matn: sarlavhaSatri,
        },
      ],
    };
  }

  // Fayl ichidagi takrorni ushlash uchun kalitlar.
  const korilganNomlar = new Set<string>();
  const korilganSku = new Set<string>();
  const korilganBarcode = new Set<string>();

  for (let i = 1; i < satrlar.length; i++) {
    const satr = satrlar[i];
    if (!satr.trim()) continue;
    const qatorRaqam = i + 1;

    if (qatorlar.length >= MAKS_MAHSULOT) {
      xatolar.push({
        qator: qatorRaqam,
        xato: `Bir martada ${MAKS_MAHSULOT} tadan ko'p tovar import qilinmaydi`,
        matn: satr,
      });
      break;
    }

    const bolaklar = csvQatorniBol(satr, ajratgich);
    const xom: Record<string, string> = {};
    xarita.forEach((maydon, indeks) => {
      xom[maydon] = (bolaklar[indeks] ?? "").trim();
    });

    // Bo'sh kataklar: ustun bor-u qiymat yo'q -> null. Ustun yo'q -> undefined.
    const bor = (m: MahsulotUstuni) => ustunlar.includes(m);
    const matnMaydon = (m: MahsulotUstuni) => (bor(m) ? xom[m] || null : undefined);
    const sonMaydon = (m: MahsulotUstuni) => {
      if (!bor(m)) return undefined;
      const v = xom[m];
      return v ? sonniOqi(v) : null;
    };

    // Rasm ustuni faqat http(s) havolani qabul qiladi. Bito kabi dasturlar
    // "Surati" ustuniga fayl NOMINI yozadi — uni saqlab bo'lmaydi, lekin bu
    // qatorni xato qilish ham noto'g'ri: havola bo'lmagan qiymat shunchaki
    // "rasm yo'q" deb olinadi.
    const rasmXom = matnMaydon("rasmUrl");
    const rasmUrl =
      rasmXom === undefined ? undefined : rasmXom && /^https?:\/\//i.test(rasmXom) ? rasmXom : null;

    const parsed = mahsulotImportQatorSchema.safeParse({
      nomi: xom.nomi ?? "",
      sku: matnMaydon("sku"),
      barcode: matnMaydon("barcode"),
      kategoriya: matnMaydon("kategoriya"),
      birlik: bor("birlik") ? birlikniOqi(xom.birlik) : undefined,
      kelganNarx: sonMaydon("kelganNarx"),
      sotuvNarx: sonMaydon("sotuvNarx"),
      miqdor: sonMaydon("miqdor"),
      minQoldiq: sonMaydon("minQoldiq"),
      izoh: matnMaydon("izoh"),
      rasmUrl,
    });

    if (!parsed.success) {
      xatolar.push({
        qator: qatorRaqam,
        xato: parsed.error.errors[0]?.message ?? "Xato ma'lumot",
        matn: satr,
      });
      continue;
    }

    const q = parsed.data;
    const nomKalit = q.nomi.toLowerCase();
    if (korilganNomlar.has(nomKalit)) {
      xatolar.push({ qator: qatorRaqam, xato: "Bu nom faylda takrorlangan", matn: satr });
      continue;
    }
    if (q.sku && korilganSku.has(q.sku.toLowerCase())) {
      xatolar.push({ qator: qatorRaqam, xato: "Bu SKU faylda takrorlangan", matn: satr });
      continue;
    }
    if (q.barcode && korilganBarcode.has(q.barcode)) {
      xatolar.push({ qator: qatorRaqam, xato: "Bu shtrix-kod faylda takrorlangan", matn: satr });
      continue;
    }
    korilganNomlar.add(nomKalit);
    if (q.sku) korilganSku.add(q.sku.toLowerCase());
    if (q.barcode) korilganBarcode.add(q.barcode);

    qatorlar.push({
      qator: qatorRaqam,
      nomi: q.nomi,
      sku: q.sku ?? null,
      barcode: q.barcode ?? null,
      kategoriya: q.kategoriya ?? null,
      birlik: q.birlik,
      kelganNarx: q.kelganNarx,
      sotuvNarx: q.sotuvNarx,
      miqdor: q.miqdor,
      minQoldiq: q.minQoldiq,
      izoh: q.izoh,
      rasmUrl: q.rasmUrl,
    });
  }

  return { ustunlar, qatorlar, xatolar };
}

export interface YozishNatijasi {
  qoshildi: number;
  yangilandi: number;
  /** Mavjud bo'lgani uchun tegilmagan qatorlar ("qoshish" rejimida). */
  otkazildi: number;
  /** Qoldig'i o'zgartirilgan tovarlar soni. */
  qoldiqTogrilandi: number;
  xatolar: MahsulotXatoQatori[];
}

/**
 * Fayl qatorini bazadagi mavjud tovarga moslashtiradi.
 *
 * Ustuvorlik: SHTRIX-KOD, so'ng SKU, so'ng nom. Shtrix-kod tovarning eng
 * ishonchli kimligi — nomi o'zgargan bo'lsa ham u o'sha tovar.
 *
 * ZIDDIYAT: agar shtrix-kod bitta tovarni, SKU/nom esa BOSHQASINI ko'rsatsa,
 * qaysi biri to'g'ri ekanini dastur bila olmaydi. Bunda taxmin qilish emas —
 * qator xato sifatida chetga chiqariladi. Aks holda import jimgina mavjud
 * tovarning nomini almashtirib qo'yardi.
 */
function mosKeladigan(
  q: MahsulotQatori,
  barcodeXarita: Map<string, string>,
  skuXarita: Map<string, string>,
  nomXarita: Map<string, string>
): { id?: string; ziddiyat?: string } {
  const bKod = q.barcode ? barcodeXarita.get(q.barcode) : undefined;
  const bSku = q.sku ? skuXarita.get(q.sku.toLowerCase()) : undefined;
  const bNom = nomXarita.get(q.nomi.toLowerCase());

  if (bKod) {
    if (bSku && bSku !== bKod) {
      return { ziddiyat: "Shtrix-kod va SKU bazada turli tovarlarni ko'rsatmoqda" };
    }
    if (bNom && bNom !== bKod) {
      return { ziddiyat: "Bu shtrix-kod bazada boshqa nomdagi tovarga biriktirilgan" };
    }
    return { id: bKod };
  }
  if (bSku) return { id: bSku };
  return { id: bNom };
}

/**
 * Tahlil qilingan qatorlarni bazaga yozadi — BITTA tranzaksiyada.
 *
 * Tranzaksiya ichida xom `tx` ishlatiladi, shuning uchun HAR so'rovda
 * `businessId` sharti qo'lda yozilgan (CLAUDE.md dagi kelishuv).
 */
export async function mahsulotlarniYoz(params: {
  businessId: string;
  userId: string;
  qatorlar: MahsulotQatori[];
  ustunlar: MahsulotUstuni[];
  rejim: ImportRejimi;
}): Promise<YozishNatijasi> {
  const bosh: YozishNatijasi = {
    qoshildi: 0,
    yangilandi: 0,
    otkazildi: 0,
    qoldiqTogrilandi: 0,
    xatolar: [],
  };
  if (params.qatorlar.length === 0) return bosh;

  const bor = (m: MahsulotUstuni) => params.ustunlar.includes(m);

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const n: YozishNatijasi = { ...bosh, xatolar: [] };

    // Mavjud katalog bir marta o'qiladi: har qator uchun alohida so'rov
    // yuborilsa 500 qatorli fayl tranzaksiya chegarasiga urilardi.
    const mavjud = await tx.product.findMany({
      where: { businessId: params.businessId },
      select: { id: true, nomi: true, sku: true, barcode: true, miqdor: true },
    });

    const barcodeXarita = new Map<string, string>();
    const skuXarita = new Map<string, string>();
    const nomXarita = new Map<string, string>();
    const qoldiqXarita = new Map<string, number>();
    for (const p of mavjud) {
      if (p.barcode) barcodeXarita.set(p.barcode, p.id);
      if (p.sku) skuXarita.set(p.sku.toLowerCase(), p.id);
      if (!nomXarita.has(p.nomi.toLowerCase())) nomXarita.set(p.nomi.toLowerCase(), p.id);
      qoldiqXarita.set(p.id, p.miqdor);
    }

    // Kategoriyalar ham bir marta.
    const kategoriyalar = await tx.productCategory.findMany({
      where: { businessId: params.businessId, deletedAt: null },
      select: { id: true, nomi: true },
    });
    const katXarita = new Map<string, string>();
    for (const k of kategoriyalar) katXarita.set(k.nomi.toLowerCase(), k.id);

    async function kategoriyaId(nomi: string): Promise<string> {
      const kalit = nomi.toLowerCase();
      const topilgan = katXarita.get(kalit);
      if (topilgan) return topilgan;
      const yangi = await tx.productCategory.create({
        data: { businessId: params.businessId, nomi },
        select: { id: true },
      });
      katXarita.set(kalit, yangi.id);
      return yangi.id;
    }

    /** Qoldiqni to'g'rilaydi — pul yozmaydi, faqat inventarizatsiya izi. */
    async function qoldiqniQoy(productId: string, eski: number, yangi: number) {
      if (eski === yangi) return;
      await tx.product.update({
        where: { id: productId, businessId: params.businessId },
        data: { miqdor: yangi },
      });
      await tx.stockAdjustment.create({
        data: {
          businessId: params.businessId,
          productId,
          turi: "inventarizatsiya",
          eskiMiqdor: eski,
          yangiMiqdor: yangi,
          farq: yangi - eski,
          sabab: "Import: boshlang'ich qoldiq",
          userId: params.userId,
        },
      });
      n.qoldiqTogrilandi++;
    }

    for (const q of params.qatorlar) {
      const mos = mosKeladigan(q, barcodeXarita, skuXarita, nomXarita);
      if (mos.ziddiyat) {
        n.xatolar.push({ qator: q.qator, xato: mos.ziddiyat, matn: q.nomi });
        continue;
      }
      const mavjudId = mos.id;

      const katId = q.kategoriya ? await kategoriyaId(q.kategoriya) : undefined;

      if (!mavjudId) {
        const yaratilgan = await tx.product.create({
          data: {
            businessId: params.businessId,
            nomi: q.nomi,
            sku: q.sku ?? undefined,
            barcode: q.barcode ?? undefined,
            categoryId: katId,
            birlik: q.birlik ?? undefined,
            kelganNarx: q.kelganNarx ?? 0,
            sotuvNarx: q.sotuvNarx ?? 0,
            minQoldiq: q.minQoldiq ?? undefined,
            izoh: q.izoh ?? undefined,
            rasmUrl: q.rasmUrl ?? undefined,
          },
          select: { id: true },
        });
        n.qoshildi++;

        // Yangi tovar takroriy moslashmasin.
        if (q.barcode) barcodeXarita.set(q.barcode, yaratilgan.id);
        if (q.sku) skuXarita.set(q.sku.toLowerCase(), yaratilgan.id);
        nomXarita.set(q.nomi.toLowerCase(), yaratilgan.id);
        qoldiqXarita.set(yaratilgan.id, 0);

        if (bor("miqdor") && q.miqdor != null && q.miqdor > 0) {
          await qoldiqniQoy(yaratilgan.id, 0, q.miqdor);
        }
        continue;
      }

      if (params.rejim === "qoshish") {
        n.otkazildi++;
        continue;
      }

      // Yangilash: faqat FAYLDA BOR ustunlar tegadi.
      const data: {
        nomi: string;
        sku?: string;
        barcode?: string;
        categoryId?: string;
        birlik?: string;
        kelganNarx?: number;
        sotuvNarx?: number;
        minQoldiq?: number;
        izoh?: string;
        rasmUrl?: string;
      } = { nomi: q.nomi };
      if (bor("sku") && q.sku) data.sku = q.sku;
      if (bor("barcode") && q.barcode) data.barcode = q.barcode;
      if (bor("kategoriya") && katId) data.categoryId = katId;
      if (bor("birlik") && q.birlik) data.birlik = q.birlik;
      if (bor("kelganNarx") && q.kelganNarx != null) data.kelganNarx = q.kelganNarx;
      if (bor("sotuvNarx") && q.sotuvNarx != null) data.sotuvNarx = q.sotuvNarx;
      if (bor("minQoldiq") && q.minQoldiq != null) data.minQoldiq = q.minQoldiq;
      if (bor("izoh") && q.izoh != null) data.izoh = q.izoh;
      if (bor("rasmUrl") && q.rasmUrl != null) data.rasmUrl = q.rasmUrl;

      await tx.product.update({
        where: { id: mavjudId, businessId: params.businessId },
        data,
      });
      n.yangilandi++;

      if (bor("miqdor") && q.miqdor != null) {
        await qoldiqniQoy(mavjudId, qoldiqXarita.get(mavjudId) ?? 0, q.miqdor);
      }
    }

    return n;
  });

  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "product",
    entityId: "import",
    after: {
      qoshildi: natija.qoshildi,
      yangilandi: natija.yangilandi,
      qoldiqTogrilandi: natija.qoldiqTogrilandi,
      rejim: params.rejim,
      manba: "Fayl importi",
    },
  });

  return natija;
}
