import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { currentTenantId } from "@/lib/db/tenantContext";
import { createTransactionTx } from "@/lib/services/transactionService";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { shaxsiyKassaId } from "@/lib/services/kassaTanlash";
import { qarzdorTolovTx, qarzdorOchiqQarzlariTx } from "@/lib/services/qarz";
import { logAudit } from "@/lib/services/audit";
import { todayDateOnlyString } from "@/lib/date";
import { qarzdorKalit } from "@/lib/queries/qarz";
import { sababTop } from "@/lib/moliya/sabablar";
import {
  kartochkaliMi,
  qarzYonalishi,
  type ShaxsTuri,
} from "@/lib/moliya/shaxs";
import {
  usulKassaTurlari,
  usulQarzTolovi,
  usulTolovTuri,
  type PulUsuli,
} from "@/lib/moliya/usul";

/**
 * "PUL OLDIM / PUL BERDIM" — moliya bo'limining yagona yozish yo'li.
 *
 * BU YANGI MOLIYA TIZIMI EMAS. Pul harakati baribir mavjud modellarga
 * tushadi va mavjud xizmatlar bilan yoziladi:
 *   pul harakati   → `Transaction` (`createTransactionTx`),
 *   kassa qoldig'i → ledgerdan hisoblanadi (`lib/queries/accounts.ts`) —
 *                    saqlanadigan "balans" ustuni YO'Q, shuning uchun
 *                    yozuv qo'shilishi qoldiqni O'ZI to'g'rilaydi,
 *   qarz           → `Debt` + `DebtPayment` (`qarzdorTolovTx`),
 *   sabab          → `Category` (`lib/moliya/sabablar.ts`).
 *
 * Bu qatlam faqat ULARNI BIRLASHTIRADI: bitta forma, bitta atomik amal
 * (`runBusinessTx`) va bitta `amalId` — keyin shu amalni butunligicha
 * tuzatish yoki bekor qilish mumkin (`lib/services/pulOqimiTuzatish.ts`).
 */

export interface PulHarakatiParams {
  businessId: string;
  userId: string;
  /** "kirim" — pul oldim; "chiqim" — pul berdim. */
  yonalish: "kirim" | "chiqim";
  shaxsTuri: ShaxsTuri;
  /** Kartochkali tomonda IDsi (Contact / Supplier / User). */
  shaxsId?: string | null;
  /** Kartochkasiz tomonda qo'lda yozilgan nom. */
  shaxsIsm?: string | null;
  /** Tayyor sabab kodi (`lib/moliya/sabablar.ts`). */
  sababKod?: string | null;
  /** Yoki mavjud kategoriya — direktor o'zi qo'shgan kategoriyalar shu yo'ldan. */
  categoryId?: string | null;
  summa: number;
  /** "YYYY-MM-DD". Berilmasa — bugun. */
  sana?: string | null;
  usul: PulUsuli;
  accountId?: string | null;
  izoh?: string | null;
  /**
   * AMAL KALITI — klient har bosish OQIMI uchun bitta kalit yaratadi va uni
   * qayta yuborishda O'ZGARTIRMAYDI. Ikkinchi so'rov yangi yozuv yaratmaydi
   * (16-talab: double submit protection).
   */
  amalId: string;
}

export interface PulHarakatiNatija {
  amalId: string;
  /** `false` — takror bosish: yangi yozuv yozilmadi, mavjudi qaytarildi. */
  yangi: boolean;
  transactionIds: string[];
  accountId: string | null;
  summa: number;
  yonalish: "kirim" | "chiqim";
  /** Qarzga bog'langan bo'lsa — to'lovdan oldingi va keyingi qoldiq. */
  qarz: { oldin: number; keyin: number; yopilganSoni: number } | null;
}

/** Tomon (shaxs) — tekshirilgan ID va SNAPSHOT nom. */
interface Tomon {
  turi: ShaxsTuri;
  id: string | null;
  ism: string;
}

/**
 * TOMONNI TEKSHIRISH VA NOMNI SNAPSHOT QILISH.
 *
 * Nom klientdan KELGANIGA ishonilmaydi: kartochkali tomonda u bazadan
 * o'qiladi. Aks holda "Aziz" deb yuborilgan yozuv aslida boshqa mijozning
 * kartochkasiga bog'lanib qolishi mumkin edi.
 *
 * Tranzaksiya ichida xom `tx` ishlatilgani uchun `businessId` sharti QO'LDA
 * yoziladi (lib/db/businessTx.ts).
 */
async function tomonniAniqlaTx(
  tx: BusinessTx,
  businessId: string,
  params: PulHarakatiParams
): Promise<Tomon> {
  const turi = params.shaxsTuri;
  const qolIsm = params.shaxsIsm?.trim() ?? "";

  if (!kartochkaliMi(turi)) {
    if (!qolIsm) throw new BadRequestError("Kimdan/kimga ekanini yozing");
    return { turi, id: null, ism: qolIsm };
  }

  // Kartochkali tomonda ham ID majburiy EMAS: kassir ro'yxatda yo'q odamni
  // ism bilan yozishi mumkin (qarzlar ism bo'yicha jamlanadi — qarzdorKalit).
  if (!params.shaxsId) {
    if (!qolIsm) throw new BadRequestError("Kimdan/kimga ekanini tanlang yoki yozing");
    return { turi, id: null, ism: qolIsm };
  }

  if (turi === "mijoz") {
    const c = await tx.contact.findFirst({
      where: { id: params.shaxsId, businessId, deletedAt: null },
      select: { id: true, ism: true },
    });
    if (!c) throw new ForbiddenError("Mijoz bu biznesga tegishli emas");
    return { turi, id: c.id, ism: c.ism };
  }
  if (turi === "taminotchi") {
    const sup = await tx.supplier.findFirst({
      where: { id: params.shaxsId, businessId, deletedAt: null },
      select: { id: true, nomi: true },
    });
    if (!sup) throw new ForbiddenError("Ta'minotchi bu biznesga tegishli emas");
    return { turi, id: sup.id, ism: sup.nomi };
  }
  // Xodim: tenant chegarasi qo'lda (tranzaksiya ichida tenant kengaytmasi yo'q).
  const u = await tx.user.findFirst({
    where: { id: params.shaxsId, tenantId: currentTenantId(), isActive: true },
    select: { id: true, ism: true },
  });
  if (!u) throw new ForbiddenError("Xodim topilmadi");
  return { turi, id: u.id, ism: u.ism };
}

/**
 * KASSANI ANIQLASH — usulga MOS kassa.
 *
 * Tanlangani tekshiriladi; tanlanmagan bo'lsa usulga mos birinchi faol
 * kassa (`lib/moliya/usul.ts`), u ham bo'lmasa birinchi faol kassa —
 * `resolveAccountId` bilan AYNI qoida, shunda moliya oqimi boshqa yo'llardan
 * boshqacha ishlab qolmaydi.
 */
async function moliyaKassaTx(
  tx: BusinessTx,
  businessId: string,
  usul: PulUsuli,
  accountId: string | null | undefined,
  userId: string
): Promise<string | null> {
  if (accountId) {
    const acc = await tx.account.findFirst({
      where: { id: accountId, businessId, isActive: true },
      select: { id: true },
    });
    if (!acc) throw new ForbiddenError("Kassa topilmadi yoki nofaol");
    return acc.id;
  }
  const shaxsiy = await shaxsiyKassaId(tx, businessId, userId, usulTolovTuri(usul));
  if (shaxsiy) return shaxsiy;

  for (const turi of usulKassaTurlari(usul)) {
    const mos = await tx.account.findFirst({
      where: { businessId, isActive: true, turi },
      orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (mos) return mos.id;
  }
  const birinchi = await tx.account.findFirst({
    where: { businessId, isActive: true },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return birinchi?.id ?? null;
}

/**
 * SABAB → KATEGORIYA va "qarzga bog'lanadimi".
 *
 * Kategoriya ANIQ berilgan bo'lsa (direktor o'zi qo'shgan kategoriya) — u
 * tekshiriladi va qarzga bog'lanmaydi: bunday kategoriyaning qarz semantikasi
 * yo'q, uni o'ylab topish hisobni yolg'onga aylantirardi.
 */
async function sababniHalQilTx(
  tx: BusinessTx,
  businessId: string,
  params: PulHarakatiParams
): Promise<{ categoryId: string; qarzBogla: boolean; nomi: string | null }> {
  if (params.categoryId) {
    const cat = await tx.category.findFirst({
      where: { id: params.categoryId, businessId, turi: params.yonalish, isActive: true },
      select: { id: true, nomi: true },
    });
    if (!cat) throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
    return { categoryId: cat.id, qarzBogla: false, nomi: cat.nomi };
  }

  const sabab = params.sababKod ? sababTop(params.yonalish, params.sababKod) : null;
  if (!sabab) throw new BadRequestError("Sababni tanlang");
  const categoryId = await ensureCategoryTx(tx, businessId, sabab.nomi, params.yonalish);
  return { categoryId, qarzBogla: sabab.qarz, nomi: sabab.nomi };
}

/** Shu amal allaqachon yozilganmi (takror bosish). */
async function mavjudAmalTx(
  tx: BusinessTx,
  businessId: string,
  amalId: string,
  yonalish: "kirim" | "chiqim"
): Promise<PulHarakatiNatija | null> {
  const rows = await tx.transaction.findMany({
    where: { businessId, amalId, deletedAt: null },
    select: { id: true, summa: true, accountId: true },
  });
  if (rows.length === 0) return null;
  return {
    amalId,
    yangi: false,
    transactionIds: rows.map((r) => r.id),
    accountId: rows[0].accountId,
    summa: rows.reduce((a, r) => a + r.summa, 0),
    yonalish,
    qarz: null,
  };
}

/**
 * PUL HARAKATINI YOZISH — kassa, qarz va tranzaksiya BITTA atomik amalda.
 *
 * Qarzga bog'langan sababda (masalan "Mijoz qarzini to'ladi") to'lov mavjud
 * `qarzdorTolovTx` orqali ketadi: u eng eski ochiq qarzdan boshlab
 * taqsimlaydi, har qarz uchun ALOHIDA kirim/chiqim yozadi (kategoriya
 * kesimi saqlansin) va qoldiqni yangilaydi. Qisman to'lov shu yo'lda
 * o'z-o'zidan ishlaydi (8-talab).
 */
export async function pulHarakatiYoz(params: PulHarakatiParams): Promise<PulHarakatiNatija> {
  if (!Number.isInteger(params.summa) || params.summa <= 0) {
    throw new BadRequestError("Summa butun va noldan katta bo'lishi kerak");
  }
  if (!params.amalId.trim()) throw new BadRequestError("Amal kaliti yo'q");
  const sana = params.sana ?? todayDateOnlyString();

  let natija: PulHarakatiNatija;
  try {
    natija = await runBusinessTx(params.businessId, (tx) => pulHarakatiYozTx(tx, params, sana));
  } catch (e) {
    // TAKROR BOSISH POYGASI: ikki so'rov bir vaqtda o'tsa ikkinchisi baza
    // cheklovi (UNIQUE) ga uriladi. Bu xato emas — birinchisi yozib bo'lgan.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const bor = await runBusinessTx(params.businessId, (tx) =>
        mavjudAmalTx(tx, params.businessId, params.amalId, params.yonalish)
      );
      if (bor) return bor;
    }
    throw e;
  }

  if (natija.yangi) {
    await logAudit({
      businessId: params.businessId,
      action: "create",
      entity: "transaction",
      entityId: natija.transactionIds[0] ?? params.amalId,
      after: {
        amalId: params.amalId,
        yonalish: params.yonalish,
        shaxsTuri: params.shaxsTuri,
        shaxsId: params.shaxsId ?? null,
        summa: params.summa,
        sana,
        usul: params.usul,
        accountId: natija.accountId,
        qarz: natija.qarz,
        transactionIds: natija.transactionIds,
      },
    });
  }
  return natija;
}

/**
 * Yozishning TRANZAKSIYA ICHIDAGI qismi. Tuzatish oqimi (bekor qilish +
 * qayta yozish) ham shu funksiyani chaqiradi — ikkalasi BITTA tranzaksiyada
 * bo'lishi shart, aks holda bekor qilinib qayta yozilmagan pul yo'qolardi.
 */
export async function pulHarakatiYozTx(
  tx: BusinessTx,
  params: PulHarakatiParams,
  sana: string
): Promise<PulHarakatiNatija> {
  const bor = await mavjudAmalTx(tx, params.businessId, params.amalId, params.yonalish);
  if (bor) return bor;

  const tomon = await tomonniAniqlaTx(tx, params.businessId, params);
  const sabab = await sababniHalQilTx(tx, params.businessId, params);
  const accountId = await moliyaKassaTx(
    tx,
    params.businessId,
    params.usul,
    params.accountId,
    params.userId
  );

  const shaxsMaydonlari = {
    shaxsTuri: tomon.turi,
    shaxsId: tomon.id,
    shaxsIsm: tomon.ism,
    pulUsuli: params.usul,
  };

  if (sabab.qarzBogla) {
    return qarzgaYozTx(tx, params, sana, tomon, accountId, shaxsMaydonlari);
  }

  const txn = await createTransactionTx(tx, params.userId, params.businessId, {
    turi: params.yonalish,
    categoryId: sabab.categoryId,
    accountId,
    tolovTuri: usulTolovTuri(params.usul),
    summa: params.summa,
    sana,
    izoh: params.izoh?.trim() || `${sabab.nomi ?? ""}: ${tomon.ism}`.trim(),
    ...shaxsMaydonlari,
    amalId: params.amalId,
    // BITTA yozuv — shuning uchun baza darajasidagi UNIQUE himoya shu yerda
    // ishlaydi (qarz yo'lida u `DebtPayment` cheklovida turadi).
    idempotencyKey: params.amalId,
  });

  return {
    amalId: params.amalId,
    yangi: true,
    transactionIds: [txn.id],
    accountId,
    summa: params.summa,
    yonalish: params.yonalish,
    qarz: null,
  };
}

/** Qarzga bog'langan yo'l — mavjud `qarzdorTolovTx` ustiga qurilgan. */
async function qarzgaYozTx(
  tx: BusinessTx,
  params: PulHarakatiParams,
  sana: string,
  tomon: Tomon,
  accountId: string | null,
  shaxsMaydonlari: {
    shaxsTuri: string;
    shaxsId: string | null;
    shaxsIsm: string;
    pulUsuli: string;
  },
): Promise<PulHarakatiNatija> {
  const qarzTuri = qarzYonalishi(tomon.turi, params.yonalish);
  // Ta'minotchi va xodim qarzlari kartochkaga bog'lanmagan (`Debt.contactId`
  // faqat mijozda to'ladi), shuning uchun ular ISM bo'yicha jamlanadi —
  // `qarzdorKalit` bilan AYNI qoida.
  const kalit =
    tomon.turi === "mijoz" && tomon.id
      ? qarzdorKalit(tomon.id, tomon.ism)
      : qarzdorKalit(null, tomon.ism);

  const ochiq = await qarzdorOchiqQarzlariTx(tx, params.businessId, qarzTuri, kalit);
  const oldin = ochiq.reduce((a, d) => a + (d.jamiSumma - d.tolangan), 0);
  if (oldin <= 0) {
    throw new BadRequestError(
      `${tomon.ism} bo'yicha ochiq qarz yo'q — sababni "qarz" bo'lmagan variantga o'zgartiring`
    );
  }

  const tolov = await qarzdorTolovTx(
    tx,
    {
      businessId: params.businessId,
      userId: params.userId,
      turi: qarzTuri,
      kalit,
      summa: params.summa,
      sana,
      tolovTuri: usulQarzTolovi(params.usul),
      accountId,
      izoh: params.izoh?.trim() || null,
      // Qarz yo'lidagi takror bosish himoyasi — `DebtPayment` ning UNIQUE
      // cheklovi (debtId + kalit). Kalit amal kaliti bilan AYNI, shuning
      // uchun bekor qilishda to'lovlar shu kalit bo'yicha topiladi.
      idempotencyKey: params.amalId,
    },
    sana
  );

  const ids = tolov.bolaklar.map((b) => b.transactionId).filter((id): id is string => Boolean(id));
  if (ids.length > 0) {
    // Tomon va amal kaliti yozuvlarga shu yerda qo'yiladi: `bittaQarzgaTolovTx`
    // umumiy qarz yo'li (u qarz sahifasidan ham chaqiriladi) va uni moliya
    // oqimining maydonlari bilan yuklab qo'ymaslik kerak.
    await tx.transaction.updateMany({
      where: { id: { in: ids }, businessId: params.businessId },
      data: { ...shaxsMaydonlari, amalId: params.amalId },
    });
  }

  return {
    amalId: params.amalId,
    yangi: tolov.yangiTolov,
    transactionIds: ids,
    accountId,
    summa: tolov.summa,
    yonalish: params.yonalish,
    qarz: { oldin, keyin: oldin - tolov.summa, yopilganSoni: tolov.yopilganSoni },
  };
}

/**
 * SHU TOMONNING JORIY QARZI — formada "To'lovdan keyin" ni ko'rsatish uchun
 * (10-talab). Yozuvsiz, faqat o'qish.
 */
export async function shaxsQarzi(
  businessId: string,
  turi: "olinadigan" | "beriladigan",
  kalit: string
): Promise<{ qarz: number; soni: number }> {
  const contactId = kalit.startsWith("contact:") ? kalit.slice("contact:".length) : null;
  const ismKalit = kalit.startsWith("ism:") ? kalit.slice("ism:".length) : null;
  if (!contactId && !ismKalit) return { qarz: 0, soni: 0 };

  const hammasi = await prisma.debt.findMany({
    where: {
      businessId,
      turi,
      isYopilgan: false,
      ...(contactId ? { contactId } : { contactId: null }),
    },
    select: { mijozNomi: true, jamiSumma: true, tolangan: true, status: true },
  });
  const qatorlar = (ismKalit
    ? hammasi.filter((d) => d.mijozNomi.trim().toLowerCase() === ismKalit)
    : hammasi
  ).filter((d) => d.status !== "CANCELLED" && d.jamiSumma - d.tolangan > 0);

  return {
    qarz: qatorlar.reduce((a, d) => a + (d.jamiSumma - d.tolangan), 0),
    soni: qatorlar.length,
  };
}
