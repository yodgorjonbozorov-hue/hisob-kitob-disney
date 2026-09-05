import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { logAudit } from "@/lib/services/audit";
import { buyurtmaOqi, type BuyurtmaMalumot } from "@/lib/telegram/buyurtma";
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
 * ── DUBLIKATDAN HIMOYA ────────────────────────────────────────────────────
 * Jurnal yozuvi YUBORISHDAN OLDIN yaratiladi va u
 * `@@unique([chekId, turi, versiya])` cheklovi bilan qo'riqlanadi. Ya'ni
 * ikkinchi urinish bazaga JISMONAN sig'maydi:
 *
 *   - yozuv bor va "YUBORILDI"  → xabar allaqachon ketgan, QAYTA YUBORILMAYDI;
 *   - yozuv bor va "XATO"       → o'sha yozuv ustidan qayta urinish (yangi
 *                                 satr yaratilmaydi, `urinish` oshadi).
 *
 * Bu himoya ilova mantig'ida emas, BAZADA turadi — parallel ikki so'rov
 * (tugma ikki marta bosilgan, hodisa qayta kelgan) ham dublikat yarata
 * olmaydi.
 *
 * ── VERSIYALASH (spec 9) ──────────────────────────────────────────────────
 * SALE_CREATED har doim 1-versiya. Buyurtma o'zgarib qayta yuborilsa
 * SALE_UPDATED keyingi versiya bilan yoziladi. "Oxirgi yuborilgan vaqt" va
 * "oxirgi yuborilgan versiya" shu jurnaldan o'qiladi — chek/sotuv jadvaliga
 * denormalizatsiya qilingan ustun ATAYLAB yo'q (u jurnaldan ajralib qolardi).
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
  /** Shu tur + versiya allaqachon muvaffaqiyatli ketgan. */
  | { holat: "DUBLIKAT"; notificationId: string; versiya: number }
  /** Telegram qabul qilmadi — jurnalda "XATO" bo'lib qoladi. */
  | { holat: "XATO"; notificationId: string; versiya: number; xato: string };

export interface XabarnomaParams {
  businessId: string;
  chekId?: string | null;
  saleId?: string | null;
  turi: XabarTuri;
}

/** Buyurtma turiga mos matn. */
function matnYasa(turi: XabarTuri, b: BuyurtmaMalumot): string {
  if (turi === "SALE_CANCELLED") return bekorXabari(b);
  if (turi === "SALE_UPDATED") return ozgarishXabari(b);
  return xaridXabari(b);
}

/** Xato Prisma'ning unique cheklovi bo'yicha kelganmi. */
function unikalXatomi(e: unknown): boolean {
  return !!e && typeof e === "object" && (e as { code?: string }).code === "P2002";
}

/**
 * Keyingi versiya raqami.
 *
 * SALE_CREATED va SALE_CANCELLED — har doim 1: buyurtma bir marta yaratiladi
 * va bir marta bekor qilinadi. SALE_UPDATED esa mavjud eng katta
 * yaratish/o'zgartirish versiyasidan bittaga katta bo'ladi.
 */
async function keyingiVersiya(p: XabarnomaParams): Promise<number> {
  if (p.turi !== "SALE_UPDATED") return 1;
  const oxirgi = await prisma.telegramNotification.aggregate({
    where: {
      businessId: p.businessId,
      ...(p.chekId ? { chekId: p.chekId } : { saleId: p.saleId }),
      turi: { in: ["SALE_CREATED", "SALE_UPDATED"] },
    },
    _max: { versiya: true },
  });
  return (oxirgi._max.versiya ?? 0) + 1;
}

/**
 * XABARNOMANI YUBORADI (asosiy funksiya).
 *
 * Tashlashi mumkin (buyurtma topilmasa) — savdo oqimidan `...Urin()`
 * o'rovchisi orqali chaqiriladi.
 */
export async function buyurtmaXabarnomasi(p: XabarnomaParams): Promise<XabarnomaNatija> {
  if (!p.chekId && !p.saleId) throw new BadRequestError("Buyurtma ko'rsatilmagan");

  const buyurtma = await buyurtmaOqi(p.businessId, p);
  // Mijozsiz savdo (chakana o'tkinchi xaridor) — yuboriladigan manzil yo'q.
  if (!buyurtma) return { holat: "ULANMAGAN" };

  const chatId = buyurtma.mijoz.telegramChatId;
  if (!chatId) return { holat: "ULANMAGAN" };

  const versiya = await keyingiVersiya(p);
  const matn = matnYasa(p.turi, buyurtma);

  // ---- 1. NAVBATNI BAND QILISH ----
  // Yozuv yuborishdan OLDIN yaratiladi: unique cheklov dublikatni shu
  // yerda to'sadi. Boshlang'ich holat "XATO" va `urinish = 0` — jarayon
  // yarim yo'lda uzilsa yozuv "yuborilmagan" bo'lib qoladi (xavfsiz tomon).
  let yozuv: { id: string; holat: string; urinish: number };
  try {
    yozuv = await prisma.telegramNotification.create({
      data: {
        businessId: p.businessId,
        contactId: buyurtma.mijoz.id,
        chekId: p.chekId ?? null,
        saleId: p.saleId ?? null,
        chatId,
        turi: p.turi,
        holat: "XATO",
        versiya,
        matn,
        urinish: 0,
      },
      select: { id: true, holat: true, urinish: true },
    });
  } catch (e) {
    if (!unikalXatomi(e)) throw e;
    const mavjud = await prisma.telegramNotification.findFirst({
      where: {
        businessId: p.businessId,
        ...(p.chekId ? { chekId: p.chekId } : { saleId: p.saleId }),
        turi: p.turi,
        versiya,
      },
      select: { id: true, holat: true, urinish: true },
    });
    if (!mavjud) throw e;
    // Allaqachon ketgan — mijozga ikkinchi marta yuborilmaydi.
    if (mavjud.holat === "YUBORILDI") {
      return { holat: "DUBLIKAT", notificationId: mavjud.id, versiya };
    }
    yozuv = mavjud;
  }

  // ---- 2. YUBORISH (o'zi 3 martagacha urinadi) ----
  const natija = await telegramYubor(chatId, matn);

  // ---- 3. NATIJANI JURNALGA ----
  await prisma.telegramNotification.update({
    where: { id: yozuv.id },
    data: {
      holat: natija.ok ? "YUBORILDI" : "XATO",
      urinish: yozuv.urinish + natija.urinish,
      sentAt: natija.ok ? new Date() : null,
      xato: natija.ok ? null : natija.xato ?? "Noma'lum xato",
      matn,
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
 *   - avval muvaffaqiyatli xabar ketgan → SALE_UPDATED (yangi versiya bilan),
 *     ya'ni mijoz "o'zgartirish kiritildi" xabarini YANGILANGAN raqamlar
 *     bilan oladi (spec 9);
 *   - aks holda → SALE_CREATED (yiqilgan birinchi xabarni qayta urinish).
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
    entityId: "notificationId" in natija ? natija.notificationId : (params.chekId ?? params.saleId ?? "?"),
    after: { turi, holat: natija.holat, qolda: true },
  });

  return natija;
}
