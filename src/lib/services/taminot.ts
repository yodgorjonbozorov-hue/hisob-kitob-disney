import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { currentTenantId } from "@/lib/db/tenantContext";
import { dateOnlyStringToUTCDate, todayDateOnlyString, utcDateToDateOnlyString } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import { pulHarakatiTx, qabulYozuvlariTx, satrlarniTayyorla } from "@/lib/services/xarid";
import type {
  CreateTaminotInput,
  TaminotTolovUsuli,
  UpdateTaminotInput,
} from "@/lib/validation/taminot";

/**
 * TA'MINOT — "Omborga ta'minot" oqimining xizmat qatlami.
 *
 * BIR QADAM: yozuv yaratiladi va O'SHA ZAHOTI qabul qilingan hisoblanadi.
 * Eski uch qadamli xarid oqimi (qoralama → tasdiqlangan → qabul) o'z joyida
 * qoldi, lekin ikkalasi ham AYNI BIR hisob qoidasidan foydalanadi —
 * `qabulYozuvlariTx` (lib/services/xarid.ts). Ombor va pul yozuvlari faqat
 * o'sha funksiyada yoziladi, shuning uchun ikki oqim hech qachon ikki xil
 * natija bermaydi.
 *
 * Qoldiqning YAGONA manbasi baribir `Product.miqdor` — bu yerda ham u
 * `StockEntry` bilan birga, bitta atomik amalda oshiriladi.
 */

/** Idempotentlik kaliti bo'yicha mavjud ta'minotni topadi. */
async function kalitBoyichaTop(businessId: string, idempotencyKey: string) {
  return prisma.purchaseOrder.findFirst({
    where: { businessId, idempotencyKey },
    select: { id: true, jamiSumma: true, tolanganSumma: true, debtId: true, transactionId: true },
  });
}

export interface TaminotNatija {
  id: string;
  jamiSumma: number;
  tolanganSumma: number;
  debtId: string | null;
  transactionId: string | null;
  /**
   * TAKROR YUBORISH ANIQLANDI. Yangi yozuv yaratilmadi — mavjudi qaytarildi.
   * Frontend buni xato sifatida ko'rsatmaydi: foydalanuvchi uchun amal
   * baribir MUVAFFAQIYATLI tugadi, faqat ikki marta yozilmadi.
   */
  takror: boolean;
}

/**
 * TA'MINOTNI SAQLASH — bitta atomik amalda:
 *   1. `PurchaseOrder` (holat darhol "qabul_qilingan");
 *   2. `PurchaseOrderItem` — har mahsulot uchun satr;
 *   3. `StockEntry` + `Product.miqdor` oshishi + tannarx snapshot;
 *   4. pul harakati: naqd/karta → chiqim tranzaksiya (tanlangan kassadan),
 *      qarzga → "beriladigan" qarz ("Men qarzdorman" bo'limida ko'rinadi);
 *   5. audit yozuvi.
 * Bir qismi yiqilsa — hammasi orqaga qaytadi.
 *
 * TAKROR BOSISHDAN HIMOYA ikki qavatli:
 *   - tranzaksiyadan oldin kalit bo'yicha qidiruv (tez yo'l);
 *   - `@@unique([businessId, idempotencyKey])` — ikki so'rov BIR VAQTDA
 *     kelganda ham ikkinchisi bazada to'xtaydi va mavjud yozuv qaytariladi.
 * Faqat birinchi qavat bo'lganda parallel ikki so'rov ikkalasi ham "hali
 * yo'q" deb ko'rib, omborni ikki marta oshirardi.
 */
export async function taminotYarat(params: {
  businessId: string;
  userId: string;
  data: CreateTaminotInput;
}): Promise<TaminotNatija> {
  const { businessId, userId, data } = params;
  const sana = data.sana ?? todayDateOnlyString();
  const tenantId = currentTenantId();

  const oldindan = await kalitBoyichaTop(businessId, data.idempotencyKey);
  if (oldindan) return { ...oldindan, takror: true };

  let natija: TaminotNatija;
  try {
    natija = await runBusinessTx(businessId, async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: data.supplierId, businessId, deletedAt: null },
        select: { id: true },
      });
      if (!supplier) throw new ForbiddenError("Ta'minotchi topilmadi");

      const { tayyor, jamiSumma } = await satrlarniTayyorla(tx, businessId, data.satrlar);

      const qarzga = data.tolovUsuli === "qarz";
      const order = await tx.purchaseOrder.create({
        data: {
          businessId,
          supplierId: data.supplierId,
          holat: "qabul_qilingan",
          sana: dateOnlyStringToUTCDate(sana),
          qabulSana: dateOnlyStringToUTCDate(sana),
          tolovTuri: qarzga ? "qarz" : "naqd",
          jamiSumma,
          izoh: data.izoh?.trim() || undefined,
          idempotencyKey: data.idempotencyKey,
          userId,
        },
      });

      for (const s of tayyor) {
        await tx.purchaseOrderItem.create({ data: { businessId, orderId: order.id, ...s } });
      }

      const yozuv = await qabulYozuvlariTx(tx, {
        businessId,
        orderId: order.id,
        userId,
        tenantId,
        sana,
        supplierId: data.supplierId,
        tolovTuri: qarzga ? "qarz" : "naqd",
        accountId: data.accountId,
        tolovUsuli: data.tolovUsuli === "karta" ? "karta" : data.tolovUsuli === "naqd" ? "naqd" : null,
      });

      const yangilangan = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          jamiSumma: yozuv.jamiSumma,
          tolanganSumma: yozuv.tolangan,
          transactionId: yozuv.transactionId,
          transferId: yozuv.transferId,
          debtId: yozuv.debtId,
        },
        select: {
          id: true,
          jamiSumma: true,
          tolanganSumma: true,
          debtId: true,
          transactionId: true,
        },
      });
      return { ...yangilangan, takror: false };
    });
  } catch (e) {
    // Parallel ikkinchi so'rov unique cheklovga urildi — ombor ikki marta
    // oshmadi. Foydalanuvchiga xato emas, birinchi yozuvning natijasi beriladi.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const mavjud = await kalitBoyichaTop(businessId, data.idempotencyKey);
      if (mavjud) return { ...mavjud, takror: true };
    }
    throw e;
  }

  await logAudit({
    businessId,
    action: "create",
    entity: "purchaseOrder",
    entityId: natija.id,
    after: {
      taminot: true,
      supplierId: data.supplierId,
      tolovUsuli: data.tolovUsuli,
      jamiSumma: natija.jamiSumma,
      tolanganSumma: natija.tolanganSumma,
      satrlar: data.satrlar.length,
      sana,
    },
  });
  return natija;
}

/**
 * TA'MINOTNI TAHRIRLASH (DIREKTOR) — to'g'rilash, qayta yozish EMAS.
 *
 * Direktor xato kiritilgan ta'minotni to'g'rilay olishi kerak: miqdor,
 * narx, ta'minotchi, sana, izoh va hatto Naqd ↔ Qarz holati. Lekin
 * `PurchaseOrder` yozuvini shunchaki `update` qilish MOLIYANI BUZADI —
 * ombor allaqachon oshgan, kassadan pul chiqqan yoki qarz yozilgan.
 *
 * Shuning uchun tahrirlash bitta atomik amalda uchta ishni birga bajaradi:
 *
 *   1. OMBOR — eski va yangi satrlar FARQI bo'yicha to'g'rilanadi
 *      (50 → 40 bo'lsa qoldiq −10). Har farq uchun `StockAdjustment`
 *      yoziladi: tarix QAYTA YOZILMAYDI, to'g'rilash QO'SHILADI.
 *   2. PUL — eski yozuv butunlay orqaga qaytariladi (chiqim yumshoq
 *      o'chiriladi, qarz o'chiriladi), so'ng yangi holat bo'yicha
 *      `pulHarakatiTx` bilan NOLDAN yoziladi. Shu bois Naqd → Qarz va
 *      Qarz → Naqd o'tishlari alohida tarmoqni talab qilmaydi: ikkalasi
 *      ham "eskisini qaytar, yangisini yoz" qoidasining natijasi.
 *   3. AUDIT — eski va yangi qiymat bilan.
 *
 * RAD ETILADIGAN HOLATLAR (biri bo'lsa butun amal bekor):
 *   - ta'minot qabul qilingan holatda emas (qoralama hech narsaga tegmagan,
 *     bekor qilingani esa allaqachon qaytarilgan);
 *   - to'lov ta'minotchining shaxsiy kassasiga transfer bilan ketgan;
 *   - qarz bo'yicha to'lov qilingan (avval to'lov bekor qilinishi kerak);
 *   - qisman to'langan ta'minot (PRO oqimi) — bu yerda ma'nosi noaniq;
 *   - miqdorni kamaytirish ombor qoldig'ini MANFIYGA tushirsa (tovarning
 *     bir qismi allaqachon sotilgan).
 */
export async function taminotTahrir(params: {
  businessId: string;
  orderId: string;
  userId: string;
  data: UpdateTaminotInput;
}) {
  const { businessId, orderId, userId, data } = params;
  const tenantId = currentTenantId();

  const { natija, oldin } = await runBusinessTx(businessId, async (tx) => {
    const order = await tx.purchaseOrder.findFirst({ where: { id: orderId, businessId } });
    if (!order) throw new ForbiddenError("Ta'minot topilmadi");
    if (order.holat === "bekor") {
      throw new BadRequestError("Bekor qilingan ta'minotni tahrirlab bo'lmaydi");
    }
    if (order.holat !== "qabul_qilingan") {
      throw new BadRequestError(
        "Bu buyurtma hali qabul qilinmagan — avval qabul qiling, keyin tahrirlang"
      );
    }
    if (order.transferId) {
      throw new BadRequestError(
        "Bu ta'minot to'lovi ta'minotchining shaxsiy kassasiga o'tkazilgan — " +
          "avval Kassa transferi bo'limida o'tkazmani qaytaring"
      );
    }
    if (order.tolanganSumma > 0 && order.tolanganSumma < order.jamiSumma) {
      throw new BadRequestError(
        "Qisman to'langan ta'minotni tahrirlab bo'lmaydi — avval uni bekor qilib qaytadan kiriting"
      );
    }

    // Yangi holat: berilmagan maydon avvalgidek qoladi.
    const yangiSupplierId = data.supplierId ?? order.supplierId;
    const supplier = await tx.supplier.findFirst({
      where: { id: yangiSupplierId, businessId, deletedAt: null },
      select: { id: true, nomi: true },
    });
    if (!supplier) throw new ForbiddenError("Ta'minotchi topilmadi");

    const eskiSana = order.qabulSana ?? order.sana;
    const yangiSana = data.sana ?? utcDateToDateOnlyString(eskiSana);
    const yangiUsul: TaminotTolovUsuli =
      data.tolovUsuli ?? (order.tolovTuri === "qarz" ? "qarz" : "naqd");
    const qarzga = yangiUsul === "qarz";

    // --- 1) TEKSHIRUVLAR AVVAL, o'zgarish keyin ---------------------------
    //
    // Tranzaksiya baribir orqaga qaytadi, lekin foydalanuvchi KO'RADIGAN
    // xato birinchi uchragan to'siqniki bo'ladi. Ombor to'sig'i eng foydali
    // xabarni beradi, shuning uchun u birinchi tekshiriladi.
    const eskiSatrlar = await tx.purchaseOrderItem.findMany({ where: { orderId, businessId } });

    const yangiSatrlar = data.satrlar
      ? (await satrlarniTayyorla(tx, businessId, data.satrlar)).tayyor
      : eskiSatrlar.map((s) => ({
          productId: s.productId,
          miqdor: s.miqdor,
          birlikNarx: s.birlikNarx,
          jamiSumma: s.jamiSumma,
        }));

    // Bir mahsulot ikki satrda bo'lishi mumkin — farq MAHSULOT bo'yicha
    // jamlanadi, aks holda to'g'rilash ikki marta yozilardi.
    const eskiMiqdor = miqdorlarniJamla(eskiSatrlar);
    const yangiMiqdor = miqdorlarniJamla(yangiSatrlar);

    const togrilashlar: { productId: string; nomi: string; farq: number; eski: number }[] = [];
    for (const productId of new Set([...eskiMiqdor.keys(), ...yangiMiqdor.keys()])) {
      const farq = (yangiMiqdor.get(productId) ?? 0) - (eskiMiqdor.get(productId) ?? 0);
      if (farq === 0) continue;
      const product = await tx.product.findFirst({
        where: { id: productId, businessId },
        select: { id: true, nomi: true, miqdor: true },
      });
      // Mahsulot o'chirilgan — qaytariladigan qoldiq yo'q (bekor qilishdagi qoida).
      if (!product) continue;
      if (product.miqdor + farq < 0) {
        throw new BadRequestError(
          `"${product.nomi}" dan omborda ${product.miqdor} ta qoldi — ` +
            `${-farq} tasini ayirib bo'lmaydi (bir qismi sotilgan). ` +
            `Avval sotuvni bekor qiling yoki qoldiqni inventarizatsiya bilan to'g'rilang.`
        );
      }
      togrilashlar.push({ productId, nomi: product.nomi, farq, eski: product.miqdor });
    }

    // Qarz: to'lov qilingan bo'lsa tahrirlashga yo'l yo'q — aks holda to'lov
    // "havoda" qolib, kassaga tushgan pul hech qayerga bog'lanmasdi.
    if (order.debtId) {
      const debt = await tx.debt.findFirst({
        where: { id: order.debtId, businessId },
        select: { id: true, tolangan: true },
      });
      if (debt && debt.tolangan > 0) {
        throw new BadRequestError(
          "Bu ta'minot qarzi bo'yicha to'lov qilingan — avval to'lovlarni bekor qiling"
        );
      }
    }

    // --- 2) ESKI PUL YOZUVINI QAYTARISH -----------------------------------
    if (order.transactionId) {
      await tx.transaction.updateMany({
        where: { id: order.transactionId, businessId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }
    if (order.debtId) {
      await tx.debt.deleteMany({ where: { id: order.debtId, businessId } });
    }

    // --- 3) SATRLARNI ALMASHTIRISH ----------------------------------------
    if (data.satrlar) {
      await tx.purchaseOrderItem.deleteMany({ where: { orderId, businessId } });
      for (const s of yangiSatrlar) {
        await tx.purchaseOrderItem.create({ data: { businessId, orderId, ...s } });
      }
    }

    // --- 4) OMBOR TO'G'RILASHI --------------------------------------------
    for (const t of togrilashlar) {
      await tx.product.updateMany({
        where: { id: t.productId, businessId },
        data: { miqdor: { increment: t.farq } },
      });
      await tx.stockAdjustment.create({
        data: {
          businessId,
          productId: t.productId,
          turi: "taminot_tahrir",
          eskiMiqdor: t.eski,
          yangiMiqdor: t.eski + t.farq,
          farq: t.farq,
          sabab: `Ta'minot tahrirlandi (${supplier.nomi})`,
          userId,
        },
      });
    }
    // Tannarx snapshot — yaratishdagi qoida bilan bir xil (oxirgi kelgan narx).
    for (const s of yangiSatrlar) {
      await tx.product.updateMany({
        where: { id: s.productId, businessId },
        data: { kelganNarx: s.birlikNarx },
      });
    }

    // --- 5) YANGI PUL YOZUVI ----------------------------------------------
    const jamiSumma = yangiSatrlar.reduce((a, s) => a + s.jamiSumma, 0);
    const pul = await pulHarakatiTx(tx, {
      businessId,
      orderId,
      userId,
      tenantId,
      sana: yangiSana,
      supplierId: supplier.id,
      tolovTuri: qarzga ? "qarz" : "naqd",
      jamiSumma,
      accountId: data.accountId ?? null,
      tolovUsuli: yangiUsul === "karta" ? "karta" : yangiUsul === "naqd" ? "naqd" : null,
      izohBelgisi: "tahrirlandi",
    });

    const yangilangan = await tx.purchaseOrder.update({
      where: { id: orderId },
      data: {
        supplierId: supplier.id,
        sana: dateOnlyStringToUTCDate(yangiSana),
        qabulSana: dateOnlyStringToUTCDate(yangiSana),
        tolovTuri: qarzga ? "qarz" : "naqd",
        jamiSumma,
        tolanganSumma: pul.tolangan,
        transactionId: pul.transactionId,
        transferId: pul.transferId,
        debtId: pul.debtId,
        ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
      },
    });

    return {
      natija: yangilangan,
      // Audit uchun ESKI qiymat — tranzaksiya ichida olinadi, chunki
      // tashqaridagi ikkinchi so'rov allaqachon yangilangan yozuvni ko'radi.
      oldin: {
        supplierId: order.supplierId,
        tolovTuri: order.tolovTuri,
        jamiSumma: order.jamiSumma,
        tolanganSumma: order.tolanganSumma,
        sana: utcDateToDateOnlyString(eskiSana),
        satrlar: eskiSatrlar.length,
        jamiMiqdor: [...eskiMiqdor.values()].reduce((a, m) => a + m, 0),
      },
    };
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "purchaseOrder",
    entityId: orderId,
    before: { taminot: true, ...oldin },
    after: {
      taminot: true,
      supplierId: natija.supplierId,
      tolovTuri: natija.tolovTuri,
      jamiSumma: natija.jamiSumma,
      tolanganSumma: natija.tolanganSumma,
      sana: utcDateToDateOnlyString(natija.qabulSana ?? natija.sana),
      satrlar: data.satrlar ? data.satrlar.length : oldin.satrlar,
    },
  });
  return natija;
}

/** Mahsulot bo'yicha jamlangan miqdorlar (bir mahsulot ikki satrda bo'lishi mumkin). */
function miqdorlarniJamla(satrlar: { productId: string; miqdor: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of satrlar) m.set(s.productId, (m.get(s.productId) ?? 0) + s.miqdor);
  return m;
}

/**
 * TA'MINOTNI BEKOR QILISH — teskari yozuvlar bilan.
 *
 * Oddiy `delete` XAVFLI: ta'minot allaqachon omborni oshirgan, chiqim yoki
 * qarz yozgan. Faqat qoldiqni kamaytirib qolgan hisobni tashlab ketish esa
 * kassada yoki "Men qarzdorman" bo'limida osilib qolgan raqam qoldiradi.
 *
 * Shuning uchun bekor qilish quyidagilarni BIRGA bajaradi:
 *   - har satr uchun qoldiq qaytariladi va `StockAdjustment` yoziladi
 *     (tarix QAYTA YOZILMAYDI — teskari harakat qo'shiladi);
 *   - naqd/karta bo'lsa chiqim tranzaksiyasi yumshoq o'chiriladi (kassa tiklanadi);
 *   - qarzga bo'lsa qarz o'chiriladi (to'lov qilingan bo'lsa — RAD ETILADI);
 *   - buyurtma "bekor" holatiga o'tadi, kim/qachon/nega yozib qo'yiladi.
 *
 * XAVFSIZLIK TEKSHIRUVLARI (biri buzilsa butun amal rad etiladi):
 *   - tovarning bir qismi allaqachon sotilgan bo'lsa (qoldiq yetmasa) —
 *     bekor qilinmaydi, aks holda ombor manfiyga tushardi;
 *   - qarz bo'yicha to'lov bo'lgan bo'lsa — avval to'lov bekor qilinishi kerak;
 *   - ta'minotchi tizim useri bo'lib, to'lov kassa transferi bilan ketgan
 *     bo'lsa — transfer alohida modulda qaytariladi.
 *
 * TANNARX QAYTARILMAYDI: `Product.kelganNarx` — oxirgi kelgan narx snapshot'i,
 * uning "oldingi qiymati" tizimda saqlanmaydi. Qoldiq qaytarilgani uchun
 * ombor qiymati baribir to'g'ri bo'ladi; narx keyingi ta'minotda yangilanadi.
 */
export async function taminotBekor(params: {
  businessId: string;
  orderId: string;
  userId: string;
  sabab: string;
}) {
  const sabab = params.sabab.trim();
  if (!sabab) throw new BadRequestError("Bekor qilish sababi yozilishi shart");

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const order = await tx.purchaseOrder.findFirst({
      where: { id: params.orderId, businessId: params.businessId },
    });
    if (!order) throw new ForbiddenError("Ta'minot topilmadi");
    if (order.holat === "bekor") throw new BadRequestError("Bu ta'minot allaqachon bekor qilingan");
    if (order.holat !== "qabul_qilingan") {
      // Qoralama/tasdiqlangan hech narsaga tegmagan — teskari yozuv kerak emas.
      return tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          holat: "bekor",
          bekorSana: new Date(),
          bekorSabab: sabab,
          bekorUserId: params.userId,
        },
      });
    }

    if (order.transferId) {
      throw new BadRequestError(
        "Bu ta'minot to'lovi ta'minotchining shaxsiy kassasiga o'tkazilgan — " +
          "avval Kassa transferi bo'limida o'tkazmani qaytaring"
      );
    }

    // 1) TEKSHIRUVLAR AVVAL, o'zgarish keyin.
    //
    // Nega shunday: tranzaksiya baribir orqaga qaytadi, lekin foydalanuvchi
    // KO'RADIGAN xato birinchi uchragan to'siqniki bo'ladi. Tovar qaytmasa
    // ta'minotni bekor qilishning umuman ma'nosi yo'q, shuning uchun ombor
    // to'sig'i BIRINCHI tekshiriladi — xabar ham eng foydalisi bo'ladi.
    const satrlar = await tx.purchaseOrderItem.findMany({
      where: { orderId: order.id, businessId: params.businessId },
    });

    const qaytariladiganlar: { id: string; miqdor: number; eskiMiqdor: number }[] = [];
    for (const s of satrlar) {
      const product = await tx.product.findFirst({
        where: { id: s.productId, businessId: params.businessId },
        select: { id: true, nomi: true, miqdor: true },
      });
      if (!product) continue; // mahsulot o'chirilgan — qaytariladigan qoldiq yo'q
      if (product.miqdor < s.miqdor) {
        throw new BadRequestError(
          `"${product.nomi}" dan omborda ${product.miqdor} ta qoldi — ` +
            `${s.miqdor} tasini qaytarib bo'lmaydi (bir qismi sotilgan). ` +
            `Avval sotuvni bekor qiling yoki qoldiqni inventarizatsiya bilan to'g'rilang.`
        );
      }
      qaytariladiganlar.push({ id: product.id, miqdor: s.miqdor, eskiMiqdor: product.miqdor });
    }

    // Qarz: to'lov qilingan bo'lsa bekor qilishga yo'l yo'q — aks holda
    // to'lov "havoda" qolib, kassadan chiqqan pul hech qayerga bog'lanmasdi.
    if (order.debtId) {
      const debt = await tx.debt.findFirst({
        where: { id: order.debtId, businessId: params.businessId },
        select: { id: true, tolangan: true },
      });
      if (debt) {
        if (debt.tolangan > 0) {
          throw new BadRequestError(
            "Bu ta'minot qarzi bo'yicha to'lov qilingan — avval to'lovlarni bekor qiling"
          );
        }
        await tx.debt.delete({ where: { id: debt.id } });
      }
    }

    // 2) Ombor: qoldiq qaytariladi va TESKARI HARAKAT yoziladi.
    for (const q of qaytariladiganlar) {
      await tx.product.update({
        where: { id: q.id },
        data: { miqdor: { decrement: q.miqdor } },
      });
      // Tarix qayta yozilmaydi — teskari harakat QO'SHILADI.
      await tx.stockAdjustment.create({
        data: {
          businessId: params.businessId,
          productId: q.id,
          turi: "taminot_bekor",
          eskiMiqdor: q.eskiMiqdor,
          yangiMiqdor: q.eskiMiqdor - q.miqdor,
          farq: -q.miqdor,
          sabab: `Ta'minot bekor qilindi: ${sabab}`,
          userId: params.userId,
        },
      });
    }

    // 3) Pul: chiqim tranzaksiyasi yumshoq o'chiriladi (kassa qoldig'i tiklanadi).
    if (order.transactionId) {
      await tx.transaction.updateMany({
        where: { id: order.transactionId, businessId: params.businessId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }

    return tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        holat: "bekor",
        bekorSana: new Date(),
        bekorSabab: sabab,
        bekorUserId: params.userId,
        tolanganSumma: 0,
        debtId: null,
        transactionId: null,
      },
    });
  });

  await logAudit({
    businessId: params.businessId,
    action: "delete",
    entity: "purchaseOrder",
    entityId: params.orderId,
    before: { holat: "qabul_qilingan", jamiSumma: natija.jamiSumma },
    after: { holat: "bekor", sabab },
  });
  return natija;
}
