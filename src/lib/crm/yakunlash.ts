import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { qarzLimitTekshirTx } from "@/lib/services/mijoz";
import { kunlikSinxron } from "@/lib/services/kunlik";
import { qarzHolatHisobla, qarzYopiqmi } from "@/lib/validation/qarz";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { kirimIzohi } from "@/lib/crm/kirim";
import { pipelineBosqichlari } from "@/lib/crm/service";
import { kirimUlushi, qarzUlushi, tolovHolati, yutishTosigi, type TolovHolat } from "@/lib/crm/pipeline";
import { kirimSatrlari } from "@/lib/crm/tolovlar";
import { zakazKirimKonteksti, tolovKirimiYoz } from "@/lib/crm/tolovKirimi";

/**
 * ZAKAZNI YUTILDI QILISH — CRM va MOLIYA o'rtasidagi yagona yakuniy ko'prik.
 *
 * ═══ "YUTILDI" — STATUS, PUL YOZADIGAN AMAL EMAS ═══
 * Pul endi KELGAN PAYTDA kirimga tushadi (`lib/crm/tolovQoshish.ts`): har
 * `DealTolov` qatori o'z `Transaction` i bilan tug'iladi. Shuning uchun bu
 * yerda odatda YOZILADIGAN HECH NARSA QOLMAYDI — sikl faqat KIRIMI YO'Q
 * qatorlarni to'ldiradi:
 *   - eski (qatorsiz) zakazlar — pul `Deal.tolangan` da turadi;
 *   - "Yutildidan qaytarish" dan keyin qayta yakunlash (bog'lanish uzilgan).
 * Aynan shu sabab TO'LIQ TO'LANGAN zakazni yutish DUBLIKAT KIRIM
 * yaratmaydi (5-test).
 *
 * ═══ TO'LIQ TO'LANMAGAN ZAKAZ YUTILMAYDI ═══
 * `yutishTosigi` (`lib/crm/pipeline.ts`) SERVERDA majburlaydi: qoldig'i bor
 * zakaz "Yutildi" ga o'tmaydi. Ilgari u o'tib ketar va qolgan summa
 * O'ZIDAN QARZGA yozilardi — 750 000 lik zakazga 200 000 zalog bergan mijoz
 * darhol 550 000 qarzdorga aylanardi. ZALOG QARZ EMAS.
 *
 * QARZ FAQAT ATAYLAB: `Deal.tolovTuri = "qarz"` — foydalanuvchi savdoni
 * qarzga yopishni tanlagan bo'lsa (`qarzUlushi`). Boshqa hech qanday yo'l
 * bilan zakaz qarz yaratmaydi.
 *
 * `summa <= 0` (narxsiz zakaz) — moliyaviy yozuvsiz yutiladi, avvalgidek.
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

  // TO'LIQ TO'LANMAGAN ZAKAZ YUTILMAYDI — SERVERDA. Frontendda tugmani
  // o'chirish himoya emas: bu yo'lga doskadan sudrash, tez amallar paneli,
  // bosqichga ko'chirish va API ning o'zi ham kiradi (4-test).
  //
  // ALLAQACHON YUTILGAN zakaz tekshiruvdan o'tkazilmaydi: bu chaqiruv unda
  // faqat yetishmayotgan moliyaviy yozuvni to'ldiradi (eski yozuvlar,
  // qaytarishdan keyingi qayta yakunlash). Eski ma'lumotlar tegilmaydi.
  if (deal.holat !== "YUTILDI") {
    const tosiq = yutishTosigi(deal.summa, deal.tolangan, deal.tolovTuri);
    if (tosiq) throw new BadRequestError(tosiq);
  }

  const kirimSumma = kirimUlushi(deal.summa, deal.tolangan);
  const qarzSumma = qarzUlushi(deal.summa, deal.tolangan, deal.tolovTuri);

  // ARALASH TO'LOV: har kanal uchun alohida kirim yoziladi. Qatorlarsiz
  // (eski) zakazda bitta sun'iy qator qaytadi — pastdagi kod ikki xil
  // yo'lni bilishi shart emas (`lib/crm/tolovlar.ts`).
  const tolovSatrlari = await prisma.dealTolov.findMany({
    where: { businessId: params.businessId, dealId: deal.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, kanal: true, summa: true, transactionId: true },
  });
  const satrlar = kirimSatrlari(deal, tolovSatrlari, kirimSumma);
  const kopKanal = satrlar.length > 1;

  // IDEMPOTENTLIK. Yakunlangan va moliyasi yozilgan zakazda hech narsa
  // qayta yozilmaydi — mavjud natija qaytadi (6-test: ikki marta bosilsa
  // ham bitta kirim). HAR QATOR alohida tekshiriladi.
  const moliyaYozilgan =
    satrlar.every((s) => s.summa === 0 || s.transactionId !== null) &&
    (qarzSumma === 0 || deal.debtId !== null);
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

  // KIRIM KONTEKSTI — sotuvchi (zakaz mas'uli), kategoriya, izoh va sana
  // bir marta yig'iladi (`lib/crm/tolovKirimi.ts`). Kirim/qarz sanasi —
  // ZAKAZ SANASI (xizmat qaysi kunga bo'lgan bo'lsa), sanasiz eski
  // zakazlarda bugun.
  const ktx = await zakazKirimKonteksti(deal, {
    businessId: params.businessId,
    userId: params.userId,
    kopKanal,
    // Kassa faqat BITTA qator bo'lganda tanlanadi: aralash to'lovda har
    // kanal o'z kassasiga tushishi kerak.
    accountId: satrlar.length === 1 ? params.accountId : null,
  });
  const sana = ktx.sana;
  const masul = ktx.masul;

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    // Tranzaksiya ichida xom `tx` — HAR so'rovga `businessId` sharti QO'LDA
    // yoziladi (lib/db/businessTx.ts).
    let transactionId = deal.transactionId;
    let debtId = deal.debtId;
    /** Shu chaqiruvda yozilgan kirimlar — kunlik sinxron uchun (tx dan tashqarida). */
    const yangiKirimlar: Array<Awaited<ReturnType<typeof tolovKirimiYoz>>> = [];

    // KIRIMI YO'Q qatorlarni to'ldirish. To'lov paytida kirim yozilgan
    // qatorlar (odatiy yo'l) bu yerda O'TKAZIB YUBORILADI — dublikat kirim
    // shu tekshiruv bilan oldini olinadi (`lib/crm/tolovKirimi.ts`).
    for (const satr of satrlar) {
      if (satr.summa <= 0 || satr.transactionId) continue;
      const created = await tolovKirimiYoz(tx, ktx, deal.id, satr);
      if (!transactionId) transactionId = created.id;
      yangiKirimlar.push(created);
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
      // `holatAt` — doska "Yutildi" ustunidagi tartib kaliti: endigina
      // yutilgan zakaz ustunning ENG TEPASIDA turadi.
      data: { holat: "YUTILDI", stageId: bosqichlar.YUTILDI, yopilganAt: new Date(), holatAt: new Date() },
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

    return { transactionId, debtId, yangiKirimlar };
  });

  // KUNLIK hisobot sinxroni tranzaksiyadan TASHQARIDA: `kunlikSinxron` o'zi
  // `runBusinessTx` ochadi, ichkarida chaqirilsa SQLite yozuv qulfida
  // deadlock bo'lardi (`lib/crm/kirim.ts` bilan bir xil sabab).
  if (natija.yangiKirimlar.length > 0) {
    const kim = await prisma.user.findFirst({ where: { id: params.userId }, select: { ism: true } });
    for (const kirim of natija.yangiKirimlar) {
      await kunlikSinxron(kirim, kim?.ism ?? null);
    }
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
