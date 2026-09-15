import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { createTransactionTx } from "@/lib/services/transactionService";
import { shaxsiyKassaId } from "@/lib/services/kassaTanlash";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { kunlikSinxron, type KunlikSinxronYozuv } from "@/lib/services/kunlik";
import { logAudit } from "@/lib/services/audit";
import { todayTashkentDateOnlyString } from "@/lib/date";
import { kirimIzohi } from "@/lib/crm/kirim";
import { tolovHolati, type TolovHolat } from "@/lib/crm/pipeline";
import {
  TOLOV_KANAL_NOMI,
  TOLOV_SATR_LIMITI,
  kanalTolovTuri,
  tolovKanalimi,
  tolovTuriBelgisi,
  type TolovKanali,
} from "@/lib/crm/tolovlar";

/**
 * ZAKAZ TO'LOVLARI — QO'SHIMCHA LEDGER (append-only).
 *
 * ═══ HAQIQAT MANBAI ═══
 * Zakazga qilingan HAR BIR to'lov — `DealTolov` jadvalidagi ALOHIDA qator.
 * `Deal.tolangan` bu qatorlarning YIG'INDISI: u mustaqil raqam emas, balki
 * shu yerdagi har amalda AYNI tranzaksiyada qayta hisoblanadigan keshdir
 * (doska va kartochkalar uni to'g'ridan-to'g'ri o'qiydi, N+1 bo'lmasin).
 *
 *   tolangan  = Σ DealTolov.summa
 *   qoldiq    = Deal.summa − tolangan
 *
 * ═══ NEGA QO'SHISH, ALMASHTIRISH EMAS ═══
 * Ilgari to'lovni yozishning YAGONA yo'li butun ro'yxatni almashtirish edi
 * (`zakazTolovlariniAlmashtirish`): forma mavjud qatorlarni yuklab, ustiga
 * yangisini qo'shib, HAMMASINI qayta yozardi. Forma eski qatorlarni
 * yuklamay qolgan har qanday holatda (eskirgan snapshot, ikkinchi oyna,
 * qisman javob) oldingi to'lovlar JIMGINA o'chib ketardi — "50 000 naqd +
 * 250 000 click kiritdim, faqat naqd qoldi" muammosining ildizi shu.
 * Endi to'lov faqat QO'SHILADI: bitta yangi qator, boshqa qatorlarga
 * umuman tegilmaydi.
 *
 * ═══ PUL QACHON KIRIMGA TUSHADI ═══
 * TO'LOV QILINGAN PAYTDA, shu yerda. Ilgari kirim faqat "Yutildi"
 * bosilganda yozilardi: 1 000 000 lik zalog kelib tushgan bo'lsa ham u
 * kassada ko'rinmasdi. Endi har to'lov qatori O'Z kirim tranzaksiyasini
 * yozadi (naqd — naqd kassaga, click/terminal — karta/hisob kassasiga),
 * "Yutildi" esa MOLIYAVIY AMAL EMAS: u faqat holat. Dublikat bo'lmaydi,
 * chunki `lib/crm/yakunlash.ts` kirimi allaqachon bor qatorni chetlab
 * o'tadi (`DealTolov.transactionId` UNIQUE — kafolat baza darajasida).
 *
 * ═══ KIRIM SANASI ═══
 * To'lov KELGAN kun (odatda bugun), zakaz sanasi emas: kassa va kunlik
 * hisobot pul haqiqatda qachon kelganini ko'rsatishi kerak. Zakaz kelasi
 * haftaga belgilangan bo'lsa ham, bugun olingan zalog BUGUNGI kassada.
 */

/** Bitta to'lov qatori — brauzerga qaytadigan ko'rinish. */
export interface ZakazTolovSatri {
  id: string;
  /** "naqd" | "click" | "terminal" | "boshqa". */
  kanal: string;
  summa: number;
  /** To'lov qachon yozilgan (ISO). */
  createdAt: string;
  /** Shu to'lovdan yozilgan kirim tranzaksiyasi (eski qatorlarda null). */
  transactionId: string | null;
  /** Kirim yozuvining sanasi "YYYY-MM-DD" (yo'q bo'lsa null). */
  kirimSana: string | null;
}

/** Zakazning to'lov holati — UI va API uchun yagona hisob. */
export interface ZakazTolovHisobi {
  dealId: string;
  /** Zakaz summasi (so'm). */
  summa: number;
  /** To'langan jami — qatorlar yig'indisi. */
  tolangan: number;
  /** Qoldiq = summa − tolangan (manfiy bo'lmaydi). */
  qoldiq: number;
  /** Zakaz summasidan oshib ketgan to'lov (sog'lom holatda 0). */
  ortiqcha: number;
  holati: TolovHolat;
  tolovlar: ZakazTolovSatri[];
}

/** Qatorlardan `Deal.tolangan` uchun yig'indi. */
function satrlarJami(satrlar: Array<{ summa: number }>): number {
  return satrlar.reduce((s, t) => s + t.summa, 0);
}

function satrDTO(t: {
  id: string;
  kanal: string;
  summa: number;
  createdAt: Date;
  transactionId: string | null;
  transaction?: { sana: Date; deletedAt: Date | null } | null;
}): ZakazTolovSatri {
  return {
    id: t.id,
    kanal: t.kanal,
    summa: t.summa,
    createdAt: t.createdAt.toISOString(),
    transactionId: t.transactionId,
    kirimSana:
      t.transaction && !t.transaction.deletedAt
        ? t.transaction.sana.toISOString().slice(0, 10)
        : null,
  };
}

/**
 * ZAKAZNING TO'LOVLARI VA HISOBI.
 *
 * Yig'indi `Deal.tolangan` dan EMAS, qatorlarning O'ZIDAN hisoblanadi —
 * kesh bilan qatorlar ajralib qolgan bo'lsa (eski migratsiya, qo'lda
 * tuzatish) javob baribir to'g'ri chiqadi.
 */
export async function zakazTolovHisobi(
  businessId: string,
  dealId: string
): Promise<ZakazTolovHisobi> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, businessId, deletedAt: null },
    select: { id: true, summa: true, tolangan: true, tolovTuri: true },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");

  const satrlar = await prisma.dealTolov.findMany({
    where: { businessId, dealId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kanal: true,
      summa: true,
      createdAt: true,
      transactionId: true,
      transaction: { select: { sana: true, deletedAt: true } },
    },
  });

  // ORQAGA MOSLIK: qatorsiz eski zakazda pul `Deal.tolangan` da turadi —
  // hisob o'sha raqamdan chiqadi, qatorlar ro'yxati esa bo'sh qoladi.
  const tolangan = satrlar.length > 0 ? satrlarJami(satrlar) : deal.tolangan;
  return {
    dealId: deal.id,
    summa: deal.summa,
    tolangan,
    qoldiq: Math.max(0, deal.summa - tolangan),
    ortiqcha: Math.max(0, tolangan - deal.summa),
    holati: tolovHolati(deal.summa, tolangan, deal.tolovTuri),
    tolovlar: satrlar.map(satrDTO),
  };
}

/** Kategoriyasiz eski zakazlar uchun zaxira kategoriya (kirim.ts bilan bir xil). */
const ZAXIRA_KATEGORIYA = "Sotuv";

export interface TolovQoshishParams {
  businessId: string;
  dealId: string;
  /** Amalni bajarayotgan foydalanuvchi. */
  userId: string;
  kanal: string;
  summa: number;
  /** To'lov sanasi "YYYY-MM-DD" (berilmasa — bugun, Asia/Tashkent). */
  sana?: string | null;
  /** Qaysi kassaga tushdi (berilmasa — kanalga mos kassa). */
  accountId?: string | null;
}

export interface TolovQoshishNatija {
  tolovId: string;
  transactionId: string;
  /** Yangi jami to'langan (so'm). */
  tolangan: number;
  qoldiq: number;
}

/**
 * ZAKAZGA BITTA TO'LOV QO'SHISH — pul kassaga AYNI SHU PAYTDA tushadi.
 *
 * Bitta `runBusinessTx` ichida: to'lov qatori, kirim tranzaksiyasi va
 * `Deal.tolangan` keshi. Biri yozilib ikkinchisi yozilmasa CRM bir raqamni,
 * kassa boshqasini ko'rsatardi.
 *
 * ═══ POYGA HIMOYASI (bir vaqtda ikki so'rov) ═══
 * `Deal.tolangan` OLDINGI qiymati shart qilib yoziladi (`updateMany` where
 * `tolangan: eski`). Ikki so'rov bir vaqtda kelsa ikkinchisining sharti
 * bajarilmaydi — 0 qator yangilanadi va BUTUN tranzaksiya qaytariladi,
 * ya'ni ikkinchi kirim ham, ikkinchi qator ham bazaga TUSHMAYDI.
 */
export async function zakazgaTolovQoshish(
  params: TolovQoshishParams
): Promise<TolovQoshishNatija> {
  if (!tolovKanalimi(params.kanal)) throw new BadRequestError("To'lov kanali noto'g'ri");
  if (!Number.isInteger(params.summa) || params.summa <= 0) {
    throw new BadRequestError("To'lov summasi butun va noldan katta bo'lishi kerak");
  }
  const kanal: TolovKanali = params.kanal;

  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    include: {
      contact: { select: { ism: true } },
      category: { select: { id: true, turi: true } },
    },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");
  if (deal.holat === "YOQOTILDI") {
    throw new BadRequestError("Yo'qotilgan zakazga to'lov qo'shilmaydi");
  }
  // QARZGA YOPILGAN ZAKAZ: qolgan pul QARZ TO'LOVI orqali keladi
  // (`lib/services/qarz.ts`) — aks holda bir summa ham qarzda, ham zakaz
  // to'lovida turib, ikki marta sanalardi.
  if (deal.debtId) {
    throw new BadRequestError(
      "Bu zakaz qarzga yopilgan — qolgan to'lov Qarzdorlik bo'limidan qabul qilinadi"
    );
  }
  if (deal.summa <= 0) {
    throw new BadRequestError("Avval zakaz narxini kiriting — to'lovni narxsiz yozib bo'lmaydi");
  }
  if (deal.category && deal.category.turi !== "kirim") {
    throw new BadRequestError("Zakaz kategoriyasi kirim turida emas");
  }

  const izoh = kirimIzohi(deal.nomi, deal.contact?.ism);
  // TO'LOV SANASI — pul KELGAN kun (zakaz sanasi emas): kassa va kunlik
  // hisobot haqiqiy kun bo'yicha yopiladi.
  const sana = params.sana ?? todayTashkentDateOnlyString();
  const tolovTuri = kanalTolovTuri(kanal);

  // SOTUVCHI = zakaz MAS'ULI (`lib/crm/yakunlash.ts` bilan AYNI qoida):
  // kassa va xodim statistikasi zakazni olgan odamga yoziladi.
  const masul = await prisma.user.findFirst({
    where: { id: deal.masulId },
    select: { id: true },
  });
  const sotuvchiId = masul?.id ?? params.userId;

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    // Tranzaksiya ichida xom `tx` — HAR so'rovga `businessId` sharti QO'LDA.
    const joriy = await tx.deal.findFirst({
      where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
      select: { id: true, summa: true, tolangan: true, transactionId: true, contactId: true },
    });
    if (!joriy) throw new ForbiddenError("Zakaz topilmadi");

    let satrlar = await tx.dealTolov.findMany({
      where: { businessId: params.businessId, dealId: params.dealId },
      select: { id: true, summa: true },
    });

    // ═══ ESKI ZAKAZNI LEDGERGA KO'CHIRISH ═══
    // Qatorlar paydo bo'lishidan OLDIN yaratilgan zakazlarda pul faqat
    // `Deal.tolangan` da turadi (bot orqali kelgan, bir kanalli eski yozuv).
    // Bunday zakazga yangi to'lov qo'shilsa eski summa ledgerdan TUSHIB
    // QOLARDI: yig'indi qatorlardan hisoblanadi, qator esa faqat yangisi
    // bo'lardi. Shuning uchun eski summa avval O'Z qatoriga ko'chiriladi —
    // shundan keyin `Σ qatorlar === Deal.tolangan` invarianti hech qachon
    // buzilmaydi.
    //
    // Kanal — zakazning o'z `tolovTuri` si; "qarz" yoki noma'lum bo'lsa
    // "boshqa" (naqd EMAS deb qaraladi, ya'ni pul naqd kassaga jimgina
    // yozilib qolmaydi). Kirim bog'lanishi ham saqlanadi: eski zakazda
    // kirim `Deal.transactionId` da bo'lsa, u shu qatorga o'tadi va
    // yakunlashda IKKINCHI marta yozilmaydi.
    if (satrlar.length === 0 && joriy.tolangan > 0) {
      const eskiKanal = tolovKanalimi(deal.tolovTuri) ? deal.tolovTuri : "boshqa";
      const eskiKirim = joriy.transactionId
        ? await tx.transaction.findFirst({
            where: { id: joriy.transactionId, businessId: params.businessId },
            select: { id: true },
          })
        : null;
      const eskiSatr = await tx.dealTolov.create({
        data: {
          businessId: params.businessId,
          dealId: params.dealId,
          kanal: eskiKanal,
          summa: joriy.tolangan,
          transactionId: eskiKirim?.id ?? null,
        },
        select: { id: true, summa: true },
      });
      satrlar = [eskiSatr];
    }

    if (satrlar.length >= TOLOV_SATR_LIMITI) {
      throw new BadRequestError(
        `Bir zakazda ${TOLOV_SATR_LIMITI} tadan ko'p to'lov qatori bo'lmaydi`
      );
    }

    // Yig'indi endi HAR DOIM qatorlardan (yuqoridagi ko'chirishdan keyin
    // qatorsiz, lekin puli bor zakaz qolmaydi).
    const eskiTolangan = satrlarJami(satrlar);
    const yangiTolangan = eskiTolangan + params.summa;
    if (yangiTolangan > joriy.summa) {
      const qoldiq = Math.max(0, joriy.summa - eskiTolangan);
      throw new BadRequestError(
        `To'lov zakaz qoldig'idan ko'p. Qoldiq: ${qoldiq} so'm`
      );
    }

    const categoryId =
      deal.categoryId ?? (await ensureCategoryTx(tx, params.businessId, ZAXIRA_KATEGORIYA, "kirim"));
    // KASSA — kanalga mos kassa (naqd → naqd, click/terminal → karta/hisob).
    // Shaxsiy kassa rejimi yoqilgan bo'lsa naqd pul mas'ulning kassasiga.
    const accountId =
      params.accountId ?? (await shaxsiyKassaId(tx, params.businessId, sotuvchiId, tolovTuri));

    const kirim = await createTransactionTx(tx, params.userId, params.businessId, {
      turi: "kirim",
      categoryId,
      summa: params.summa,
      sana,
      izoh: `${izoh} · ${TOLOV_KANAL_NOMI[kanal]}`,
      accountId,
      tolovTuri,
      sotuvchiId,
    });

    // Qator va kirim BIR YO'LA yoziladi: `transactionId` UNIQUE bo'lgani
    // uchun bitta kirim hech qachon ikkita qatorga bog'lanmaydi.
    const satr = await tx.dealTolov.create({
      data: {
        businessId: params.businessId,
        dealId: params.dealId,
        kanal,
        summa: params.summa,
        transactionId: kirim.id,
      },
      select: { id: true },
    });

    // `Deal.tolovTuri` belgisi TO'LIQ ro'yxatdan: bitta kanal — o'sha kanal,
    // bir nechta — "aralash" (`lib/crm/tolovlar.ts`).
    const hammaSatr = await tx.dealTolov.findMany({
      where: { businessId: params.businessId, dealId: params.dealId },
      select: { kanal: true, summa: true },
    });
    const belgi = tolovTuriBelgisi(hammaSatr, null);

    // CAS: `tolangan` ning OLDINGI qiymati shart — parallel ikkinchi so'rov
    // shu yerda to'xtaydi va butun tranzaksiyasi qaytariladi.
    const yangilandi = await tx.deal.updateMany({
      where: {
        id: params.dealId,
        businessId: params.businessId,
        deletedAt: null,
        tolangan: eskiTolangan,
      },
      data: {
        tolangan: yangiTolangan,
        tolovTuri: belgi,
        // ORQAGA MOSLIK: `Deal.transactionId` — "kirim yozilganmi" degan
        // savolning eski javobi (KPI, analitika, qaytarish). BIRINCHI
        // kirimga bog'lanadi, keyingilari faqat qatorlarda turadi.
        ...(joriy.transactionId ? {} : { transactionId: kirim.id }),
      },
    });
    if (yangilandi.count !== 1) {
      throw new BadRequestError("Zakaz to'lovi ayni paytda o'zgardi — sahifani yangilang");
    }

    await tx.activity.create({
      data: {
        businessId: params.businessId,
        dealId: params.dealId,
        contactId: joriy.contactId,
        turi: "tizim",
        matn:
          `To'lov qo'shildi: ${TOLOV_KANAL_NOMI[kanal]} — ${params.summa} so'm. ` +
          `Jami to'langan: ${yangiTolangan} / ${joriy.summa} so'm`,
        userId: params.userId,
      },
    });

    return { satrId: satr.id, kirim, tolangan: yangiTolangan, summa: joriy.summa };
  });

  // KUNLIK hisobot sinxroni tranzaksiyadan TASHQARIDA: `kunlikSinxron` o'zi
  // `runBusinessTx` ochadi (lib/crm/yakunlash.ts bilan bir xil sabab).
  const kim = await prisma.user.findFirst({ where: { id: params.userId }, select: { ism: true } });
  await kunlikSinxron(natija.kirim, kim?.ism ?? null);

  return {
    tolovId: natija.satrId,
    transactionId: natija.kirim.id,
    tolangan: natija.tolangan,
    qoldiq: Math.max(0, natija.summa - natija.tolangan),
  };
}

export interface TolovOchirishParams {
  businessId: string;
  dealId: string;
  tolovId: string;
  /** Amalni bajarayotgan boshqaruvchi. */
  userId: string;
}

/**
 * XATO YOZILGAN TO'LOVNI OLIB TASHLASH — FAQAT BOSHQARUVCHI.
 *
 * To'lov ledger qatori, uning kirimi esa kassa yozuvi. Shuning uchun:
 *   - kirim YUMSHOQ o'chiriladi (`deletedAt` + `deletedBy`) — kassa
 *     qoldig'idan chiqadi, lekin savatda va auditda qoladi
 *     (`lib/crm/qaytarish.ts` bilan AYNI qoida);
 *   - to'lov qatori o'chadi va `Deal.tolangan` qayta hisoblanadi;
 *   - qarz ochilgan zakazda RAD ETILADI: avval "Yutildi"dan qaytariladi.
 */
export async function zakazTolovniOchirish(params: TolovOchirishParams): Promise<{
  tolangan: number;
  qoldiq: number;
  ochirilganKirimId: string | null;
}> {
  const natija = await runBusinessTx(params.businessId, async (tx) => {
    // Tranzaksiya ichida xom `tx` — HAR so'rovga `businessId` sharti QO'LDA.
    const deal = await tx.deal.findFirst({
      where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
      select: { id: true, summa: true, tolangan: true, transactionId: true, debtId: true, contactId: true },
    });
    if (!deal) throw new ForbiddenError("Zakaz topilmadi");
    if (deal.debtId) {
      throw new BadRequestError(
        "Bu zakazga qarz ochilgan — avval zakazni \"Yutildi\"dan qaytaring, keyin to'lovni tuzating"
      );
    }

    const satr = await tx.dealTolov.findFirst({
      where: { id: params.tolovId, businessId: params.businessId, dealId: params.dealId },
      select: { id: true, kanal: true, summa: true, transactionId: true },
    });
    if (!satr) throw new ForbiddenError("To'lov topilmadi");

    let ochirilganKirim: KunlikSinxronYozuv | null = null;
    if (satr.transactionId) {
      const kirim = await tx.transaction.findFirst({
        where: { id: satr.transactionId, businessId: params.businessId, deletedAt: null },
        select: {
          id: true,
          businessId: true,
          turi: true,
          summa: true,
          sana: true,
          izoh: true,
          userId: true,
          accountId: true,
          tolovTuri: true,
        },
      });
      if (kirim) {
        const endi = new Date();
        await tx.transaction.updateMany({
          where: { id: kirim.id, businessId: params.businessId, deletedAt: null },
          data: { deletedAt: endi, deletedBy: params.userId },
        });
        ochirilganKirim = { ...kirim, deletedAt: endi };
      }
    }

    await tx.dealTolov.deleteMany({
      where: { id: satr.id, businessId: params.businessId, dealId: params.dealId },
    });

    const qolgan = await tx.dealTolov.findMany({
      where: { businessId: params.businessId, dealId: params.dealId },
      orderBy: { createdAt: "asc" },
      select: { kanal: true, summa: true, transactionId: true },
    });
    const yangiTolangan = satrlarJami(qolgan);
    // `Deal.transactionId` shu qatorga bog'langan bo'lsa — qolganlarning
    // birinchisiga o'tadi (yo'q bo'lsa uziladi): "kirim bormi" savoli
    // haqiqatni ko'rsatib tursin.
    const yangiTxId =
      deal.transactionId && deal.transactionId === satr.transactionId
        ? qolgan.find((q) => q.transactionId)?.transactionId ?? null
        : deal.transactionId;

    await tx.deal.updateMany({
      where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
      data: {
        tolangan: yangiTolangan,
        tolovTuri: tolovTuriBelgisi(qolgan, null),
        transactionId: yangiTxId,
      },
    });

    await tx.activity.create({
      data: {
        businessId: params.businessId,
        dealId: params.dealId,
        contactId: deal.contactId,
        turi: "tizim",
        matn:
          `To'lov olib tashlandi: ${satr.kanal} — ${satr.summa} so'm` +
          (ochirilganKirim ? " (kirim yozuvi savatga o'tdi)" : "") +
          `. Jami to'langan: ${yangiTolangan} / ${deal.summa} so'm`,
        userId: params.userId,
      },
    });

    return { ochirilganKirim, tolangan: yangiTolangan, summa: deal.summa, satr };
  });

  // Kunlik hisobotdan chiqarish — tranzaksiyadan TASHQARIDA (kunlikSinxron
  // o'zi `runBusinessTx` ochadi).
  if (natija.ochirilganKirim) {
    await kunlikSinxron(natija.ochirilganKirim, null);
  }

  await logAudit({
    businessId: params.businessId,
    action: "delete",
    entity: "dealTolov",
    entityId: params.tolovId,
    before: { dealId: params.dealId, kanal: natija.satr.kanal, summa: natija.satr.summa },
    after: { ochirilganKirimId: natija.ochirilganKirim?.id ?? null, tolangan: natija.tolangan },
  });

  return {
    tolangan: natija.tolangan,
    qoldiq: Math.max(0, natija.summa - natija.tolangan),
    ochirilganKirimId: natija.ochirilganKirim?.id ?? null,
  };
}

/**
 * ZAKAZ YARATILISHIDA BERILGAN BOSHLANG'ICH TO'LOVLAR (zalog).
 *
 * `createDeal` shu yerdan o'tadi: har qator uchun kirim AYNI yaratilish
 * paytida yoziladi — zalog kassada darhol ko'rinadi. Qatorlar ketma-ket
 * yoziladi, chunki har biri O'Z kassasiga tushadi va o'z kirimiga ega.
 */
export async function boshlangichTolovlarniYoz(params: {
  businessId: string;
  dealId: string;
  userId: string;
  satrlar: Array<{ kanal: string; summa: number }>;
  /** To'lov sanasi (berilmasa — bugun). */
  sana?: string | null;
}): Promise<number> {
  let tolangan = 0;
  for (const s of params.satrlar) {
    const n = await zakazgaTolovQoshish({
      businessId: params.businessId,
      dealId: params.dealId,
      userId: params.userId,
      kanal: s.kanal,
      summa: s.summa,
      sana: params.sana,
    });
    tolangan = n.tolangan;
  }
  return tolangan;
}
