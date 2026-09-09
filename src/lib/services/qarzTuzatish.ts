import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { qarzHolatHisobla, qarzYopiqmi } from "@/lib/validation/qarz";

/**
 * QARZNI TUZATISH VA O'CHIRISH — FAQAT DIREKTOR.
 *
 * Nega kerak edi: noto'g'ri kiritilgan qarz summasini to'g'rilashning yo'li
 * yo'q edi. Bor narsa "bekor qilish" edi, u ham faqat to'lovsiz qarzga —
 * ya'ni 5 mln o'rniga 50 mln yozilgan qarz mijoz kartochkasida shundayligicha
 * osilib turardi.
 *
 * IKKI QOIDA:
 *
 * 1. TO'LOVGA TEGILMAYDI. Qarzga to'lov qabul qilingan bo'lsa, u kirim
 *    tranzaksiyasi yozgan (`lib/services/qarz.ts`) — kassada pul bor.
 *    Shuning uchun `jamiSumma` to'langan summadan PAST qilib tuzatilmaydi
 *    va to'lovi bor qarz o'chirilmaydi: avval to'lov Moliya bo'limidan
 *    bekor qilinadi (`lib/services/pulOqimiTuzatish.ts`), keyin qarz.
 *
 * 2. O'CHIRISH YUMSHOQ. Yozuv bazada qoladi (`deletedAt`) — unga bog'langan
 *    sotuv, CRM zakazi va audit izi uzilmasligi kerak. Ayni paytda status
 *    `CANCELLED` bo'ladi, ya'ni pul jamlarini hisoblaydigan MAVJUD
 *    so'rovlarning hammasi (ular bekor qilinganni allaqachon chiqarib
 *    tashlaydi) o'zgarishsiz to'g'ri ishlaydi.
 *
 * Har ikkala amal `AuditLog` ga eski→yangi qiymat va SABAB bilan yoziladi.
 * Audit yozuvi qarzga FK bilan bog'lanmagan, shuning uchun qarz o'chirilsa
 * ham jurnal joyida qoladi (7-talab).
 */

/** Audit uchun qarzning muhim maydonlari — o'chirilgandan keyin ham o'qiladi. */
function qarzSurati(d: {
  id: string;
  turi: string;
  contactId: string | null;
  mijozNomi: string;
  mijozTel: string | null;
  jamiSumma: number;
  tolangan: number;
  status: string;
  sana: Date | null;
  muddat: Date | null;
  izoh: string | null;
  categoryId: string | null;
}) {
  return {
    id: d.id,
    turi: d.turi,
    contactId: d.contactId,
    mijozNomi: d.mijozNomi,
    mijozTel: d.mijozTel,
    jamiSumma: d.jamiSumma,
    tolangan: d.tolangan,
    qolgan: d.jamiSumma - d.tolangan,
    status: d.status,
    sana: d.sana ? d.sana.toISOString() : null,
    muddat: d.muddat ? d.muddat.toISOString() : null,
    izoh: d.izoh,
    categoryId: d.categoryId,
  };
}

export interface QarzTahrirParams {
  businessId: string;
  debtId: string;
  userId: string;
  jamiSumma?: number | null;
  /**
   * Qarz BOSHQA mijozga yozilib qolgan bo'lsa — kartochkani almashtirish.
   * `null` — bog'lanishni uzish, `undefined` — tegilmaydi.
   */
  contactId?: string | null;
  mijozNomi?: string | null;
  mijozTel?: string | null;
  /** "YYYY-MM-DD" — qarz berilgan sana. */
  sana?: string | null;
  /** "YYYY-MM-DD" — kelishilgan to'lov muddati. `null` — muddat olib tashlanadi. */
  muddat?: string | null;
  izoh?: string | null;
  /** Tuzatish sababi — auditga yoziladi. */
  sabab?: string | null;
}

/**
 * QARZNI TAHRIRLASH — summa, mijoz (kartochka/ism/telefon), sana, muddat
 * va izoh.
 *
 * TO'LOV BALANSI BUZILMAYDI. `tolangan` ustuniga bu yerda UMUMAN
 * tegilmaydi — u faqat to'lov qabul qilish va to'lovni bekor qilish
 * orqali o'zgaradi. Shuning uchun tahrirdan keyin ham
 * `qolgan = jamiSumma − tolangan` invarianti saqlanadi, kassadagi kirim
 * esa o'z joyida qoladi. Yagona qoida — yuqoridagi "to'langandan past
 * bo'lmaydi" tekshiruvi: u qoldiqni manfiyga tushishdan saqlaydi.
 *
 * Summa o'zgarsa holat (`status`, `isYopilgan`) MAVJUD `qarzHolatHisobla`
 * bilan qayta hisoblanadi: 5 mln qarzdan 5 mln to'langan bo'lsa u PAID,
 * summa 7 mln ga tuzatilsa yana PARTIALLY_PAID bo'lib ochiladi.
 */
export async function qarzTahrirla(params: QarzTahrirParams) {
  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const debt = await tx.debt.findFirst({
      where: { id: params.debtId, businessId: params.businessId },
    });
    if (!debt) throw new ForbiddenError("Qarz topilmadi");
    if (debt.deletedAt) throw new BadRequestError("O'chirilgan qarzni tahrirlab bo'lmaydi");

    const jamiSumma = params.jamiSumma ?? debt.jamiSumma;
    if (!Number.isInteger(jamiSumma) || jamiSumma <= 0) {
      throw new BadRequestError("Qarz summasi butun va noldan katta bo'lishi kerak");
    }
    // TO'LANGANDAN PAST TUZATIB BO'LMAYDI: to'lov allaqachon kirim yozgan,
    // summa undan past bo'lsa qoldiq manfiyga tushib, mijozga "avans" degan
    // yashirin tushuncha paydo bo'lardi (tizimda u yo'q).
    if (jamiSumma < debt.tolangan) {
      throw new BadRequestError(
        `Summa to'langan qismdan (${debt.tolangan}) past bo'lmasligi kerak — avval to'lovni bekor qiling`
      );
    }

    // MIJOZNI ALMASHTIRISH — qarz boshqa odamning kartochkasiga yozilib
    // qolgan holat. Kartochka SHU biznesniki ekani tekshiriladi: tranzaksiya
    // ichida xom `tx` ishlatiladi, ya'ni tenant filtri avtomatik EMAS.
    let kartochkaIsm: string | null = null;
    let kartochkaTel: string | null = null;
    if (params.contactId) {
      const contact = await tx.contact.findFirst({
        where: { id: params.contactId, businessId: params.businessId, deletedAt: null },
        select: { ism: true, tel: true },
      });
      if (!contact) throw new BadRequestError("Mijoz kartochkasi topilmadi");
      kartochkaIsm = contact.ism;
      kartochkaTel = contact.tel;
    }

    const bekorMi = debt.status === "CANCELLED";
    const status = qarzHolatHisobla(jamiSumma, debt.tolangan, bekorMi);

    const yangi = await tx.debt.update({
      where: { id: debt.id },
      data: {
        jamiSumma,
        status,
        isYopilgan: qarzYopiqmi(status),
        ...(params.contactId !== undefined ? { contactId: params.contactId } : {}),
        // Ism/telefon ochiq berilmasa, kartochka almashtirilganda undan
        // olinadi — aks holda qarz yangi mijozga bog'lanib, ekranda ESKI
        // ismni ko'rsatib turardi.
        ...(params.mijozNomi != null
          ? { mijozNomi: params.mijozNomi.trim() }
          : kartochkaIsm
            ? { mijozNomi: kartochkaIsm }
            : {}),
        ...(params.mijozTel !== undefined
          ? { mijozTel: params.mijozTel }
          : kartochkaTel
            ? { mijozTel: kartochkaTel }
            : {}),
        ...(params.sana ? { sana: dateOnlyStringToUTCDate(params.sana) } : {}),
        ...(params.muddat !== undefined
          ? { muddat: params.muddat ? dateOnlyStringToUTCDate(params.muddat) : null }
          : {}),
        ...(params.izoh !== undefined ? { izoh: params.izoh?.trim() || null } : {}),
        updatedBy: params.userId,
      },
    });
    return { oldin: qarzSurati(debt), keyin: qarzSurati(yangi) };
  });

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "debt",
    entityId: params.debtId,
    before: natija.oldin,
    after: natija.keyin,
    sabab: params.sabab,
  });
  return natija.keyin;
}

/**
 * QARZNI O'CHIRISH (yumshoq) — faqat to'lovi bo'lmagan qarz.
 *
 * To'lovi bor qarz o'chirilsa kassadagi kirim "havoda" qolardi: pul kelgan,
 * lekin nima uchun kelgani yo'qolgan bo'lardi. Shuning uchun tartib aniq:
 * avval to'lov bekor qilinadi (Moliya bo'limi), keyin qarz o'chiriladi.
 */
export async function qarzOchir(params: {
  businessId: string;
  debtId: string;
  userId: string;
  sabab?: string | null;
}) {
  const oldin = await runBusinessTx(params.businessId, async (tx) => {
    const debt = await tx.debt.findFirst({
      where: { id: params.debtId, businessId: params.businessId },
    });
    if (!debt) throw new ForbiddenError("Qarz topilmadi");
    if (debt.deletedAt) throw new BadRequestError("Bu qarz allaqachon o'chirilgan");

    const tolovSoni = await tx.debtPayment.count({
      where: { businessId: params.businessId, debtId: debt.id },
    });
    if (tolovSoni > 0 || debt.tolangan > 0) {
      throw new BadRequestError(
        "To'lovi qabul qilingan qarz o'chirilmaydi — avval to'lovni Moliya bo'limidan bekor qiling"
      );
    }

    // Optimistik qulf: to'lov shu orada kelib qolgan bo'lsa yozilmaydi.
    const upd = await tx.debt.updateMany({
      where: { id: debt.id, businessId: params.businessId, tolangan: 0, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy: params.userId,
        // Status CANCELLED — pul jamlari MAVJUD filtrlar bilan to'g'ri qoladi.
        status: "CANCELLED",
        isYopilgan: true,
        cancelledAt: new Date(),
        cancelledBy: params.userId,
        cancelReason: params.sabab?.trim() || "Direktor o'chirdi",
        updatedBy: params.userId,
      },
    });
    if (upd.count === 0) {
      throw new BadRequestError("Qarz holati o'zgardi — sahifani yangilab qayta urinib ko'ring");
    }
    return qarzSurati(debt);
  });

  await logAudit({
    businessId: params.businessId,
    action: "delete",
    entity: "debt",
    entityId: params.debtId,
    // Suratning O'ZI muhim: qarz o'chirilgach jurnal yagona manba bo'lib
    // qoladi, shuning uchun mijoz nomi va summa shu yerda saqlanadi.
    before: oldin,
    after: { ochirildi: true },
    sabab: params.sabab,
  });
  return oldin;
}
