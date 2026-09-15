import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { kunlikSinxron, type KunlikSinxronYozuv } from "@/lib/services/kunlik";
import { logAudit } from "@/lib/services/audit";
import { todayTashkentDateOnlyString } from "@/lib/date";
import { qoldiqSumma, QARZ_KANALI } from "@/lib/crm/pipeline";
import {
  kanalTolovTuri,
  tolovKanalimi,
  tolovTuriBelgisi,
  TOLOV_KANAL_NOMI,
  TOLOV_SATR_LIMITI,
  type TolovKanali,
} from "@/lib/crm/tolovlar";
import { zakazKirimKonteksti, tolovKirimiYoz } from "@/lib/crm/tolovKirimi";

/**
 * ZAKAZGA TO'LOV QO'SHISH — QO'SHADI, ALMASHTIRMAYDI.
 *
 * ═══ MUAMMO NIMA EDI ═══
 * To'lov faqat zakaz formasidan, QATORLARNI TO'LIQ ALMASHTIRISH yo'li bilan
 * yozilardi (`zakazTolovlariniAlmashtirish`). Forma esa serverdan kelgan
 * eski suratda ishlab, saqlangandan keyin qatorlarni qayta o'qimasdi —
 * natijada "50 000 naqd + 250 000 click" kiritilgan zakazda keyingi saqlash
 * oldingi to'lovlarni YUVIB YUBORARDI. Pul bazada ham, kassada ham
 * yo'qolardi.
 *
 * ENDI HAR TO'LOV — ALOHIDA AMAL: bitta qator qo'shiladi, oldingilari
 * tegilmaydi. Zakazning `tolangan` maydoni esa qatorlar YIG'INDISI bo'lib
 * qoladi (yagona haqiqat manbai):
 *
 *     tolangan  = Σ DealTolov.summa
 *     qoldiq    = Deal.summa − tolangan
 *
 * ═══ PUL DARHOL KASSAGA ═══
 * Har qator o'z KIRIM tranzaksiyasini shu yerda oladi (`tolovKirimi.ts`):
 * 1 000 000 lik zalog bugun Click kassasiga tushadi, "Yutildi" ni kutmaydi.
 * "Yutildi" esa kirim yaratmaydi — u zakazning YAKUNLANGAN statusi.
 *
 * ═══ POYGA HIMOYASI (9-test) ═══
 * Yangi yig'indi `tolangan` ning ESKI qiymati sharti bilan yoziladi. Ikki
 * so'rov bir vaqtda kelsa ikkinchisining `updateMany` i 0 qator yangilaydi
 * va butun tranzaksiya qaytariladi — dublikat to'lov ham, dublikat kirim
 * ham bazaga tushmaydi.
 */

export interface TolovQoshishParams {
  businessId: string;
  dealId: string;
  userId: string;
  /** Pul kanali: "naqd" | "click" | "terminal" | "boshqa". */
  kanal: string;
  summa: number;
  /** Kirim sanasi "YYYY-MM-DD" — berilmasa BUGUN (pul bugun keldi). */
  sana?: string | null;
  /** Qaysi kassaga tushdi (ixtiyoriy — berilmasa kanalga mos kassa). */
  accountId?: string | null;
}

export interface TolovNatija {
  tolovId: string;
  transactionId: string;
  /** Zakazning YANGI jami to'langan summasi (barcha qatorlar yig'indisi). */
  tolangan: number;
  qoldiq: number;
  /** Endi "Yutildi" ga o'tsa bo'ladimi (puli to'liq keldimi). */
  toliqTolandi: boolean;
}

/** To'lov qo'shishdan oldingi umumiy tekshiruv (ikkala amal uchun). */
async function tolovgaOchiqZakaz(businessId: string, dealId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, businessId, deletedAt: null },
    include: {
      contact: { select: { id: true, ism: true } },
      category: { select: { id: true, turi: true } },
    },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");
  // QARZ OCHILGAN ZAKAZ. Pul endi qarz to'lovi orqali, TO'LOV SANASI bilan
  // keladi (`lib/services/qarz.ts`) — bu yerda qabul qilinsa bir pul ikki
  // marta hisobga tushardi.
  if (deal.debtId) {
    throw new BadRequestError(
      "Bu zakaz bo'yicha qarz ochilgan — to'lov Qarzdorlik bo'limi orqali qabul qilinadi"
    );
  }
  if (deal.category && deal.category.turi !== "kirim") {
    throw new BadRequestError("Zakaz kategoriyasi kirim turida emas");
  }
  return deal;
}

export async function zakazgaTolovQoshish(params: TolovQoshishParams): Promise<TolovNatija> {
  if (!tolovKanalimi(params.kanal)) throw new BadRequestError("To'lov kanali noto'g'ri");
  if (!Number.isInteger(params.summa) || params.summa <= 0) {
    throw new BadRequestError("To'lov summasi butun va noldan katta bo'lishi kerak");
  }

  const deal = await tolovgaOchiqZakaz(params.businessId, params.dealId);
  if (deal.summa <= 0) {
    throw new BadRequestError("Zakaz narxi kiritilmagan — avval narxni yozing");
  }

  const kanal = params.kanal as TolovKanali;
  // Kirim sanasi — PUL KELGAN KUN. Zakaz sanasi emas: zalog bugun kelgan
  // bo'lsa kelasi haftaga belgilangan zakaz kunlik kassani bugun oshiradi.
  const sana = params.sana ?? todayTashkentDateOnlyString();

  // KIRIM KONTEKSTI TRANZAKSIYADAN TASHQARIDA yig'iladi. Ichkarida
  // chaqirilsa u alohida ulanish so'raydi va SQLite yozuv qulfi ostida
  // DEADLOCK bo'ladi (`lib/crm/yakunlash.ts` bilan bir xil sabab).
  //
  // `kopKanal` — zakazda birdan ortiq to'lov bo'ladimi: izohga kanal nomi
  // qo'shiladi va foydalanuvchi tanlagan kassa e'tiborga olinmaydi (har
  // kanal O'Z kassasiga tushishi kerak).
  const oldingiSoni = await prisma.dealTolov.count({
    where: { businessId: params.businessId, dealId: deal.id },
  });
  const kopKanal = oldingiSoni > 0;
  const ktx = await zakazKirimKonteksti(deal, {
    businessId: params.businessId,
    userId: params.userId,
    kopKanal,
    accountId: kopKanal ? null : params.accountId,
    sana,
  });

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    // Tranzaksiya ichida xom `tx` — HAR so'rovga `businessId` sharti QO'LDA
    // yoziladi (lib/db/businessTx.ts).
    const hozir = await tx.deal.findFirst({
      where: { id: deal.id, businessId: params.businessId, deletedAt: null },
      select: {
        id: true,
        summa: true,
        tolangan: true,
        tolovTuri: true,
        debtId: true,
        transactionId: true,
      },
    });
    if (!hozir) throw new ForbiddenError("Zakaz topilmadi");
    if (hozir.debtId) {
      throw new BadRequestError(
        "Bu zakaz bo'yicha qarz ochilgan — to'lov Qarzdorlik bo'limi orqali qabul qilinadi"
      );
    }

    const mavjud = await tx.dealTolov.findMany({
      where: { businessId: params.businessId, dealId: deal.id },
      select: { id: true, kanal: true, summa: true },
      orderBy: { createdAt: "asc" },
    });
    if (mavjud.length + 1 > TOLOV_SATR_LIMITI) {
      throw new BadRequestError(`Bir zakazda ${TOLOV_SATR_LIMITI} tadan ko'p to'lov bo'lmaydi`);
    }

    // ESKI, QATORSIZ ZAKAZ: pul `Deal.tolangan` da turadi, qator yo'q.
    //
    // Unga yangi to'lov qo'shilsa eski summa QATORGA KO'CHIRILADI. Aks
    // holda yakunlash faqat qatorlarni ko'rib (`kirimSatrlari`) eski pulni
    // o'tkazib yuborardi va u kirimga hech qachon tushmasdi.
    // Bog'langan kirim bo'lsa (allaqachon yozilgan) qator o'sha yozuvga
    // ulanadi — dublikat kirim yaratilmaydi.
    let qatorJami = mavjud.reduce((s, m) => s + m.summa, 0);
    if (hozir.tolangan > qatorJami) {
      const eskiKanal = tolovKanalimi(hozir.tolovTuri) ? hozir.tolovTuri : "boshqa";
      await tx.dealTolov.create({
        data: {
          businessId: params.businessId,
          dealId: deal.id,
          kanal: eskiKanal,
          summa: hozir.tolangan - qatorJami,
          transactionId: mavjud.length === 0 ? hozir.transactionId : null,
        },
      });
      qatorJami = hozir.tolangan;
    }
    const eskiTolangan = Math.max(hozir.tolangan, qatorJami);
    const qoldiq = qoldiqSumma(hozir.summa, eskiTolangan);
    if (params.summa > qoldiq) {
      throw new BadRequestError(
        qoldiq > 0
          ? `To'lov qoldiqdan ko'p bo'lmasligi kerak. Qoldiq: ${qoldiq} so'm`
          : "Zakaz allaqachon to'liq to'langan"
      );
    }

    const qator = await tx.dealTolov.create({
      data: { businessId: params.businessId, dealId: deal.id, kanal, summa: params.summa },
      select: { id: true, kanal: true, summa: true },
    });

    const kirim = await tolovKirimiYoz(tx, ktx, deal.id, {
      satrId: qator.id,
      tolovTuri: kanalTolovTuri(kanal),
      kanal,
      summa: params.summa,
      transactionId: null,
    });

    const yangiTolangan = eskiTolangan + params.summa;
    // POYGA HIMOYASI: yig'indi ESKI qiymat sharti bilan yoziladi.
    const yozildi = await tx.deal.updateMany({
      where: {
        id: deal.id,
        businessId: params.businessId,
        deletedAt: null,
        tolangan: hozir.tolangan,
      },
      data: {
        tolangan: yangiTolangan,
        // "Qarzga" tanlovi saqlanadi (`tolovTuriBelgisi`), qolgani
        // qatorlardan: bitta kanal — o'sha kanal, bir nechta — "aralash".
        tolovTuri: tolovTuriBelgisi(
          (
            await tx.dealTolov.findMany({
              where: { businessId: params.businessId, dealId: deal.id },
              select: { kanal: true, summa: true },
              orderBy: { createdAt: "asc" },
            })
          ).map((m) => ({ kanal: m.kanal, summa: m.summa })),
          hozir.tolovTuri === QARZ_KANALI ? QARZ_KANALI : null
        ),
      },
    });
    if (yozildi.count !== 1) {
      throw new BadRequestError("Zakaz to'lovi ayni paytda o'zgardi — sahifani yangilang");
    }

    await tx.activity.create({
      data: {
        businessId: params.businessId,
        dealId: deal.id,
        contactId: deal.contactId,
        turi: "tizim",
        matn:
          `To'lov qabul qilindi: ${TOLOV_KANAL_NOMI[kanal]} — ${params.summa} so'm. ` +
          `Jami to'langan: ${yangiTolangan} / ${hozir.summa} so'm`,
        userId: params.userId,
      },
    });

    return { qator, kirim, tolangan: yangiTolangan, summa: hozir.summa };
  });

  // KUNLIK hisobot sinxroni tranzaksiyadan TASHQARIDA: `kunlikSinxron` o'zi
  // `runBusinessTx` ochadi, ichkarida chaqirilsa SQLite yozuv qulfida
  // deadlock bo'lardi (`lib/crm/yakunlash.ts` bilan bir xil sabab).
  const kim = await prisma.user.findFirst({ where: { id: params.userId }, select: { ism: true } });
  await kunlikSinxron(natija.kirim, kim?.ism ?? null);

  return {
    tolovId: natija.qator.id,
    transactionId: natija.kirim.id,
    tolangan: natija.tolangan,
    qoldiq: qoldiqSumma(natija.summa, natija.tolangan),
    toliqTolandi: natija.tolangan >= natija.summa,
  };
}

/**
 * ZAKAZ TO'LOVINI BEKOR QILISH — xato kiritilgan to'lovni orqaga olish.
 *
 * To'lov endi KIRIM yozuvi bilan birga tug'iladi, ya'ni uni shunchaki
 * o'chirib bo'lmaydi: pul kassada ko'rinib turadi. Shuning uchun amal ikki
 * qadamli va ATOMIK — kirim YUMSHOQ o'chiriladi (ledger append-only qoladi,
 * savatdan tiklanadi), qator esa yo'qoladi va `Deal.tolangan` qayta
 * hisoblanadi. `lib/crm/qaytarish.ts` bilan AYNI qoida.
 *
 * QARZ OCHILGAN zakazda ishlamaydi: u yerda moliya yakunlangan, tuzatish
 * "Yutildidan qaytarish" orqali boradi.
 */
export async function zakazTolovniBekorQilish(params: {
  businessId: string;
  dealId: string;
  tolovId: string;
  userId: string;
}): Promise<{ tolangan: number; qoldiq: number }> {
  const deal = await tolovgaOchiqZakaz(params.businessId, params.dealId);

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const qator = await tx.dealTolov.findFirst({
      where: { id: params.tolovId, businessId: params.businessId, dealId: deal.id },
      select: { id: true, kanal: true, summa: true, transactionId: true },
    });
    if (!qator) throw new ForbiddenError("To'lov topilmadi");

    const hozir = await tx.deal.findFirst({
      where: { id: deal.id, businessId: params.businessId, deletedAt: null },
      select: { tolangan: true, summa: true, tolovTuri: true, transactionId: true, debtId: true },
    });
    if (!hozir) throw new ForbiddenError("Zakaz topilmadi");
    if (hozir.debtId) {
      throw new BadRequestError(
        "Bu zakaz bo'yicha qarz ochilgan — tuzatish 'Yutildidan qaytarish' orqali qilinadi"
      );
    }

    // KIRIMNI YUMSHOQ O'CHIRISH — kassa qoldig'idan chiqadi, yozuv savatda
    // qoladi (`api/transactions/[id]` bilan bir xil qoida).
    let ochirilganKirim: KunlikSinxronYozuv | null = null;
    if (qator.transactionId) {
      const kirim = await tx.transaction.findFirst({
        where: { id: qator.transactionId, businessId: params.businessId, deletedAt: null },
      });
      if (kirim) {
        await tx.transaction.updateMany({
          where: { id: kirim.id, businessId: params.businessId, deletedAt: null },
          data: { deletedAt: new Date(), deletedBy: params.userId },
        });
        ochirilganKirim = kirim;
      }
    }

    await tx.dealTolov.deleteMany({
      where: { id: qator.id, businessId: params.businessId, dealId: deal.id },
    });

    const qolgan = await tx.dealTolov.findMany({
      where: { businessId: params.businessId, dealId: deal.id },
      select: { kanal: true, summa: true, transactionId: true },
      orderBy: { createdAt: "asc" },
    });
    const yangiTolangan = qolgan.reduce((s, q) => s + q.summa, 0);

    // `Deal.transactionId` shu kirimga ishora qilayotgan bo'lsa — qolgan
    // qatorlarning biriga ko'chiriladi (UNIQUE ustun bo'sh qolmasin degan
    // shart yo'q, lekin "kirim yozilganmi" savoli to'g'ri javob bersin).
    const yangiDealTx =
      hozir.transactionId && hozir.transactionId === qator.transactionId
        ? qolgan.find((q) => q.transactionId)?.transactionId ?? null
        : hozir.transactionId;

    const yozildi = await tx.deal.updateMany({
      where: {
        id: deal.id,
        businessId: params.businessId,
        deletedAt: null,
        tolangan: hozir.tolangan,
      },
      data: {
        tolangan: yangiTolangan,
        tolovTuri: tolovTuriBelgisi(
          qolgan.map((q) => ({ kanal: q.kanal, summa: q.summa })),
          hozir.tolovTuri === QARZ_KANALI ? QARZ_KANALI : null
        ),
        transactionId: yangiDealTx,
      },
    });
    if (yozildi.count !== 1) {
      throw new BadRequestError("Zakaz to'lovi ayni paytda o'zgardi — sahifani yangilang");
    }

    await tx.activity.create({
      data: {
        businessId: params.businessId,
        dealId: deal.id,
        contactId: deal.contactId,
        turi: "tizim",
        matn:
          `To'lov bekor qilindi: ${qator.kanal} — ${qator.summa} so'm. ` +
          `Jami to'langan: ${yangiTolangan} / ${hozir.summa} so'm`,
        userId: params.userId,
      },
    });

    return { ochirilganKirim, tolangan: yangiTolangan, summa: hozir.summa, qator };
  });

  if (natija.ochirilganKirim) {
    await kunlikSinxron({ ...natija.ochirilganKirim, deletedAt: new Date() }, null);
  }

  await logAudit({
    businessId: params.businessId,
    action: "delete",
    entity: "dealTolov",
    entityId: params.tolovId,
    before: { kanal: natija.qator.kanal, summa: natija.qator.summa, dealId: params.dealId },
    after: { ochirilganKirimId: natija.ochirilganKirim?.id ?? null, tolangan: natija.tolangan },
  });

  return { tolangan: natija.tolangan, qoldiq: qoldiqSumma(natija.summa, natija.tolangan) };
}
