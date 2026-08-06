import { runBusinessTx } from "@/lib/db/businessTx";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import { z } from "zod";

/**
 * CSV IMPORT — tranzaksiyalarni ommaviy kiritish.
 *
 * Mijozlar odatda Excel'da yuritgan tarixini ko'chirmoqchi bo'ladi; qo'lda
 * yuzlab yozuv kiritish esa Balansa'ga o'tishning eng katta to'sig'i.
 *
 * Qoidalar:
 *  - har qator ALOHIDA tekshiriladi, xato qatorlar ro'yxati qaytariladi;
 *  - to'g'ri qatorlar BITTA tranzaksiyada yoziladi (yarim import bo'lmaydi);
 *  - kategoriya nom+tur bo'yicha topiladi, topilmasa yaratiladi.
 */

/** Kutilayotgan ustunlar (birinchi qator sarlavha bo'lishi mumkin). */
export const CSV_USTUNLAR = ["sana", "turi", "kategoriya", "summa", "izoh"] as const;

export const MAX_QATOR = 500;

const qatorSchema = z.object({
  sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD formatida bo'lishi kerak"),
  turi: z.enum(["kirim", "chiqim"], { errorMap: () => ({ message: "Turi 'kirim' yoki 'chiqim' bo'lishi kerak" }) }),
  kategoriya: z.string().trim().min(1, "Kategoriya bo'sh").max(100),
  summa: z.number().int().positive("Summa musbat butun son bo'lishi kerak"),
  izoh: z.string().max(500).optional().nullable(),
});

export interface XatoQator {
  /** Fayldagi qator raqami (1 dan boshlab, sarlavha ham hisobga olinadi). */
  qator: number;
  xato: string;
  matn: string;
}

export interface ImportNatija {
  yozildi: number;
  xatolar: XatoQator[];
  /** Import qilinadigan qatorlarning ilk 10 tasi (oldindan ko'rish). */
  namuna: ParsedQator[];
}

export interface ParsedQator {
  qator: number;
  sana: string;
  turi: "kirim" | "chiqim";
  kategoriya: string;
  summa: number;
  izoh: string | null;
}

/**
 * CSV qatorini bo'laklarga ajratadi — qo'shtirnoq ichidagi vergulni hurmat qiladi
 * ("Ijara, iyul" kabi izohlar buzilmasin).
 */
function csvQatorniBol(qator: string): string[] {
  const natija: string[] = [];
  let joriy = "";
  let qoshtirnoqda = false;
  for (let i = 0; i < qator.length; i++) {
    const ch = qator[i];
    if (ch === '"') {
      if (qoshtirnoqda && qator[i + 1] === '"') {
        joriy += '"';
        i++;
      } else {
        qoshtirnoqda = !qoshtirnoqda;
      }
    } else if ((ch === "," || ch === ";") && !qoshtirnoqda) {
      natija.push(joriy);
      joriy = "";
    } else {
      joriy += ch;
    }
  }
  natija.push(joriy);
  return natija.map((x) => x.trim());
}

/** "1 250 000", "1250000.00", "1,250,000" — hammasi 1250000 ga aylanadi. */
function summaniOqi(raw: string): number {
  const tozalangan = raw.replace(/[^\d.-]/g, "");
  const son = Number(tozalangan);
  if (!Number.isFinite(son)) return NaN;
  return Math.round(son);
}

/** CSV matnni tahlil qiladi: to'g'ri qatorlar va xatolar ro'yxati. */
export function csvniOqi(matn: string): { qatorlar: ParsedQator[]; xatolar: XatoQator[] } {
  const qatorlar: ParsedQator[] = [];
  const xatolar: XatoQator[] = [];

  const satrlar = matn
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((s) => s.trimEnd());

  let boshlanish = 0;
  // Birinchi qator sarlavha bo'lsa o'tkazib yuboriladi.
  const birinchi = satrlar[0]?.toLowerCase() ?? "";
  if (birinchi.includes("sana") && birinchi.includes("summa")) boshlanish = 1;

  for (let i = boshlanish; i < satrlar.length; i++) {
    const satr = satrlar[i];
    if (!satr.trim()) continue;
    const qatorRaqam = i + 1;

    const bolaklar = csvQatorniBol(satr);
    if (bolaklar.length < 4) {
      xatolar.push({
        qator: qatorRaqam,
        xato: "Kamida 4 ta ustun kerak: sana, turi, kategoriya, summa",
        matn: satr,
      });
      continue;
    }

    const [sana, turiRaw, kategoriya, summaRaw, izoh] = bolaklar;
    const parsed = qatorSchema.safeParse({
      sana,
      turi: turiRaw.toLowerCase(),
      kategoriya,
      summa: summaniOqi(summaRaw),
      izoh: izoh || null,
    });

    if (!parsed.success) {
      xatolar.push({
        qator: qatorRaqam,
        xato: parsed.error.errors[0]?.message ?? "Xato ma'lumot",
        matn: satr,
      });
      continue;
    }

    if (qatorlar.length >= MAX_QATOR) {
      xatolar.push({
        qator: qatorRaqam,
        xato: `Bir martada ${MAX_QATOR} tadan ko'p qator import qilinmaydi`,
        matn: satr,
      });
      break;
    }

    qatorlar.push({ qator: qatorRaqam, ...parsed.data, izoh: parsed.data.izoh ?? null });
  }

  return { qatorlar, xatolar };
}

/**
 * Tahlil qilingan qatorlarni bazaga yozadi — BITTA tranzaksiyada.
 * Yarim import bo'lmaydi: biror qator yiqilsa hammasi orqaga qaytadi.
 */
export async function csvniYoz(params: {
  businessId: string;
  userId: string;
  qatorlar: ParsedQator[];
}): Promise<number> {
  if (params.qatorlar.length === 0) return 0;

  const yozildi = await runBusinessTx(params.businessId, async (tx) => {
    // Kassa: birinchi faol kassa (import odatda tarixiy ma'lumot).
    const kassa = await tx.account.findFirst({
      where: { businessId: params.businessId, isActive: true },
      orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    // Kategoriya keshi — bir xil nom uchun takroriy so'rov ketmasin.
    const kesh = new Map<string, string>();
    async function kategoriyaId(nomi: string, turi: string): Promise<string> {
      const kalit = `${nomi}::${turi}`;
      const bor = kesh.get(kalit);
      if (bor) return bor;
      const cat = await tx.category.upsert({
        where: { nomi_turi_businessId: { nomi, turi, businessId: params.businessId } },
        update: {},
        create: { businessId: params.businessId, nomi, turi },
        select: { id: true },
      });
      kesh.set(kalit, cat.id);
      return cat.id;
    }

    let n = 0;
    for (const q of params.qatorlar) {
      const categoryId = await kategoriyaId(q.kategoriya, q.turi);
      await tx.transaction.create({
        data: {
          turi: q.turi,
          categoryId,
          businessId: params.businessId,
          accountId: kassa?.id ?? null,
          summa: q.summa,
          sana: dateOnlyStringToUTCDate(q.sana),
          izoh: q.izoh ?? undefined,
          userId: params.userId,
        },
      });
      n++;
    }
    return n;
  });

  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "transaction",
    entityId: "csv-import",
    after: { yozildi, manba: "CSV import" },
  });

  return yozildi;
}
