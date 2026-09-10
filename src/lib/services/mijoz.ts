import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";
import { formatSom } from "@/lib/format";
import { telAjrat } from "@/lib/tel";
import { mijozTelBoyichaTopTx, type MijozQisqa } from "@/lib/services/mijozAniqla";
import type { CreateMijozInput, UpdateMijozInput } from "@/lib/validation/mijoz";

/**
 * MIJOZ DUBLIKATI — 409 ziddiyat.
 *
 * Javob tanasida `mavjud` maydoni bilan chiqadi (id, ism, tel), shuning
 * uchun UI operatorni to'g'ridan-to'g'ri mavjud kartochkaga yo'naltira
 * oladi: "Bu mijoz mavjud" xabari o'zi yetarli emas — qaysi kartochka
 * ekani ko'rinmasa operator baribir yangisini ochishga urinadi.
 */
export class MijozDublikatError extends ConflictError {
  constructor(xabar: string, mavjud: MijozQisqa) {
    super(xabar, "MIJOZ_DUBLIKAT", { mavjud });
    this.name = "MijozDublikatError";
  }
}

/**
 * YANGI MIJOZ KARTOCHKASI.
 *
 * DUBLIKAT HIMOYASI SHU YERDA. Ilgari bu funksiya to'g'ridan-to'g'ri
 * `contact.create()` chaqirardi va shu sabab qarz oynasidagi
 * (`mijozniAniqlaTx`) himoyani CHETLAB O'TARDI: Mijozlar sahifasidan
 * kiritilgan raqam xom ko'rinishda saqlanar, keyin ayni odam qarz
 * oynasidan yana bir marta kiritilganda tizim uni topolmay ikkinchi
 * kartochka ochardi. Bir mijoz — ikki qarzdor kartasi.
 *
 * Endi:
 *   · telefon `lib/tel.ts` orqali YAGONA formatga keltiriladi
 *     (`+998913320008`) — bazaga faqat shu ko'rinish tushadi;
 *   · yaratishdan OLDIN `businessId + normal telefon + deletedAt:null`
 *     bo'yicha mavjud kartochka qidiriladi;
 *   · topilsa YANGISI YARATILMAYDI — `MijozDublikatError` (409).
 *
 * Tekshiruv va yozuv bitta tranzaksiyada: ikki so'rov bir vaqtda kelsa
 * ikkalasi ham "yo'q ekan" degan qarorga kelib ikki kartochka ochib
 * yuborardi.
 *
 * ISM bo'yicha birlashtirish ATAYLAB YO'Q: bir xil ismli ikki odam —
 * odatiy hol, asosiy identifikator telefon raqami.
 */
export async function createMijoz(businessId: string, userId: string, data: CreateMijozInput) {
  const { saqlash: tel } = telAjrat(data.tel);

  return runBusinessTx(businessId, async (tx) => {
    const mavjud = await mijozTelBoyichaTopTx(tx, businessId, tel);
    if (mavjud) throw new MijozDublikatError("Bu mijoz mavjud", mavjud);

    return tx.contact.create({
      data: {
        businessId,
        ism: data.ism,
        tel: tel ?? undefined,
        telegram: data.telegram?.trim() || undefined,
        manzil: data.manzil?.trim() || undefined,
        masulShaxs: data.masulShaxs?.trim() || undefined,
        izoh: data.izoh?.trim() || undefined,
        qarzLimit: data.qarzLimit ?? null,
        createdBy: userId,
      },
    });
  });
}

/**
 * MIJOZNI TAHRIRLASH.
 *
 * Telefon bu yerda ham normallashtiriladi va BOSHQA kartochkaniki bo'lsa
 * bloklanadi — aks holda dublikat "yaratish" yo'lidan emas, "tahrirlash"
 * yo'lidan kirib kelardi: direktor ikkinchi kartochkaga birinchisining
 * raqamini yozib qo'yishi bilan bir raqamda ikki mijoz paydo bo'lardi.
 */
export async function updateMijoz(businessId: string, id: string, data: UpdateMijozInput) {
  const tel = data.tel !== undefined ? telAjrat(data.tel).saqlash : undefined;

  return runBusinessTx(businessId, async (tx) => {
    const mavjud = await tx.contact.findFirst({
      where: { id, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!mavjud) throw new ForbiddenError("Mijoz topilmadi");

    if (tel) {
      // Mijozning O'ZI natijaga tushmasligi kerak — o'z raqamini qayta
      // saqlash dublikat emas.
      const band = await mijozTelBoyichaTopTx(tx, businessId, tel, id);
      if (band) throw new MijozDublikatError("Bu telefon raqamli mijoz mavjud", band);
    }

    return tx.contact.update({
      where: { id },
      data: {
        ...(data.ism ? { ism: data.ism } : {}),
        ...(tel !== undefined ? { tel } : {}),
        ...(data.telegram !== undefined ? { telegram: data.telegram?.trim() || null } : {}),
        ...(data.manzil !== undefined ? { manzil: data.manzil?.trim() || null } : {}),
        ...(data.masulShaxs !== undefined ? { masulShaxs: data.masulShaxs?.trim() || null } : {}),
        ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
        ...(data.qarzLimit !== undefined ? { qarzLimit: data.qarzLimit } : {}),
      },
    });
  });
}

/**
 * Mijozni o'chirish — yumshoq. Sotuv va qarz tarixi `contactId` orqali
 * bog'langan; qattiq o'chirish "bu qarz kimniki edi?" degan savolni
 * javobsiz qoldirardi.
 */
export async function deleteMijoz(businessId: string, id: string) {
  const mavjud = await prisma.contact.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Mijoz topilmadi");

  const ochiqQarz = await prisma.debt.aggregate({
    where: { businessId, contactId: id, isYopilgan: false, turi: "olinadigan" },
    _sum: { jamiSumma: true, tolangan: true },
  });
  const qoldiq = (ochiqQarz._sum.jamiSumma ?? 0) - (ochiqQarz._sum.tolangan ?? 0);
  if (qoldiq > 0) {
    throw new BadRequestError(
      `Bu mijozda ${formatSom(qoldiq)} so'm yopilmagan qarz bor — avval hisob-kitobni yakunlang`
    );
  }

  await prisma.contact.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ businessId, action: "delete", entity: "contact", entityId: id });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Qarz limiti
// ---------------------------------------------------------------------------

export interface QarzHolati {
  limit: number | null;
  /** Yopilmagan "olinadigan" qarzlar qoldig'i. */
  ochiqQarz: number;
  /** Limitgacha qolgan bo'sh joy; limit yo'q bo'lsa null. */
  qolgan: number | null;
}

export async function mijozQarzHolati(
  businessId: string,
  contactId: string
): Promise<QarzHolati> {
  const [contact, agg] = await Promise.all([
    prisma.contact.findFirst({
      where: { id: contactId, businessId, deletedAt: null },
      select: { qarzLimit: true },
    }),
    prisma.debt.aggregate({
      where: { businessId, contactId, isYopilgan: false, turi: "olinadigan" },
      _sum: { jamiSumma: true, tolangan: true },
    }),
  ]);
  if (!contact) throw new ForbiddenError("Mijoz topilmadi");

  const ochiqQarz = (agg._sum.jamiSumma ?? 0) - (agg._sum.tolangan ?? 0);
  return {
    limit: contact.qarzLimit,
    ochiqQarz,
    qolgan: contact.qarzLimit === null ? null : contact.qarzLimit - ochiqQarz,
  };
}

/**
 * QARZ LIMITI TEKSHIRUVI — sotuv tranzaksiyasi ICHIDA chaqiriladi.
 *
 * Nega tranzaksiya ichida: limit tekshiruvi bilan qarz yozuvi orasida boshqa
 * sotuv o'tib ketsa, ikkalasi ham "limit yetadi" deb qaror qilardi va mijoz
 * chegaradan oshib ketardi. Bir tranzaksiyada ikkalasi bitta qarorga aylanadi.
 *
 * Xom `tx` delegatlari ishlatiladi, shuning uchun `businessId` QO'LDA yoziladi
 * (lib/db/businessTx.ts).
 */
export async function qarzLimitTekshirTx(
  tx: BusinessTx,
  businessId: string,
  contactId: string,
  yangiSumma: number
): Promise<void> {
  const contact = await tx.contact.findFirst({
    where: { id: contactId, businessId, deletedAt: null },
    select: { ism: true, qarzLimit: true },
  });
  if (!contact) throw new ForbiddenError("Mijoz topilmadi");
  if (contact.qarzLimit === null) return;

  const agg = await tx.debt.aggregate({
    where: { businessId, contactId, isYopilgan: false, turi: "olinadigan" },
    _sum: { jamiSumma: true, tolangan: true },
  });
  const ochiqQarz = (agg._sum.jamiSumma ?? 0) - (agg._sum.tolangan ?? 0);

  if (ochiqQarz + yangiSumma > contact.qarzLimit) {
    const qolgan = Math.max(0, contact.qarzLimit - ochiqQarz);
    throw new BadRequestError(
      `${contact.ism} uchun qarz limiti ${formatSom(contact.qarzLimit)} so'm. ` +
        `Hozirgi qarz ${formatSom(ochiqQarz)} so'm — bu sotuvga ${formatSom(qolgan)} so'm joy qolgan.`
    );
  }
}
