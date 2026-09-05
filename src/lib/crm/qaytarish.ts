import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { kunlikSinxron } from "@/lib/services/kunlik";
import { logAudit } from "@/lib/services/audit";
import { yopiqHolat, type ZakazHolat } from "@/lib/crm/pipeline";

/**
 * "YUTILDI" DAN QAYTARISH — MOLIYANI HAM ORQAGA OLIB, ATOMIK.
 *
 * ═══ NEGA ALOHIDA MODUL ═══
 * `lib/crm/yakunlash.ts` zakazni moliyaga OLIB CHIQADI (kirim + qarzdorlik).
 * Uning teskarisi ilgari umuman yo'q edi: moliyaga o'tgan zakaz holati
 * qulflanardi ("avval kirim/qarz yozuvini tuzating"), ya'ni noto'g'ri
 * yutilgan zakazni faqat qo'lda — Kirim va Qarzdorlik bo'limlarida alohida
 * tuzatib — qaytarish mumkin edi. Direktor uchun bu bitta amal bo'lishi
 * kerak, aks holda yarim tuzatilgan holat (kirim o'chdi, qarz qoldi)
 * ehtimoli har safar bor edi.
 *
 * ═══ NIMA QILADI ═══
 *  1. zakazdan yozilgan HAR BIR kirimni yumshoq o'chiradi (`deletedAt` +
 *     `deletedBy`) — ledger append-only qoladi, savatdan tiklash mumkin;
 *  2. aralash to'lov qatorlarining kirim bog'lanishini uzadi, shunda zakaz
 *     qayta yutilsa kirim YANGIDAN yoziladi (dublikat himoyasi buzilmaydi);
 *  3. ochilgan qarzni BEKOR qiladi (`lib/services/qarz.ts` → `qarzBekor`
 *     bilan AYNI qoida: to'lovi bor qarz bekor qilinmaydi);
 *  4. zakazni yangi holatga o'tkazadi.
 *
 * Hammasi BITTA `runBusinessTx` ichida: yarmi bajarilib yarmi qolsa CRM
 * "qaytarildi" deb turgan zakazning puli kassada qolib ketardi.
 *
 * ═══ NEGA HARD DELETE EMAS ═══
 * Kirim kassaga bog'langan ledger qatori — u butunlay o'chirilsa kassa
 * qoldig'i sababsiz o'zgaradi va audit izi uziladi (ayni qoida
 * `api/transactions/[id]` da ham bor). Yumshoq o'chirish esa qoldiqdan
 * chiqaradi va yozuvni savatda qoldiradi.
 */

export interface ZakazQaytarishNatija {
  dealId: string;
  /** Yumshoq o'chirilgan kirimlar. */
  ochirilganKirimlar: string[];
  /** O'chirilgan kirimlar jami (so'm). */
  kirimSumma: number;
  /** Bekor qilingan qarz yozuvi (bo'lsa). */
  bekorQilinganQarzId: string | null;
}

export interface ZakazQaytarishParams {
  businessId: string;
  dealId: string;
  /** Amalni bajarayotgan direktor/administrator. */
  userId: string;
  /** Zakaz qaysi holatga qaytariladi. */
  yangiHolat: Exclude<ZakazHolat, "YUTILDI">;
  /** Yangi holatning bosqichi (`pipelineBosqichlari` dan). */
  stageId: string;
  /** YOQOTILDI ga qaytarilsa — sababi. */
  yoqotishSababi?: string | null;
}

export async function zakazMoliyasiniQaytarish(
  params: ZakazQaytarishParams
): Promise<ZakazQaytarishNatija> {
  const natija = await runBusinessTx(params.businessId, async (tx) => {
    // Tranzaksiya ichida xom `tx` — HAR so'rovga `businessId` sharti QO'LDA
    // yoziladi (lib/db/businessTx.ts kelishuvi).
    const deal = await tx.deal.findFirst({
      where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
      select: { id: true, contactId: true, holat: true, transactionId: true, debtId: true },
    });
    if (!deal) throw new ForbiddenError("Zakaz topilmadi");

    const satrlar = await tx.dealTolov.findMany({
      where: { businessId: params.businessId, dealId: deal.id },
      select: { id: true, transactionId: true },
    });

    // Kirim bog'lanishlari ikki joyda: `Deal.transactionId` (bir kanalli
    // eski zakaz) va har to'lov qatorida (aralash to'lov). Ikkalasi ham
    // yig'iladi — takrorlanmasin uchun to'plam orqali.
    const kirimIdlari = Array.from(
      new Set(
        [deal.transactionId, ...satrlar.map((s) => s.transactionId)].filter(
          (x): x is string => !!x
        )
      )
    );

    const kirimlar =
      kirimIdlari.length > 0
        ? await tx.transaction.findMany({
            where: { id: { in: kirimIdlari }, businessId: params.businessId, deletedAt: null },
          })
        : [];

    // QARZ. To'lovi bor qarz bekor qilinmaydi — `qarzBekor` bilan AYNI
    // qoida: pul haqiqatda kelgan bo'lsa uni jimgina yo'q qilib bo'lmaydi.
    let bekorQilinganQarzId: string | null = null;
    if (deal.debtId) {
      const qarz = await tx.debt.findFirst({
        where: { id: deal.debtId, businessId: params.businessId },
        select: { id: true, tolangan: true, status: true },
      });
      if (qarz && qarz.status !== "CANCELLED") {
        if (qarz.tolangan > 0) {
          throw new BadRequestError(
            "Bu zakaz qarziga to'lov qabul qilingan — avval Qarzdorlik bo'limida to'lovlarni tuzating, " +
              "keyin zakaz holatini qaytaring"
          );
        }
        await tx.debt.updateMany({
          where: { id: qarz.id, businessId: params.businessId, tolangan: 0 },
          data: {
            status: "CANCELLED",
            isYopilgan: true,
            cancelledAt: new Date(),
            cancelledBy: params.userId,
            cancelReason: "Zakaz 'Yutildi' holatidan qaytarildi",
            updatedBy: params.userId,
          },
        });
        bekorQilinganQarzId = qarz.id;
      }
    }

    const endi = new Date();
    for (const kirim of kirimlar) {
      await tx.transaction.updateMany({
        where: { id: kirim.id, businessId: params.businessId, deletedAt: null },
        data: { deletedAt: endi, deletedBy: params.userId },
      });
    }

    // Bog'lanishlarni uzish — zakaz qayta yutilsa kirim YANGIDAN yoziladi.
    // (`transactionId: null` sharti `yakunlash.ts` dagi dublikat himoyasining
    // kaliti, shuning uchun uni tozalash SHART.)
    if (satrlar.some((s) => s.transactionId)) {
      await tx.dealTolov.updateMany({
        where: { businessId: params.businessId, dealId: deal.id },
        data: { transactionId: null },
      });
    }

    const upd = await tx.deal.updateMany({
      where: { id: deal.id, businessId: params.businessId, deletedAt: null, holat: deal.holat },
      data: {
        transactionId: null,
        debtId: null,
        holat: params.yangiHolat,
        stageId: params.stageId,
        yopilganAt: yopiqHolat(params.yangiHolat) ? endi : null,
        holatAt: endi,
        yoqotishSababi:
          params.yangiHolat === "YOQOTILDI" ? params.yoqotishSababi?.trim() || null : null,
      },
    });
    if (upd.count !== 1) {
      throw new BadRequestError("Zakaz holati o'zgarib ketdi — sahifani yangilang");
    }

    const kirimSumma = kirimlar.reduce((s, k) => s + k.summa, 0);
    await tx.activity.create({
      data: {
        businessId: params.businessId,
        dealId: deal.id,
        contactId: deal.contactId,
        turi: "tizim",
        matn:
          `Yutildi holatidan qaytarildi (${params.yangiHolat}). ` +
          `O'chirilgan kirim: ${kirimSumma} so'm` +
          (bekorQilinganQarzId ? ", qarz bekor qilindi" : ""),
        userId: params.userId,
      },
    });

    return { kirimlar, kirimSumma, bekorQilinganQarzId };
  });

  // KUNLIK hisobot sinxroni tranzaksiyadan TASHQARIDA: `kunlikSinxron` o'zi
  // `runBusinessTx` ochadi (lib/crm/yakunlash.ts bilan bir xil sabab).
  for (const kirim of natija.kirimlar) {
    await kunlikSinxron({ ...kirim, deletedAt: new Date() }, null);
  }

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "deal",
    entityId: params.dealId,
    before: { holat: "YUTILDI", moliya: "yozilgan" },
    after: {
      holat: params.yangiHolat,
      amal: "yutildidan-qaytarish",
      ochirilganKirimlar: natija.kirimlar.map((k) => k.id),
      kirimSumma: natija.kirimSumma,
      bekorQilinganQarzId: natija.bekorQilinganQarzId,
    },
  });

  return {
    dealId: params.dealId,
    ochirilganKirimlar: natija.kirimlar.map((k) => k.id),
    kirimSumma: natija.kirimSumma,
    bekorQilinganQarzId: natija.bekorQilinganQarzId,
  };
}

/** Zakaz moliyaga o'tganmi (kirim yoki qarz yozilgan). */
export async function zakazMoliyagaOtganmi(businessId: string, dealId: string): Promise<boolean> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, businessId, deletedAt: null },
    select: { transactionId: true, debtId: true },
  });
  return Boolean(deal?.transactionId || deal?.debtId);
}
