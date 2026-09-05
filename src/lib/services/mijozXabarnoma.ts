import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { logAudit } from "@/lib/services/audit";
import {
  buyurtmaOqi,
  qarzSnapshoti,
  type BuyurtmaMalumot,
  type QarzSnapshot,
} from "@/lib/telegram/buyurtma";
import { bekorXabari, ozgarishXabari, xaridXabari } from "@/lib/telegram/mijozXabar";
import { telegramYubor } from "@/lib/telegram/yuborish";
import type { XabarTuri } from "@/lib/telegram/xabarTuri";

/**
 * MIJOZ TELEGRAM XABARNOMASI — xizmat qatlami.
 *
 * VAZIFASI: buyurtma bo'yicha bazadagi haqiqiy raqamlarni o'qish
 * (`lib/telegram/buyurtma.ts`), matn yasash (`lib/telegram/mijozXabar.ts`),
 * yuborish (`lib/telegram/yuborish.ts`) va NATIJANI JURNALGA yozish.
 *
 * ── DUBLIKATDAN HIMOYA: BITTA NON-NULL KALIT ──────────────────────────────
 * Har xabar `idempotencyKey` oladi:
 *
 *   CHEK:{chekId}:SALE_CREATED:1
 *   SALE:{saleId}:SALE_CREATED:1
 *   CHEK:{chekId}:SALE_CANCELLED:1
 *   CHEK:{chekId}:SALE_UPDATED:2
 *
 * Ustun `@unique` va NULL bo'lolmaydi. Ilgari himoya ikkita KOMPOZIT unique
 * bilan qilingan edi (`[chekId, turi, versiya]`, `[saleId, turi, versiya]`),
 * lekin ularning birinchi ustuni NULL bo'lishi mumkin — SQLite ham,
 * PostgreSQL ham NULL'larni teng deb hisoblamaydi, ya'ni yakka sotuvda
 * (chekId = NULL) birinchi cheklov umuman ishlamasdi. Endi parallel so'rov
 * ham, qayta urinish ham AYNI qatorga tushadi.
 *
 * Yozuv YUBORISHDAN OLDIN yaratiladi:
 *   - yozuv bor va "YUBORILDI"  → xabar ketgan, QAYTA YUBORILMAYDI;
 *   - yozuv bor va "XATO"       → o'sha satr ustidan qayta urinish
 *                                 (yangi satr ochilmaydi, `urinish` oshadi).
 *
 * ── PARALLEL YUBORISHGA QARSHI "BAND" BELGISI ─────────────────────────────
 * Unique kalit ikkinchi SATR ochilishini to'sadi, lekin o'zi ikkinchi
 * YUBORISHNI to'smaydi: ikki so'rov bir vaqtda kelsa (tugma ikki marta
 * bosildi), birinchisi satrni yaratib jo'natayotgan payt ikkinchisi o'sha
 * satrni "yiqilgan ekan, qayta urinaman" deb o'qib qolardi.
 *
 * Shu bois satr shartli `updateMany` bilan BAND QILINADI (`bandAt`) va
 * faqat band qila olgan oqim yuboradi — qolganlari "DUBLIKAT" qaytaradi.
 * Shart bitta SQL amalida tekshiriladi, ya'ni o'qish→yozish poygasi yo'q.
 *
 * ── QARZ SNAPSHOT'i ───────────────────────────────────────────────────────
 * `debtBefore` / `debtAdded` / `debtAfter` xabar YOZILGAN PAYTDA yoziladi
 * va qayta urinishda AYNAN o'sha yozuvdan olinadi — ledgerdan QAYTA
 * HISOBLANMAYDI. Matn ham qayta chizilmaydi: saqlangan `matn` o'z holicha
 * yuboriladi.
 *
 * Sababi: xabar kech ketsa (Telegram yiqilib, keyin qayta urinilsa) oradan
 * boshqa savdo yoki to'lov o'tgan bo'lishi mumkin va mijoz O'SHA savdo
 * haqida boshqa raqamlarni ko'rardi.
 *
 *   savdo xabari            → TARIXIY hujjat (snapshot);
 *   botdagi "Mening qarzim" → REAL-TIME `Debt` ledger o'qishi.
 *
 * ── VERSIYALASH (spec 9) ──────────────────────────────────────────────────
 * SALE_CREATED va SALE_CANCELLED — har doim 1-versiya. SALE_UPDATED esa
 * MUVAFFAQIYATLI yuborilgan eng katta versiyadan bittaga katta bo'ladi.
 * Shu sabab yiqilgan o'zgarish xabari qayta urinilganda o'sha versiyada,
 * ya'ni o'sha kalit va o'sha qatorda qoladi.
 *
 * ── SAVDO BUZILMAYDI (spec 14) ────────────────────────────────────────────
 * Savdo oqimlari `buyurtmaXabarnomasiniUrin()` ni chaqiradi — u HECH QANDAY
 * xatoni yuqoriga o'tkazmaydi.
 */

export type XabarnomaNatija =
  /** Yuborildi. */
  | { holat: "YUBORILDI"; notificationId: string; versiya: number }
  /** Mijoz Telegramga ulanmagan (yoki buyurtmada mijoz yo'q) — jurnalga yozilmaydi. */
  | { holat: "ULANMAGAN" }
  /** Shu kalit bo'yicha xabar allaqachon muvaffaqiyatli ketgan. */
  | { holat: "DUBLIKAT"; notificationId: string; versiya: number }
  /** Telegram qabul qilmadi — jurnalda "XATO" bo'lib qoladi. */
  | { holat: "XATO"; notificationId: string; versiya: number; xato: string };

export interface XabarnomaParams {
  businessId: string;
  chekId?: string | null;
  saleId?: string | null;
  turi: XabarTuri;
}

/** Buyurtma turiga mos matn (faqat BIRINCHI yozishda; qayta urinishda saqlangani ketadi). */
function matnYasa(turi: XabarTuri, b: BuyurtmaMalumot, qarz: QarzSnapshot): string {
  if (turi === "SALE_CANCELLED") return bekorXabari(b, qarz);
  if (turi === "SALE_UPDATED") return ozgarishXabari(b, qarz);
  return xaridXabari(b, qarz);
}

/** Xato Prisma'ning unique cheklovi bo'yicha kelganmi. */
function unikalXatomi(e: unknown): boolean {
  return !!e && typeof e === "object" && (e as { code?: string }).code === "P2002";
}

/**
 * TAKRORDAN HIMOYA KALITI.
 *
 * Buyurtma turi prefiks bilan ajratiladi ("CHEK:" / "SALE:") — cuid'lar
 * bir-biriga o'xshamasa ham, kalitni O'QIB nima ekanini tushunish mumkin
 * bo'lsin (jurnalni odam ko'radi).
 */
export function idempotencyKalit(p: {
  chekId?: string | null;
  saleId?: string | null;
  turi: XabarTuri;
  versiya: number;
}): string {
  const manba = p.chekId ? `CHEK:${p.chekId}` : `SALE:${p.saleId}`;
  return `${manba}:${p.turi}:${p.versiya}`;
}

/**
 * Keyingi versiya raqami — FAQAT muvaffaqiyatli yuborilganlar bo'yicha.
 *
 * Yiqilgan xabar versiyani BAND QILMAYDI: aks holda qayta urinish yangi
 * versiya (yangi kalit, yangi satr, yangi snapshot) yaratib yuborardi va
 * "o'sha xabarni qayta urinish" degan ma'no yo'qolardi.
 */
async function keyingiVersiya(p: XabarnomaParams): Promise<number> {
  if (p.turi !== "SALE_UPDATED") return 1;
  const oxirgi = await prisma.telegramNotification.aggregate({
    where: {
      businessId: p.businessId,
      ...(p.chekId ? { chekId: p.chekId } : { saleId: p.saleId }),
      turi: { in: ["SALE_CREATED", "SALE_UPDATED"] },
      holat: "YUBORILDI",
    },
    _max: { versiya: true },
  });
  return (oxirgi._max.versiya ?? 0) + 1;
}

/** Jurnal satrining qayta urinish uchun kerakli maydonlari. */
const YOZUV_TANLOV = {
  id: true,
  holat: true,
  urinish: true,
  versiya: true,
  matn: true,
  chatId: true,
  contactId: true,
} as const;

type Yozuv = {
  id: string;
  holat: string;
  urinish: number;
  versiya: number;
  matn: string;
  chatId: string;
  contactId: string;
};

/**
 * "Band" belgisi shuncha vaqtdan keyin eskirgan hisoblanadi.
 *
 * Yuborish eng yomon holatda ~2 soniya (3 urinish + kutish), shu bois
 * 2 daqiqa juda saxiy chegara. U faqat JARAYON UZILIB QOLGAN holat uchun:
 * belgi tozalanmay qolsa yozuv abadiy qulflanib qolmasin.
 */
const BAND_ESKIRISH_MS = 2 * 60 * 1000;

/**
 * Mavjud satrni BAND QILADI. `false` — boshqa oqim allaqachon yuborayotgan
 * (yoki yuborib bo'lgan), ya'ni bu urinish xabar YUBORMASLIGI kerak.
 *
 * Shart bitta atomik `UPDATE ... WHERE` da: ikki oqim bir vaqtda urinsa
 * faqat bittasi `count = 1` oladi.
 */
async function bandQil(id: string): Promise<boolean> {
  const eskirgan = new Date(Date.now() - BAND_ESKIRISH_MS);
  const upd = await prisma.telegramNotification.updateMany({
    where: {
      id,
      holat: { not: "YUBORILDI" },
      OR: [{ bandAt: null }, { bandAt: { lt: eskirgan } }],
    },
    data: { bandAt: new Date() },
  });
  return upd.count === 1;
}

/** Mijozning HOZIRGI chat manzili (qayta urinishda qayerga yuborilishini aniqlaydi). */
async function mijozChatId(businessId: string, contactId: string): Promise<string | null> {
  const c = await prisma.contact.findFirst({
    where: { id: contactId, businessId, deletedAt: null },
    select: { telegramChatId: true },
  });
  return c?.telegramChatId ?? null;
}

/**
 * XABARNOMANI YUBORADI (asosiy funksiya).
 *
 * Tashlashi mumkin (buyurtma topilmasa) — savdo oqimidan `...Urin()`
 * o'rovchisi orqali chaqiriladi.
 */
export async function buyurtmaXabarnomasi(p: XabarnomaParams): Promise<XabarnomaNatija> {
  if (!p.chekId && !p.saleId) throw new BadRequestError("Buyurtma ko'rsatilmagan");

  const versiya = await keyingiVersiya(p);
  const kalit = idempotencyKalit({ ...p, versiya });

  const mavjud = (await prisma.telegramNotification.findFirst({
    where: { businessId: p.businessId, idempotencyKey: kalit },
    select: YOZUV_TANLOV,
  })) as Yozuv | null;

  if (mavjud?.holat === "YUBORILDI") {
    return { holat: "DUBLIKAT", notificationId: mavjud.id, versiya: mavjud.versiya };
  }

  let yozuv: Yozuv;
  let matn: string;
  let chatId: string;

  if (mavjud) {
    // ---- QAYTA URINISH ----
    // Matn ham, qarz snapshoti ham QAYTA HISOBLANMAYDI: mijoz aynan o'sha
    // paytdagi hujjatni oladi. Manzil esa yangilanadi — mijoz oradan
    // Telegramni qayta ulagan bo'lishi mumkin.
    if (!(await bandQil(mavjud.id))) {
      return { holat: "DUBLIKAT", notificationId: mavjud.id, versiya: mavjud.versiya };
    }
    const joriyChat = await mijozChatId(p.businessId, mavjud.contactId);
    if (!joriyChat) {
      await prisma.telegramNotification.update({
        where: { id: mavjud.id },
        data: { bandAt: null },
      });
      return { holat: "ULANMAGAN" };
    }

    yozuv = mavjud;
    matn = mavjud.matn;
    chatId = joriyChat;
  } else {
    // ---- BIRINCHI YOZISH ----
    const buyurtma = await buyurtmaOqi(p.businessId, p);
    // Mijozsiz savdo (chakana o'tkinchi xaridor) — yuboriladigan manzil yo'q.
    if (!buyurtma?.mijoz.telegramChatId) return { holat: "ULANMAGAN" };

    const qarz = qarzSnapshoti(buyurtma);
    matn = matnYasa(p.turi, buyurtma, qarz);
    chatId = buyurtma.mijoz.telegramChatId;

    // Yozuv yuborishdan OLDIN yaratiladi: unique kalit dublikatni shu yerda
    // to'sadi. Boshlang'ich holat "XATO" va `urinish = 0` — jarayon yarim
    // yo'lda uzilsa yozuv "yuborilmagan" bo'lib qoladi (xavfsiz tomon).
    const data = {
      businessId: p.businessId,
      contactId: buyurtma.mijoz.id,
      chekId: p.chekId ?? null,
      saleId: p.saleId ?? null,
      chatId,
      turi: p.turi,
      holat: "XATO",
      versiya,
      idempotencyKey: kalit,
      debtBefore: qarz.debtBefore,
      debtAdded: qarz.debtAdded,
      debtAfter: qarz.debtAfter,
      matn,
      urinish: 0,
      // Yaratgan oqim satrni DARHOL band qiladi — parallel so'rov shu
      // yerdan keyin kelsa yubora olmaydi.
      bandAt: new Date(),
    };

    try {
      yozuv = (await prisma.telegramNotification.create({
        data,
        select: YOZUV_TANLOV,
      })) as Yozuv;
    } catch (e) {
      if (!unikalXatomi(e)) throw e;
      // PARALLEL SO'ROV: boshqa oqim shu kalit bilan ulgurdi.
      const boshqa = (await prisma.telegramNotification.findFirst({
        where: { businessId: p.businessId, idempotencyKey: kalit },
        select: YOZUV_TANLOV,
      })) as Yozuv | null;
      if (!boshqa) throw e;
      if (boshqa.holat === "YUBORILDI") {
        return { holat: "DUBLIKAT", notificationId: boshqa.id, versiya: boshqa.versiya };
      }
      // Satrni g'olib oqim yaratdi va u hozir yuborayotgan bo'lishi mumkin —
      // band qila olmasak, ikkinchi nusxa YUBORILMAYDI.
      if (!(await bandQil(boshqa.id))) {
        return { holat: "DUBLIKAT", notificationId: boshqa.id, versiya: boshqa.versiya };
      }
      yozuv = boshqa;
      matn = boshqa.matn;
    }
  }

  // ---- YUBORISH (o'zi 3 martagacha urinadi) ----
  const natija = await telegramYubor(chatId, matn);

  // ---- NATIJANI JURNALGA ----
  // `matn` va qarz snapshoti YANGILANMAYDI — ular birinchi yozishda
  // muzlatilgan.
  await prisma.telegramNotification.update({
    where: { id: yozuv.id },
    data: {
      holat: natija.ok ? "YUBORILDI" : "XATO",
      urinish: yozuv.urinish + natija.urinish,
      sentAt: natija.ok ? new Date() : null,
      xato: natija.ok ? null : (natija.xato ?? "Noma'lum xato"),
      // Band belgisi bo'shatiladi: yiqilgan bo'lsa keyingi urinish darhol
      // (eskirishni kutmasdan) mumkin bo'lsin.
      bandAt: null,
      ...(chatId !== yozuv.chatId ? { chatId } : {}),
    },
  });

  if (!natija.ok) {
    return {
      holat: "XATO",
      notificationId: yozuv.id,
      versiya,
      xato: natija.xato ?? "Noma'lum xato",
    };
  }
  return { holat: "YUBORILDI", notificationId: yozuv.id, versiya };
}

/**
 * SAVDO OQIMLARI UCHUN XAVFSIZ O'ROVCHI.
 *
 * Telegram ishlamasa ham sotuv saqlanadi va foydalanuvchi xato ko'rmaydi
 * (spec 14). Bu funksiya HECH QACHON tashlamaydi.
 */
export async function buyurtmaXabarnomasiniUrin(p: XabarnomaParams): Promise<void> {
  try {
    await buyurtmaXabarnomasi(p);
  } catch (e) {
    console.error("Mijozga Telegram xabarnomasi yuborilmadi:", e);
  }
}

/**
 * QO'LDA QAYTA YUBORISH (UI dagi "Qayta yuborish" tugmasi).
 *
 * Tur AVTOMATIK tanlanadi, chunki tugmaning ma'nosi holatga qarab o'zgaradi:
 *   - buyurtma bekor qilingan  → SALE_CANCELLED;
 *   - avval muvaffaqiyatli xabar ketgan → SALE_UPDATED (YANGI versiya, ya'ni
 *     YANGI snapshot): mijoz "o'zgartirish kiritildi" xabarini yangilangan
 *     raqamlar bilan oladi (spec 9);
 *   - aks holda → SALE_CREATED, ya'ni yiqilgan birinchi xabarni O'SHA
 *     snapshot bilan qayta urinish.
 */
export async function xabarnomaniQaytaYubor(params: {
  businessId: string;
  chekId?: string | null;
  saleId?: string | null;
}): Promise<XabarnomaNatija> {
  const buyurtma = await buyurtmaOqi(params.businessId, params);
  if (!buyurtma) throw new ForbiddenError("Buyurtma topilmadi");

  const manba = params.chekId ? { chekId: params.chekId } : { saleId: params.saleId };
  const yuborilgan = await prisma.telegramNotification.findFirst({
    where: {
      businessId: params.businessId,
      ...manba,
      holat: "YUBORILDI",
      turi: { in: ["SALE_CREATED", "SALE_UPDATED"] },
    },
    select: { id: true },
  });

  const turi: XabarTuri = buyurtma.bekorQilingan
    ? "SALE_CANCELLED"
    : yuborilgan
      ? "SALE_UPDATED"
      : "SALE_CREATED";

  const natija = await buyurtmaXabarnomasi({
    businessId: params.businessId,
    chekId: params.chekId ?? null,
    saleId: params.saleId ?? null,
    turi,
  });

  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "telegramNotification",
    entityId:
      "notificationId" in natija ? natija.notificationId : (params.chekId ?? params.saleId ?? "?"),
    after: { turi, holat: natija.holat, qolda: true },
  });

  return natija;
}
