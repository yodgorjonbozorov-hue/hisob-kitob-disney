import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";
import { kunlikSinxron } from "@/lib/services/kunlik";
import { qarzHolatHisobla, qarzYopiqmi } from "@/lib/validation/qarz";
import { todayDateOnlyString } from "@/lib/date";
import {
  pulHarakatiYozTx,
  type PulHarakatiNatija,
  type PulHarakatiParams,
} from "@/lib/services/pulOqimi";

/**
 * PUL HARAKATINI TUZATISH VA BEKOR QILISH (11 va 12-talab).
 *
 * IKKI QOIDA, ular buzilsa hisob yolg'on ko'rsatadi:
 *
 * 1. LEDGER O'CHIRILMAYDI. Yozuv `deletedAt` bilan belgilanadi
 *    (`/app/admin/ochirilganlar` da ko'rinadi va tiklanadi). Kassa qoldig'i
 *    saqlanadigan ustun EMAS — u ledgerdan hisoblanadi
 *    (`lib/queries/accounts.ts`), shuning uchun yozuv o'chirilishi yoki
 *    summasi o'zgarishi qoldiqni O'ZI to'g'rilaydi: alohida "correction"
 *    yozuvi kerak emas va u qo'shilsa pul ikki marta harakatlangan bo'lardi.
 *
 * 2. QARZ QAYTARILADI. Bekor qilinayotgan amal qarz to'lovi bo'lgan bo'lsa,
 *    `DebtPayment` o'chiriladi va `Debt.tolangan` o'sha summaga qaytariladi —
 *    holat (`status`, `isYopilgan`) mavjud `qarzHolatHisobla` bilan qayta
 *    hisoblanadi, ya'ni yopilgan qarz yana ochiladi.
 *
 * TUZATISH esa bekor qilish + qayta yozishdan iborat va IKKALASI BITTA
 * tranzaksiyada bo'ladi. Nega shunday: summa o'zgarsa qarz taqsimoti ham
 * o'zgaradi (1,2 mln uchta qarzni yopgan edi, 800 mingda ikkitasini yopadi)
 * — mavjud yozuvlarni "joyida" tahrirlash uchun taqsimotni qayta hisoblovchi
 * ikkinchi mantiq kerak bo'lardi va u FIFO qoidasidan (lib/services/qarz.ts)
 * ajralib ketardi.
 */

export interface BekorNatija {
  /** Nechta tranzaksiya belgilandi. */
  yozuvSoni: number;
  /** Nechta qarz to'lovi qaytarildi. */
  qarzTolovSoni: number;
  /** Qarzga qaytarilgan jami summa (so'm). */
  qarzgaQaytdi: number;
}

/** Bekor qilinayotgan amalning bir tranzaksiyasi — kunlik sinxron uchun. */
type BekorYozuvi = Awaited<ReturnType<typeof prisma.transaction.findMany>>[number];

/**
 * AMALNI BEKOR QILISH — tranzaksiya ichidagi qism.
 * Chaqiruvchi `runBusinessTx` ni o'zi ochadi (tuzatish oqimi bekor qilish va
 * qayta yozishni bitta tranzaksiyada bajaradi).
 */
export async function pulHarakatiBekorTx(
  tx: BusinessTx,
  businessId: string,
  userId: string,
  amalId: string
): Promise<{ natija: BekorNatija; yozuvlar: BekorYozuvi[] }> {
  const yozuvlar = (await tx.transaction.findMany({
    where: { businessId, amalId, deletedAt: null },
  })) as BekorYozuvi[];

  // Qarz to'lovlari AMAL KALITI bo'yicha topiladi: moliya oqimi to'lovni
  // `qarzdorTolovTx` ga aynan shu kalit bilan yozadi (lib/services/pulOqimi.ts).
  const tolovlar = await tx.debtPayment.findMany({
    where: { businessId, idempotencyKey: amalId },
    select: { id: true, debtId: true, summa: true, transactionId: true },
  });

  if (yozuvlar.length === 0 && tolovlar.length === 0) {
    throw new BadRequestError("Bu amal topilmadi yoki allaqachon bekor qilingan");
  }

  // PRO: ichki ta'minotchi-user'ga qilingan to'lov chiqim emas, kassalar aro
  // O'TKAZMA yozadi (lib/services/qarz.ts). Uni bu yerdan bekor qilib
  // bo'lmaydi — o'tkazma o'zining storno oqimiga ega (Kassa bo'limi).
  if (tolovlar.some((t) => !t.transactionId)) {
    throw new BadRequestError(
      "Bu to'lov kassalar aro o'tkazma bilan yozilgan — uni Kassa bo'limidan bekor qiling"
    );
  }

  // TEGISHLILIK TEKSHIRUVI. Kalit klientdan keladi, shuning uchun "shu kalit
  // bilan yozilgan har qanday to'lov" ga ishonib bo'lmaydi: topilgan har bir
  // to'lov AYNAN shu amalning tranzaksiyasiga bog'langan bo'lishi shart.
  // Aks holda ataylab tanlangan kalit bilan begona qarz to'lovini bekor
  // qilish yo'li ochilardi.
  const amalYozuvlari = new Set(yozuvlar.map((y) => y.id));
  if (tolovlar.some((t) => !amalYozuvlari.has(t.transactionId as string))) {
    throw new BadRequestError("Amal yozuvlari mos kelmadi — qo'llab-quvvatlashga murojaat qiling");
  }

  let qarzgaQaytdi = 0;
  // Bir amal bitta qarzga ikki bo'lak yozmaydi, lekin jamlash himoya sifatida
  // qoladi: qoldiq har qarz uchun BIR marta qaytarilishi kerak.
  const qarzBoyicha = new Map<string, number>();
  for (const t of tolovlar) {
    qarzBoyicha.set(t.debtId, (qarzBoyicha.get(t.debtId) ?? 0) + t.summa);
  }

  for (const [debtId, summa] of qarzBoyicha) {
    const debt = await tx.debt.findFirst({
      where: { id: debtId, businessId },
      select: { id: true, jamiSumma: true, tolangan: true, status: true },
    });
    if (!debt) throw new ForbiddenError("Qarz topilmadi");
    const yangiTolangan = debt.tolangan - summa;
    if (yangiTolangan < 0) {
      throw new BadRequestError("Qarz qoldig'i mos kelmadi — sahifani yangilang");
    }
    const bekorMi = debt.status === "CANCELLED";
    const status = qarzHolatHisobla(debt.jamiSumma, yangiTolangan, bekorMi);
    // Optimistik qulf: `tolangan` biz o'qigan qiymatda qolgan bo'lsagina
    // yoziladi — parallel to'lov jimgina yo'qolmaydi.
    const upd = await tx.debt.updateMany({
      where: { id: debt.id, businessId, tolangan: debt.tolangan },
      data: {
        tolangan: yangiTolangan,
        status,
        isYopilgan: qarzYopiqmi(status),
        updatedBy: userId,
      },
    });
    if (upd.count === 0) {
      throw new BadRequestError("Qarz holati o'zgardi — sahifani yangilab qayta urinib ko'ring");
    }
    qarzgaQaytdi += summa;
  }

  if (tolovlar.length > 0) {
    await tx.debtPayment.deleteMany({
      where: { businessId, id: { in: tolovlar.map((t) => t.id) } },
    });
  }

  if (yozuvlar.length > 0) {
    await tx.transaction.updateMany({
      where: { businessId, id: { in: yozuvlar.map((y) => y.id) }, deletedAt: null },
      data: {
        deletedAt: new Date(),
        // Kalit bo'shatiladi: bekor qilingan amal endi mavjud emas, uning
        // kaliti yangi yozuvni to'sib turmasligi kerak (UNIQUE cheklov).
        idempotencyKey: null,
      },
    });
  }

  return {
    natija: {
      yozuvSoni: yozuvlar.length,
      qarzTolovSoni: tolovlar.length,
      qarzgaQaytdi,
    },
    yozuvlar,
  };
}

/** Kunlik hisobot bilan sinxron — o'chirilgan yozuv kunlikdan ham chiqadi. */
async function kunlikdanChiqar(yozuvlar: BekorYozuvi[]): Promise<void> {
  for (const y of yozuvlar) {
    await kunlikSinxron({ ...y, deletedAt: new Date() }, null);
  }
}

/**
 * AMALNI BEKOR QILISH (noto'g'ri kiritilgan pul harakati).
 * Yozuv o'chirilmaydi — belgilanadi; qarz qaytariladi; audit yoziladi.
 */
export async function pulHarakatiBekor(params: {
  businessId: string;
  userId: string;
  amalId: string;
  sabab?: string | null;
}): Promise<BekorNatija> {
  const { natija, yozuvlar } = await runBusinessTx(params.businessId, (tx) =>
    pulHarakatiBekorTx(tx, params.businessId, params.userId, params.amalId)
  );

  await kunlikdanChiqar(yozuvlar);
  await logAudit({
    businessId: params.businessId,
    action: "delete",
    entity: "transaction",
    entityId: yozuvlar[0]?.id ?? params.amalId,
    before: {
      amalId: params.amalId,
      yozuvlar: yozuvlar.map((y) => ({ id: y.id, turi: y.turi, summa: y.summa })),
    },
    after: { bekor: true, sabab: params.sabab?.trim() || null, ...natija },
  });
  return natija;
}

export interface TahrirParams extends Omit<PulHarakatiParams, "amalId"> {
  /** Tuzatilayotgan amalning kaliti. */
  amalId: string;
  sabab?: string | null;
}

/**
 * AMALNI TUZATISH — eskisi bekor qilinadi, yangisi AYNI tranzaksiyada
 * yoziladi. Natijada kassa va qarz ikkalasi ham yangi qiymatga to'g'rilanadi.
 *
 * Yangi amal YANGI kalit oladi: eski (bekor qilingan) yozuvlar bazada
 * qoladi, shuning uchun kalit qayta ishlatilsa audit izi chalkashardi.
 */
export async function pulHarakatiTahrirla(params: TahrirParams): Promise<PulHarakatiNatija> {
  if (!Number.isInteger(params.summa) || params.summa <= 0) {
    throw new BadRequestError("Summa butun va noldan katta bo'lishi kerak");
  }
  const sana = params.sana ?? todayDateOnlyString();
  const yangiAmalId = randomUUID();

  const { natija, eski, bekor } = await runBusinessTx(params.businessId, async (tx) => {
    const b = await pulHarakatiBekorTx(tx, params.businessId, params.userId, params.amalId);
    const n = await pulHarakatiYozTx(
      tx,
      { ...params, amalId: yangiAmalId, sana },
      sana
    );
    return { natija: n, eski: b.yozuvlar, bekor: b.natija };
  });

  await kunlikdanChiqar(eski);
  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "transaction",
    entityId: natija.transactionIds[0] ?? yangiAmalId,
    before: {
      amalId: params.amalId,
      yozuvlar: eski.map((y) => ({
        id: y.id,
        turi: y.turi,
        summa: y.summa,
        categoryId: y.categoryId,
        accountId: y.accountId,
        sana: y.sana,
        shaxsIsm: y.shaxsIsm,
      })),
      qarzgaQaytdi: bekor.qarzgaQaytdi,
    },
    after: {
      amalId: yangiAmalId,
      yonalish: params.yonalish,
      summa: params.summa,
      sana,
      usul: params.usul,
      accountId: natija.accountId,
      shaxsTuri: params.shaxsTuri,
      shaxsId: params.shaxsId ?? null,
      qarz: natija.qarz,
      sabab: params.sabab?.trim() || null,
    },
  });
  return natija;
}
