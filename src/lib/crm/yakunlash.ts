import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { createTransactionTx } from "@/lib/services/transactionService";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { qarzLimitTekshirTx } from "@/lib/services/mijoz";
import { kunlikSinxron } from "@/lib/services/kunlik";
import { qarzHolatHisobla, qarzYopiqmi } from "@/lib/validation/qarz";
import { utcDateToDateOnlyString, todayTashkentDateOnlyString, dateOnlyStringToUTCDate } from "@/lib/date";
import { kirimIzohi } from "@/lib/crm/kirim";
import { pipelineBosqichlari } from "@/lib/crm/service";
import { kirimUlushi, qarzUlushi, tolovHolati, type TolovHolat } from "@/lib/crm/pipeline";

/**
 * ZAKAZNI YUTILDI QILISH — CRM va MOLIYA o'rtasidagi yagona yakuniy ko'prik.
 *
 * "Yutildi" — BIZNES yakuni ("ish tugadi"), to'lov holati esa ALOHIDA
 * haqiqat manbai (5-talab). Shuning uchun yakunlash butun summani ko'r-ko'rona
 * kirimga yozmaydi, `Deal.tolangan` ni o'qiydi va pulni IKKIGA bo'ladi:
 *
 *   to'liq to'langan  → butun summa KIRIM;
 *   qisman to'langan  → to'langan qism KIRIM, qolgani QARZDORLIK;
 *   qarzga            → kirim YO'Q, butun summa QARZDORLIK —
 *                       FAQAT foydalanuvchi "Qarzga" ni tanlaganda;
 *   to'lov tanlanmagan→ kirim ham, qarz ham YO'Q (holat YUTILDI bo'ladi).
 *
 * YUTILDI QARZNI AVTOMATIK OCHMAYDI. To'lov holati faqat foydalanuvchi
 * tanlovidan (`lib/crm/pipeline.ts` → `tolovHolati`): `tolangan = 0` ning
 * o'zi "qarzga" emas. To'lovi keyin belgilangan yutilgan zakazda shu
 * funksiya qayta chaqiriladi (API PATCH) va yetishmayotgan yozuv yoziladi —
 * foydalanuvchi alohida "kirimga o'tkazish" bosmaydi.
 *
 * Qarzga berilgan savdo kirim yozmasligi — mavjud qarz moduli qoidasi
 * (`lib/services/qarz.ts`): mahsulot ketdi, pul kelmadi, balans o'zgarmaydi.
 * Kirim keyin, qarz to'langanda, TO'LOV SANASI bilan yoziladi.
 *
 * DUBLIKATGA QARSHI UCH QATLAM (13-talab), kirim VA qarz uchun bir xil:
 *   1. Baza: `Deal.transactionId` va `Deal.debtId` UNIQUE + tranzaksiya
 *      ichida `updateMany({ ...Id: null })` sharti. Ikki so'rov bir vaqtda
 *      kelsa ikkinchisining butun tranzaksiyasi qaytariladi.
 *   2. Xizmat qatlami: allaqachon yakunlangan zakazda JIMGINA mavjud
 *      natija qaytadi (takror bosish xato emas — ish allaqachon bajarilgan).
 *   3. Frontend: tugma o'rniga "Kirim yaratildi" ko'rsatiladi.
 */

/** Kategoriyasiz eski zakazlar uchun zaxira kategoriya (kirim.ts bilan bir xil). */
const ZAXIRA_KATEGORIYA = "Sotuv";

/** Faoliyat jurnalidagi to'lov holati matni. */
const TOLOV_MATNI: Record<TolovHolat, string> = {
  TOLANGAN: "to'liq to'langan",
  QISMAN: "qisman to'langan",
  QARZ: "qarzga",
  TANLANMAGAN: "to'lov tanlanmagan",
};

export interface YakunlashParams {
  businessId: string;
  dealId: string;
  userId: string;
  /** Qaysi kassaga tushdi (ixtiyoriy — berilmasa to'lov turiga mos kassa). */
  accountId?: string | null;
}

export interface YakunlashNatija {
  dealId: string;
  /** Shu so'rov haqiqatda yakunladimi (false — takror bosish). */
  yangiYakun: boolean;
  kirimSumma: number;
  qarzSumma: number;
  transactionId: string | null;
  debtId: string | null;
}

/**
 * ZAKAZNI YAKUNLASH (YUTILDI).
 *
 * Kirim, qarz va holat BITTA tranzaksiyada yoziladi: biri bajarilib
 * ikkinchisi bajarilmasa CRM "yutilgan" deb turgan zakazning puli hech
 * qayerda ko'rinmasdi (`runBusinessTx` — loyiha qoidasi).
 */
export async function zakazniYakunlash(params: YakunlashParams): Promise<YakunlashNatija> {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    include: {
      contact: { select: { id: true, ism: true, tel: true } },
      category: { select: { id: true, nomi: true, turi: true } },
    },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");
  if (deal.category && deal.category.turi !== "kirim") {
    throw new BadRequestError("Zakaz kategoriyasi kirim turida emas");
  }

  const kirimSumma = kirimUlushi(deal.summa, deal.tolangan);
  const qarzSumma = qarzUlushi(deal.summa, deal.tolangan, deal.tolovTuri);

  // IDEMPOTENTLIK. Yakunlangan va moliyasi yozilgan zakazda hech narsa
  // qayta yozilmaydi — mavjud natija qaytadi (8-test: ikki marta bosilsa
  // ham bitta kirim).
  const moliyaYozilgan =
    (kirimSumma === 0 || deal.transactionId !== null) && (qarzSumma === 0 || deal.debtId !== null);
  if (deal.holat === "YUTILDI" && moliyaYozilgan) {
    return {
      dealId: deal.id,
      yangiYakun: false,
      kirimSumma,
      qarzSumma,
      transactionId: deal.transactionId,
      debtId: deal.debtId,
    };
  }

  const bosqichlar = await pipelineBosqichlari(params.businessId);
  const izoh = kirimIzohi(deal.nomi, deal.contact?.ism);
  // Kirim/qarz sanasi — ZAKAZ SANASI (xizmat qaysi kunga bo'lgan bo'lsa),
  // sanasiz eski zakazlarda bugun.
  const sana = deal.sana ? utcDateToDateOnlyString(deal.sana) : todayTashkentDateOnlyString();

  // SOTUVCHI = zakaz MAS'ULI (kirim.ts bilan AYNI qoida): xodim statistikasi
  // zakazni kim olgan bo'lsa o'shanga yoziladi, tugmani kim bosgani emas.
  const masul = await prisma.user.findFirst({
    where: { id: deal.masulId },
    select: { id: true, ism: true },
  });
  const sotuvchiId = masul?.id ?? params.userId;

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    // Tranzaksiya ichida xom `tx` — HAR so'rovga `businessId` sharti QO'LDA
    // yoziladi (lib/db/businessTx.ts).
    let transactionId = deal.transactionId;
    let debtId = deal.debtId;
    /** Shu chaqiruvda yozilgan kirim — kunlik sinxron uchun (tx dan tashqarida). */
    let yangiKirim: Awaited<ReturnType<typeof createTransactionTx>> | null = null;

    if (kirimSumma > 0 && !transactionId) {
      const categoryId =
        deal.categoryId ?? (await ensureCategoryTx(tx, params.businessId, ZAXIRA_KATEGORIYA, "kirim"));
      const created = await createTransactionTx(tx, params.userId, params.businessId, {
        turi: "kirim",
        categoryId,
        summa: kirimSumma,
        sana,
        izoh,
        accountId: params.accountId ?? null,
        // QARZ kanali kirimga uzatilmaydi: bu yerda yoziladigan summa
        // HAQIQATDA olingan pul, qolgani alohida qarz yozuvi bo'ladi.
        tolovTuri: deal.tolovTuri === "qarz" ? null : deal.tolovTuri,
        sotuvchiId,
      });
      // ATOMIK BOG'LASH: `transactionId: null` sharti — poyga himoyasi.
      const bogland = await tx.deal.updateMany({
        where: { id: deal.id, businessId: params.businessId, transactionId: null, deletedAt: null },
        data: { transactionId: created.id },
      });
      if (bogland.count !== 1) {
        throw new BadRequestError("Bu zakaz bo'yicha kirim allaqachon yozilgan");
      }
      transactionId = created.id;
      yangiKirim = created;
    }

    if (qarzSumma > 0 && !debtId) {
      // Mijoz limiti qarz yozilishidan OLDIN, ayni tranzaksiya ichida
      // (`lib/services/qarz.ts` bilan bir xil qoida).
      if (deal.contactId) {
        await qarzLimitTekshirTx(tx, params.businessId, deal.contactId, qarzSumma);
      }
      const status = qarzHolatHisobla(qarzSumma, 0);
      const qarz = await tx.debt.create({
        data: {
          businessId: params.businessId,
          turi: "olinadigan",
          contactId: deal.contactId ?? undefined,
          mijozNomi: deal.contact?.ism ?? deal.nomi,
          mijozTel: deal.contact?.tel ?? undefined,
          jamiSumma: qarzSumma,
          tolangan: 0,
          status,
          isYopilgan: qarzYopiqmi(status),
          sana: dateOnlyStringToUTCDate(sana),
          categoryId: deal.categoryId ?? undefined,
          masulId: masul?.id ?? undefined,
          masulIsm: masul?.ism ?? undefined,
          izoh: `CRM zakaz: ${izoh}`,
          userId: params.userId,
        },
      });
      const bogland = await tx.deal.updateMany({
        where: { id: deal.id, businessId: params.businessId, debtId: null, deletedAt: null },
        data: { debtId: qarz.id },
      });
      if (bogland.count !== 1) {
        throw new BadRequestError("Bu zakaz bo'yicha qarz allaqachon yozilgan");
      }
      debtId = qarz.id;
    }

    await tx.deal.updateMany({
      where: { id: deal.id, businessId: params.businessId, deletedAt: null },
      data: { holat: "YUTILDI", stageId: bosqichlar.YUTILDI, yopilganAt: new Date() },
    });

    const holat = tolovHolati(deal.summa, deal.tolangan, deal.tolovTuri);
    // Allaqachon yutilgan zakazda bu chaqiruv faqat moliyani to'ldiradi.
    const sarlavha = deal.holat === "YUTILDI" ? "Moliyaga o'tkazildi" : "Yutildi";
    await tx.activity.create({
      data: {
        businessId: params.businessId,
        dealId: deal.id,
        contactId: deal.contactId,
        turi: "tizim",
        matn:
          `${sarlavha} (${TOLOV_MATNI[holat]}). ` +
          `Kirim: ${kirimSumma} so'm, qarzdorlik: ${qarzSumma} so'm`,
        userId: params.userId,
      },
    });

    return { transactionId, debtId, yangiKirim };
  });

  // KUNLIK hisobot sinxroni tranzaksiyadan TASHQARIDA: `kunlikSinxron` o'zi
  // `runBusinessTx` ochadi, ichkarida chaqirilsa SQLite yozuv qulfida
  // deadlock bo'lardi (`lib/crm/kirim.ts` bilan bir xil sabab).
  if (natija.yangiKirim) {
    const kim = await prisma.user.findFirst({ where: { id: params.userId }, select: { ism: true } });
    await kunlikSinxron(natija.yangiKirim, kim?.ism ?? null);
  }

  return {
    dealId: deal.id,
    yangiYakun: true,
    kirimSumma,
    qarzSumma,
    transactionId: natija.transactionId,
    debtId: natija.debtId,
  };
}
