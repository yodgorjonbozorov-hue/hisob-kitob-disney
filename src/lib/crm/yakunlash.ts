import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { createTransactionTx } from "@/lib/services/transactionService";
import { shaxsiyKassaId } from "@/lib/services/kassaTanlash";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { qarzLimitTekshirTx } from "@/lib/services/mijoz";
import { kunlikSinxron } from "@/lib/services/kunlik";
import { qarzHolatHisobla, qarzYopiqmi } from "@/lib/validation/qarz";
import { utcDateToDateOnlyString, todayTashkentDateOnlyString, dateOnlyStringToUTCDate } from "@/lib/date";
import { kirimIzohi } from "@/lib/crm/kirim";
import { pipelineBosqichlari } from "@/lib/crm/service";
import { kirimUlushi, qarzUlushi, tolovHolati, type TolovHolat } from "@/lib/crm/pipeline";
import { kirimSatrlari, satrIzohi } from "@/lib/crm/tolovlar";

/**
 * ZAKAZNI YUTILDI QILISH — CRM va MOLIYA o'rtasidagi yagona yakuniy ko'prik.
 *
 * "Yutildi" — BIZNES yakuni ("ish tugadi"), to'lov holati esa ALOHIDA
 * haqiqat manbai (5-talab). Shuning uchun yakunlash butun summani ko'r-ko'rona
 * kirimga yozmaydi, `Deal.tolangan` ni o'qiydi va pulni IKKIGA bo'ladi:
 *
 *   to'liq to'langan  → butun summa KIRIM;
 *   qisman to'langan  → to'langan qism KIRIM, qolgani QARZDORLIK;
 *   aralash to'lov    → HAR KANAL uchun alohida KIRIM (naqd qism naqd
 *                       kassaga, click/payme/terminal karta/hisob kassasiga),
 *                       qolgani QARZDORLIK;
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
 * QOLDIQ NOL BO'LSA QARZ OCHILMAYDI. `qarzUlushi` 0 qaytarsa (to'liq
 * to'langan yoki narxsiz zakaz) `Debt` yozuvi UMUMAN yaratilmaydi —
 * `jamiSumma = 0` bo'lgan qarz Qarzdorlar ro'yxatida ko'rinmaydi
 * (`listQarzdorlar` qoldiqsizni tashlab ketadi) va CRM "qarzdorlikka
 * yozildi" deb yolg'on ko'rsatardi. Shart pastda IKKI joyda: hisobda
 * (`qarzSumma > 0`) va yozuvdan oldingi himoya tekshiruvida.
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
 *
 * ═══ NEGA IKKI QATLAM (`...Tx` + o'rama) ═══
 * Direktor tuzatishi (`lib/crm/direktorTahrir.ts`) moliyani QAYTARADI,
 * summani o'zgartiradi va QAYTA yozadi — uchalasi BITTA tranzaksiyada
 * bo'lishi shart (CLAUDE.md: har moliyaviy ko'p qadamli amal atomik).
 * Shuning uchun yozish mantig'i `zakazniYakunlashTx` da: u tayyor `tx`
 * ichida ishlaydi va boshqa amal bilan bir tranzaksiyaga qo'shiladi.
 * `zakazniYakunlash` esa avvalgidek mustaqil amal bo'lib qoladi.
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

/** Tranzaksiya ichida yozilgan kirim — kunlik sinxron uchun. */
type YozilganKirim = Awaited<ReturnType<typeof createTransactionTx>>;

export interface YakunlashTxParams extends YakunlashParams {
  /**
   * YUTILDI bosqichining IDsi. Tranzaksiyadan OLDIN olinadi
   * (`pipelineBosqichlari` kerak bo'lsa bosqich YARATADI — bu yozuv amali
   * bo'lgani uchun tranzaksiya ichida chaqirilmaydi).
   */
  yutildiStageId: string;
  /**
   * Faoliyat jurnalidagi sarlavha. Berilmasa zakaz holatidan aniqlanadi
   * ("Yutildi" yoki "Moliyaga o'tkazildi").
   */
  sarlavha?: string;
}

export interface YakunlashTxNatija extends Omit<YakunlashNatija, "dealId"> {
  dealId: string;
  /** Shu chaqiruvda YOZILGAN kirimlar — `kunlikSinxron` tranzaksiyadan KEYIN. */
  yangiKirimlar: YozilganKirim[];
}

/**
 * ZAKAZNI YAKUNLASH — TRANZAKSIYA ICHIDAGI YADRO.
 *
 * `tx` ichida xom delegatlar ishlatiladi, shuning uchun HAR so'rovga
 * `businessId` sharti QO'LDA yozilgan (lib/db/businessTx.ts kelishuvi).
 * Chaqiruvchi biznes egaligini `runBusinessTx` orqali allaqachon tekshirgan.
 */
export async function zakazniYakunlashTx(
  tx: BusinessTx,
  params: YakunlashTxParams
): Promise<YakunlashTxNatija> {
  const deal = await tx.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: {
      id: true,
      nomi: true,
      summa: true,
      tolangan: true,
      tolovTuri: true,
      categoryId: true,
      contactId: true,
      masulId: true,
      sana: true,
      holat: true,
      transactionId: true,
      debtId: true,
    },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");

  const [kategoriya, kontakt] = await Promise.all([
    deal.categoryId
      ? tx.category.findFirst({
          where: { id: deal.categoryId, businessId: params.businessId },
          select: { id: true, nomi: true, turi: true },
        })
      : Promise.resolve(null),
    deal.contactId
      ? tx.contact.findFirst({
          where: { id: deal.contactId, businessId: params.businessId },
          select: { id: true, ism: true, tel: true },
        })
      : Promise.resolve(null),
  ]);
  if (kategoriya && kategoriya.turi !== "kirim") {
    throw new BadRequestError("Zakaz kategoriyasi kirim turida emas");
  }

  const kirimSumma = kirimUlushi(deal.summa, deal.tolangan);
  const qarzSumma = qarzUlushi(deal.summa, deal.tolangan, deal.tolovTuri);

  // ARALASH TO'LOV: har kanal uchun alohida kirim yoziladi. Qatorlarsiz
  // (eski) zakazda bitta sun'iy qator qaytadi — pastdagi kod ikki xil
  // yo'lni bilishi shart emas (`lib/crm/tolovlar.ts`).
  const tolovSatrlari = await tx.dealTolov.findMany({
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
      yangiKirimlar: [],
    };
  }

  const izoh = kirimIzohi(deal.nomi, kontakt?.ism);
  // Kirim/qarz sanasi — ZAKAZ SANASI (xizmat qaysi kunga bo'lgan bo'lsa),
  // sanasiz eski zakazlarda bugun.
  const sana = deal.sana ? utcDateToDateOnlyString(deal.sana) : todayTashkentDateOnlyString();

  // SOTUVCHI = zakaz MAS'ULI (kirim.ts bilan AYNI qoida): xodim statistikasi
  // zakazni kim olgan bo'lsa o'shanga yoziladi, tugmani kim bosgani emas.
  const masul = await tx.user.findFirst({
    where: { id: deal.masulId },
    select: { id: true, ism: true },
  });
  const sotuvchiId = masul?.id ?? params.userId;

  let transactionId = deal.transactionId;
  let debtId = deal.debtId;
  /** Shu chaqiruvda yozilgan kirimlar — kunlik sinxron uchun (tx dan tashqarida). */
  const yangiKirimlar: YozilganKirim[] = [];

  for (const satr of satrlar) {
    if (satr.summa <= 0 || satr.transactionId) continue;
    const categoryId =
      deal.categoryId ?? (await ensureCategoryTx(tx, params.businessId, ZAXIRA_KATEGORIYA, "kirim"));
    // KASSA — ZAKAZ MAS'ULINIKI (sotuvchi bilan AYNI qoida): zakazni
    // yutgan xodimning kassasi ko'payadi va u shu pulni topshiradi.
    // Shaxsiy kassa rejimi o'chiq bo'lsa `null` — eski xatti-harakat.
    // NAQD bo'lmagan qism bu yerda hech qachon shaxsiy kassaga tushmaydi
    // (`shaxsiyKassaId` faqat naqdga ishlaydi), demak click/payme/terminal
    // puli karta/hisob kassasiga boradi.
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
        mijozNomi: kontakt?.ism ?? deal.nomi,
        mijozTel: kontakt?.tel ?? undefined,
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

  const endi = new Date();
  await tx.deal.updateMany({
    where: { id: deal.id, businessId: params.businessId, deletedAt: null },
    // `holatAt` — doska "Yutildi" ustunidagi tartib kaliti: endigina
    // yutilgan zakaz ustunning ENG TEPASIDA turadi.
    // YO'QOTISH SABABI tozalanadi: zakaz yutilgach eski sabab yolg'on
    // bo'lib osilib qolardi (`holatniOzgartirish` bilan AYNI qoida).
    data: {
      holat: "YUTILDI",
      stageId: params.yutildiStageId,
      yopilganAt: endi,
      holatAt: endi,
      yoqotishSababi: null,
    },
  });

  const holat = tolovHolati(deal.summa, deal.tolangan, deal.tolovTuri);
  // Allaqachon yutilgan zakazda bu chaqiruv faqat moliyani to'ldiradi.
  const sarlavha = params.sarlavha ?? (deal.holat === "YUTILDI" ? "Moliyaga o'tkazildi" : "Yutildi");
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

  return {
    dealId: deal.id,
    yangiYakun: true,
    kirimSumma,
    qarzSumma,
    transactionId,
    debtId,
    yangiKirimlar,
  };
}

/**
 * ZAKAZNI YAKUNLASH (YUTILDI).
 *
 * Kirim, qarz va holat BITTA tranzaksiyada yoziladi: biri bajarilib
 * ikkinchisi bajarilmasa CRM "yutilgan" deb turgan zakazning puli hech
 * qayerda ko'rinmasdi (`runBusinessTx` — loyiha qoidasi).
 */
export async function zakazniYakunlash(params: YakunlashParams): Promise<YakunlashNatija> {
  // Bosqichlar tranzaksiyadan OLDIN: yetishmaganini YARATADI, ya'ni bu
  // yozuv amali va tranzaksiya ichida chaqirilmaydi.
  const bosqichlar = await pipelineBosqichlari(params.businessId);

  const natija = await runBusinessTx(params.businessId, (tx) =>
    zakazniYakunlashTx(tx, { ...params, yutildiStageId: bosqichlar.YUTILDI })
  );

  // KUNLIK hisobot sinxroni tranzaksiyadan TASHQARIDA: `kunlikSinxron` o'zi
  // `runBusinessTx` ochadi, ichkarida chaqirilsa SQLite yozuv qulfida
  // deadlock bo'lardi (`lib/crm/kirim.ts` bilan bir xil sabab).
  await kunlikSinxronBarchasi(params.userId, natija.yangiKirimlar);

  return {
    dealId: natija.dealId,
    yangiYakun: natija.yangiYakun,
    kirimSumma: natija.kirimSumma,
    qarzSumma: natija.qarzSumma,
    transactionId: natija.transactionId,
    debtId: natija.debtId,
  };
}

/**
 * Yozilgan kirimlarni KUNLIK hisobotga sinxronlaydi — tranzaksiyadan
 * TASHQARIDA (`kunlikSinxron` o'zi `runBusinessTx` ochadi).
 */
export async function kunlikSinxronBarchasi(
  userId: string,
  kirimlar: YozilganKirim[]
): Promise<void> {
  if (kirimlar.length === 0) return;
  const kim = await prisma.user.findFirst({ where: { id: userId }, select: { ism: true } });
  for (const kirim of kirimlar) {
    await kunlikSinxron(kirim, kim?.ism ?? null);
  }
}
