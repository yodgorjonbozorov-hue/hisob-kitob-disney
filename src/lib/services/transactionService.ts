import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { kgSumma, kgToGram } from "@/lib/kg";
import type { BusinessTx } from "@/lib/db/businessTx";
import { resolveAccountId } from "@/lib/services/accounts";
import { shaxsiyKassaId } from "@/lib/services/kassaTanlash";
import { kunlikSinxron } from "@/lib/services/kunlik";

export interface CreateTransactionData {
  turi: "kirim" | "chiqim";
  categoryId: string;
  summa: number;
  sana: string; // "YYYY-MM-DD"
  izoh?: string | null;
  filial?: string | null;
  /** Qaysi kassa/hisob-raqamga tushdi. Berilmasa to'lov turiga mos faol kassa olinadi. */
  accountId?: string | null;
  /** "naqd" | "click" | "qarz". Berilmasa kassa turidan chiqariladi (eski xulq). */
  tolovTuri?: string | null;
  /**
   * KG SAVDOSI (mijozga xos — Fortex Selos): miqdor (kg) va 1 kg narxi.
   * Berilsa `summa` E'TIBORGA OLINMAYDI — miqdor × narx qayta hisoblanadi.
   */
  miqdorKg?: number | null;
  kgNarxi?: number | null;
  /**
   * SOTUVCHI/XODIM — savdo kimning hisobiga yozilishi (xodim statistikasi).
   * Chaqiruvchi (route) huquq va biznes tegishliligini oldindan tekshiradi
   * (lib/services/sotuvchi.ts). Kirimda berilmasa — yozuvchi o'zi.
   */
  sotuvchiId?: string | null;
}

/**
 * KG MAYDONLARI — summani YAGONA joyda hisoblaydi.
 *
 * Frontend yuborgan `summa`ga ishonilmaydi: kg savdosida jami har doim
 * shu yerda `miqdorGr × kgNarxi / 1000` bo'yicha qayta hisoblanadi
 * (lib/kg.ts). Kg faqat `kgAsosli` kategoriyaga yoziladi — aks holda
 * hisobotdagi "sotilgan kg" boshqa kategoriyalar bilan aralashib ketardi.
 */
function kgMaydonlari(
  data: CreateTransactionData,
  kgAsosli: boolean
): { miqdorGr: number | null; kgNarxi: number | null; summa: number } {
  if (data.miqdorKg == null || data.kgNarxi == null) {
    if (kgAsosli) {
      throw new BadRequestError(
        "Bu kategoriya kg bo'yicha sotiladi — miqdor (kg) va 1 kg narxini kiriting"
      );
    }
    return { miqdorGr: null, kgNarxi: null, summa: data.summa };
  }
  if (!kgAsosli) {
    throw new BadRequestError("Bu kategoriya kg bo'yicha savdo qilmaydi");
  }
  if (data.turi !== "kirim") {
    throw new BadRequestError("Kg savdosi faqat kirim uchun");
  }
  if (!(data.miqdorKg > 0) || !(data.kgNarxi > 0)) {
    throw new BadRequestError("Miqdor va 1 kg narxi 0 dan katta bo'lishi kerak");
  }
  const miqdorGr = kgToGram(data.miqdorKg);
  if (miqdorGr <= 0) throw new BadRequestError("Miqdor 0 dan katta bo'lishi kerak");
  return { miqdorGr, kgNarxi: data.kgNarxi, summa: kgSumma(miqdorGr, data.kgNarxi) };
}

/**
 * Yagona joy — API route va Telegram bot ikkalasi ham shu funksiyani chaqiradi.
 * Kategoriya aynan shu biznesga tegishli ekani tekshiriladi (cross-business himoya).
 */
export async function createTransaction(userId: string, businessId: string, data: CreateTransactionData) {
  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
    select: { businessId: true, turi: true, kgAsosli: true },
  });
  if (!category || category.businessId !== businessId) {
    throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
  }

  // Kg savdosi: summa server tomonda qayta hisoblanadi (frontend yuborganiga
  // ishonilmaydi). Kg'siz kategoriyada hech nima o'zgarmaydi.
  const kg = kgMaydonlari(data, category.kgAsosli);

  // Kassa: tanlangani tekshiriladi, tanlanmagani — to'lov turiga mos faol
  // kassa. QARZ — pul kassaga tushmagan, hech qaysi kassaga bog'lanmaydi
  // (kassa qoldig'iga kirmaydi).
  const accountId =
    data.tolovTuri === "qarz"
      ? null
      : await resolveAccountId(businessId, data.accountId, data.tolovTuri, userId);

  const created = await prisma.transaction.create({
    data: {
      turi: data.turi,
      categoryId: data.categoryId,
      businessId,
      accountId,
      tolovTuri: data.tolovTuri ?? undefined,
      summa: kg.summa,
      miqdorGr: kg.miqdorGr,
      kgNarxi: kg.kgNarxi,
      sana: dateOnlyStringToUTCDate(data.sana),
      izoh: data.izoh ?? undefined,
      filial: data.filial ?? undefined,
      userId,
      // Kirim savdosi HAR DOIM kimgadir yoziladi — berilmasa yozuvchining o'ziga
      // (bot va tez qo'shish shu yo'ldan yuradi). Chiqimda sotuvchi bo'lmaydi.
      sotuvchiId: data.turi === "kirim" ? data.sotuvchiId ?? userId : null,
    },
    include: {
      category: true,
      user: { select: { id: true, ism: true } },
      account: { select: { id: true, nomi: true, turi: true } },
      sotuvchi: { select: { id: true, ism: true } },
    },
  });

  // BUGUNGI sanali kirim kunlik hisobotga o'zi tushadi (boshqa sana — tushmaydi).
  // Sinxron xatosi asosiy yozuvni buzmaydi (kunlikSinxron ichida ushlanadi).
  await kunlikSinxron(created, created.user.ism);

  return created;
}

/**
 * `createTransaction`ning tranzaksiya ichida ishlaydigan varianti.
 * Xom `tx` delegatlari ishlatilgani uchun `businessId` sharti QO'LDA yoziladi
 * (batafsil: lib/db/businessTx.ts).
 */
export async function createTransactionTx(
  tx: BusinessTx,
  userId: string,
  businessId: string,
  data: CreateTransactionData
) {
  const category = await tx.category.findFirst({
    where: { id: data.categoryId, businessId },
    select: { id: true, kgAsosli: true },
  });
  if (!category) {
    throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
  }

  // KG: bu yo'ldan sotuv/qarz/oylik/xarid kabi TIZIM yozuvlari o'tadi — ular
  // kg kiritmaydi, shuning uchun kg MAJBURIY QILINMAYDI (aks holda kg'li
  // kategoriyaga tushgan qarz to'lovi bloklanib qolardi). Kg berilgan bo'lsa
  // esa qoidalar bir xil: faqat kgAsosli kategoriya va qayta hisoblangan summa.
  const kg =
    data.miqdorKg == null && data.kgNarxi == null
      ? { miqdorGr: null, kgNarxi: null, summa: data.summa }
      : kgMaydonlari(data, category.kgAsosli);

  // Tranzaksiya ichida: kassa xom `tx` bilan qidiriladi (businessId qo'lda).
  // QARZ — kassaga bog'lanmaydi (createTransaction bilan bir xil qoida).
  let accountId = data.tolovTuri === "qarz" ? null : data.accountId ?? null;
  if (accountId) {
    const acc = await tx.account.findFirst({
      where: { id: accountId, businessId, isActive: true },
      select: { id: true },
    });
    if (!acc) throw new ForbiddenError("Kassa topilmadi yoki nofaol");
  } else if (data.tolovTuri !== "qarz") {
    // Shaxsiy kassa rejimida naqd pul xodimning o'z kassasiga tushadi.
    accountId = await shaxsiyKassaId(tx, businessId, userId, data.tolovTuri);
    if (!accountId) {
      // TO'LOV TURIGA MOS KASSA (`resolveAccountId` bilan bir xil qoida).
      // Ilgari bu yerda shunchaki BIRINCHI faol kassa olinardi: Click
      // tushumi naqd kassaga tushib, "kassada bo'lishi kerak" raqamini
      // yolg'on oshirib yuborardi (pul terminalda, kassada emas).
      const mosTurlar =
        data.tolovTuri === "naqd" ? ["naqd"] : data.tolovTuri === "click" ? ["plastik", "bank"] : null;
      const mos = mosTurlar
        ? await tx.account.findFirst({
            where: { businessId, isActive: true, turi: { in: mosTurlar } },
            orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
            select: { id: true },
          })
        : null;
      const birinchi =
        mos ??
        (await tx.account.findFirst({
          where: { businessId, isActive: true },
          orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        }));
      accountId = birinchi?.id ?? null;
    }
  }

  return tx.transaction.create({
    data: {
      turi: data.turi,
      categoryId: data.categoryId,
      businessId,
      accountId,
      tolovTuri: data.tolovTuri ?? undefined,
      summa: kg.summa,
      miqdorGr: kg.miqdorGr,
      kgNarxi: kg.kgNarxi,
      sana: dateOnlyStringToUTCDate(data.sana),
      izoh: data.izoh ?? undefined,
      filial: data.filial ?? undefined,
      userId,
      // TIZIM yozuvlari (qarz to'lovi, oylik, xarid) sotuvchisiz qoladi —
      // savdo emas. CRM ko'chirishi esa buyurtma mas'ulini OCHIQ uzatadi.
      sotuvchiId: data.turi === "kirim" ? data.sotuvchiId ?? null : null,
    },
  });
}
