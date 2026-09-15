import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { createTransactionTx } from "@/lib/services/transactionService";
import { shaxsiyKassaId } from "@/lib/services/kassaTanlash";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { qarzLimitTekshirTx } from "@/lib/services/mijoz";
import { kunlikSinxron } from "@/lib/services/kunlik";
import { qarzHolatHisobla, qarzYopiqmi } from "@/lib/validation/qarz";
import { utcDateToDateOnlyString, todayTashkentDateOnlyString, dateOnlyStringToUTCDate } from "@/lib/date";
import { kirimIzohi } from "@/lib/crm/kirim";
import { pipelineBosqichlari } from "@/lib/crm/service";
import {
  kirimUlushi,
  qarzUlushi,
  tolovHolati,
  yutildiTekshiruvi,
  type TolovHolat,
} from "@/lib/crm/pipeline";
import { kirimSatrlari, satrIzohi } from "@/lib/crm/tolovlar";

/**
 * ZAKAZNI YUTILDI QILISH — CRM va MOLIYA o'rtasidagi yakuniy ko'prik.
 *
 * ═══ "YUTILDI" — MOLIYAVIY AMAL EMAS, HOLAT ═══
 * Pul kassaga TO'LOV QILINGAN PAYTDA tushadi (`lib/crm/tolovQoshish.ts`):
 * har `DealTolov` qatori o'z kirim tranzaksiyasini yozadi. Shuning uchun bu
 * yerda odatda YANGI KIRIM YOZILMAYDI — barcha qatorlar allaqachon
 * bog'langan bo'ladi va sikl ularni chetlab o'tadi. Zakaz Yutildi
 * bo'lganda butun summa QAYTA kirim qilib yozilmaydi: DUBLIKAT yo'q.
 *
 * Kirim SHU YERDA faqat ikki holda yoziladi:
 *   - ESKI, qatorsiz zakaz (pul `Deal.tolangan` da, kirimi hali yo'q);
 *   - kirimi uzilgan qator ("Yutildi"dan qaytarilgan zakaz qayta yutilganda
 *     — `lib/crm/qaytarish.ts` bog'lanishlarni bo'shatadi).
 *
 * ═══ TO'LIQ TO'LANMAGAN ZAKAZ YUTILDIGA O'TMAYDI ═══
 * `yutildiTekshiruvi` (`lib/crm/pipeline.ts`) — YAGONA qoida, SERVERDA
 * majburlanadi: brauzerdagi tugmani o'chirish himoya emas. Qisman
 * to'langan zakaz "Jarayonda" bo'lib qoladi; qolgan summa QOLDIQ bo'lib
 * turadi va QARZ HISOBLANMAYDI.
 *
 * ═══ QARZ FAQAT ANIQ TANLOV BILAN ═══
 * Qarzdorlik ikki holdagina ochiladi:
 *   1. `Deal.tolovTuri = "qarz"` — zakaz nasiyaga berilgan deb belgilangan;
 *   2. `qarzgaYopish = true` — yakunlash oynasida "qolgan summani
 *      qarzdorlikka yozib yakunlash" ataylab bosilgan.
 * Zalog berilganining O'ZI hech qachon qarz yaratmaydi.
 *
 * Qarzga berilgan savdo kirim yozmasligi — mavjud qarz moduli qoidasi
 * (`lib/services/qarz.ts`): mahsulot ketdi, pul kelmadi, balans o'zgarmaydi.
 * Kirim keyin, qarz to'langanda, TO'LOV SANASI bilan yoziladi.
 *
 * DUBLIKATGA QARSHI UCH QATLAM, kirim VA qarz uchun bir xil:
 *   1. Baza: `DealTolov.transactionId`, `Deal.transactionId` va
 *      `Deal.debtId` UNIQUE + tranzaksiya ichida `updateMany({ ...Id: null })`
 *      sharti. Ikki so'rov bir vaqtda kelsa ikkinchisining butun
 *      tranzaksiyasi qaytariladi.
 *   2. Xizmat qatlami: allaqachon yakunlangan zakazda JIMGINA mavjud
 *      natija qaytadi (takror bosish xato emas — ish bajarilgan).
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
  /**
   * QOLGAN SUMMANI QARZDORLIKKA YOZIB YAKUNLASH — ANIQ tanlov.
   *
   * To'liq to'lanmagan zakaz odatda "Yutildi"ga o'tmaydi. Nasiya savdoda
   * esa bu normal: shu bayroq bilan zakaz yakunlanadi va QOLDIQ uchun
   * `Debt` ochiladi. Bayroqsiz qarz HECH QACHON yaratilmaydi.
   */
  qarzgaYopish?: boolean;
}

export interface YakunlashNatija {
  dealId: string;
  /** Shu so'rov haqiqatda yakunladimi (false — takror bosish). */
  yangiYakun: boolean;
  kirimSumma: number;
  qarzSumma: number;
  /** Shu chaqiruvda YANGI yozilgan kirimlar soni (odatda 0 — pul avval kelgan). */
  yangiKirimSoni: number;
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

  // TO'LOVNING HAQIQAT MANBAI — QATORLAR (`lib/crm/tolovQoshish.ts`).
  // `Deal.tolangan` — o'sha qatorlarning keshi; qatorsiz eski zakazda esa
  // pulning yagona manbai. Shuning uchun yig'indi shu tartibda olinadi.
  const tolovSatrlari = await prisma.dealTolov.findMany({
    where: { businessId: params.businessId, dealId: deal.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, kanal: true, summa: true, transactionId: true },
  });
  const tolangan =
    tolovSatrlari.length > 0
      ? tolovSatrlari.reduce((sum, t) => sum + t.summa, 0)
      : deal.tolangan;

  const qarzgaYopish = params.qarzgaYopish === true;
  const kirimSumma = kirimUlushi(deal.summa, tolangan);
  const qarzSumma = qarzUlushi(deal.summa, tolangan, deal.tolovTuri, qarzgaYopish);

  const satrlar = kirimSatrlari(deal, tolovSatrlari, kirimSumma);
  const kopKanal = satrlar.length > 1;

  // IDEMPOTENTLIK. Yakunlangan va moliyasi yozilgan zakazda hech narsa
  // qayta yozilmaydi — mavjud natija qaytadi (takror bosish xato emas).
  // Tekshiruvdan OLDIN: allaqachon yakunlangan zakaz qayta bosilganda
  // "to'liq to'lanmagan" xatosi chiqmasin.
  const moliyaYozilgan =
    satrlar.every((s) => s.summa === 0 || s.transactionId !== null) &&
    (qarzSumma === 0 || deal.debtId !== null);
  if (deal.holat === "YUTILDI" && moliyaYozilgan) {
    return {
      dealId: deal.id,
      yangiYakun: false,
      kirimSumma,
      qarzSumma,
      yangiKirimSoni: 0,
      transactionId: deal.transactionId,
      debtId: deal.debtId,
    };
  }

  // ═══ ASOSIY SHART: TO'LIQ TO'LANMAGAN ZAKAZ YUTILDIGA O'TMAYDI ═══
  // Server qatlamidagi tekshiruv — brauzerdagi tugmani o'chirish yetarli
  // emas (API'ni to'g'ridan-to'g'ri chaqirish mumkin).
  const tekshiruv = yutildiTekshiruvi(deal.summa, tolangan, deal.tolovTuri, qarzgaYopish);
  if (!tekshiruv.mumkin) throw new BadRequestError(tekshiruv.xato ?? "Zakazni yakunlab bo'lmadi");

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
    /** Shu chaqiruvda yozilgan kirimlar — kunlik sinxron uchun (tx dan tashqarida). */
    const yangiKirimlar: Array<Awaited<ReturnType<typeof createTransactionTx>>> = [];

    for (const satr of satrlar) {
      if (satr.summa <= 0 || satr.transactionId) continue;
      const categoryId =
        deal.categoryId ?? (await ensureCategoryTx(tx, params.businessId, ZAXIRA_KATEGORIYA, "kirim"));
      // KASSA — ZAKAZ MAS'ULINIKI (sotuvchi bilan AYNI qoida): zakazni
      // yutgan xodimning kassasi ko'payadi va u shu pulni topshiradi.
      // Shaxsiy kassa rejimi o'chiq bo'lsa `null` — eski xatti-harakat.
      // NAQD bo'lmagan qism bu yerda hech qachon shaxsiy kassaga tushmaydi
      // (`shaxsiyKassaId` faqat naqdga ishlaydi), demak click/terminal puli
      // karta/hisob kassasiga boradi.
      const accountId =
        (satrlar.length === 1 ? params.accountId : null) ??
        (await shaxsiyKassaId(tx, params.businessId, sotuvchiId, satr.tolovTuri));
      const created = await createTransactionTx(tx, params.userId, params.businessId, {
        turi: "kirim",
        categoryId,
        summa: satr.summa,
        sana,
        izoh: satrIzohi(izoh, satr.kanal, kopKanal),
        accountId,
        // QARZ kanali kirimga uzatilmaydi: bu yerda yoziladigan summa
        // HAQIQATDA olingan pul, qolgani alohida qarz yozuvi bo'ladi.
        tolovTuri: satr.tolovTuri,
        sotuvchiId,
      });
      // ATOMIK BOG'LASH: `transactionId: null` sharti — poyga himoyasi.
      // Ikki so'rov bir vaqtda kelsa ikkinchisining butun tranzaksiyasi
      // qaytariladi, ya'ni dublikat kirim BAZAGA TUSHMAYDI.
      const bogland = satr.satrId
        ? await tx.dealTolov.updateMany({
            where: { id: satr.satrId, businessId: params.businessId, transactionId: null },
            data: { transactionId: created.id },
          })
        : await tx.deal.updateMany({
            where: { id: deal.id, businessId: params.businessId, transactionId: null, deletedAt: null },
            data: { transactionId: created.id },
          });
      if (bogland.count !== 1) {
        throw new BadRequestError("Bu zakaz bo'yicha kirim allaqachon yozilgan");
      }
      // ORQAGA MOSLIK: `Deal.transactionId` — "kirim yozilganmi" degan
      // savolning eski javobi (ZakazMoliya, jamoa qulfi, KPI). Aralash
      // to'lovda u BIRINCHI kirimga bog'lanadi; to'liq summa esa
      // qatorlardan yig'iladi.
      if (!transactionId) {
        await tx.deal.updateMany({
          where: { id: deal.id, businessId: params.businessId, transactionId: null, deletedAt: null },
          data: { transactionId: created.id },
        });
        transactionId = created.id;
      }
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

    // HOLAT CAS — PARALLEL YAKUNLASH HIMOYASI. Oldingi holat shart qilib
    // yoziladi: ikki so'rov bir vaqtda kelsa ikkinchisining sharti
    // bajarilmaydi va BUTUN tranzaksiyasi qaytariladi (ikkinchi "Yutildi"
    // yozuvi, ikkinchi faoliyat qatori va — eski zakazlarda — ikkinchi
    // kirim/qarz bazaga TUSHMAYDI).
    //
    // Ketma-ket takror bosish bu yerga YETIB KELMAYDI: u yuqoridagi
    // idempotentlik tekshiruvida jimgina `yangiYakun: false` bilan qaytadi.
    const holatYozildi = await tx.deal.updateMany({
      where: { id: deal.id, businessId: params.businessId, deletedAt: null, holat: deal.holat },
      // `holatAt` — doska "Yutildi" ustunidagi tartib kaliti: endigina
      // yutilgan zakaz ustunning ENG TEPASIDA turadi.
      data: { holat: "YUTILDI", stageId: bosqichlar.YUTILDI, yopilganAt: new Date(), holatAt: new Date() },
    });
    if (holatYozildi.count !== 1) {
      throw new BadRequestError("Zakaz holati ayni paytda o'zgardi — sahifani yangilang");
    }

    const holat = tolovHolati(deal.summa, tolangan, deal.tolovTuri);
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
    // Odatda 0: pul to'lov qilingan paytda allaqachon kirimga tushgan.
    // Noldan katta bo'lsa — eski (qatorsiz) zakaz yoki qaytarilgandan
    // keyin qayta yakunlangan zakaz.
    yangiKirimSoni: natija.yangiKirimlar.length,
    transactionId: natija.transactionId,
    debtId: natija.debtId,
  };
}
