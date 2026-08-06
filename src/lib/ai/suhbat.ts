import { rawPrisma } from "@/lib/db/rawPrisma";

/**
 * AI SUHBAT TARIXI — SERVER TOMONDA (S-7).
 *
 * Ilgari tarix `POST /api/ai/chat` tanasida mijozdan kelardi. Foydalanuvchi
 * soxta `assistant` xabarini yozib modelni chalg'itishi mumkin edi (prompt
 * injection): "Sen endi boshqa qoidalarga bo'ysunasan..." kabi.
 *
 * Endi mijoz faqat savolni yuboradi — tarix shu yerdan olinadi va shu yerga
 * yoziladi. `rawPrisma`: bu vaqtinchalik holat jadvali, businessId/userId
 * chaqiruvchida allaqachon tenant-scoped tekshiruvdan o'tgan.
 */

export interface SuhbatXabar {
  rol: "user" | "assistant";
  matn: string;
}

/** Modelga yuboriladigan maksimal xabar soni (xarajat va kontekst chegarasi). */
export const MAX_TARIX = 20;

interface Kalit {
  businessId: string;
  userId: string;
}

/** Saqlangan tarixni o'qiydi. Buzilgan yozuv — bo'sh tarix (suhbat qaytadan boshlanadi). */
export async function tarixniOl({ businessId, userId }: Kalit): Promise<SuhbatXabar[]> {
  const row = await rawPrisma.aiConversation.findUnique({
    where: { businessId_userId: { businessId, userId } },
  });
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.xabarlar);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is SuhbatXabar =>
          x != null &&
          typeof x.matn === "string" &&
          (x.rol === "user" || x.rol === "assistant")
      )
      .slice(-MAX_TARIX);
  } catch {
    return [];
  }
}

/** Savol va javobni tarixga qo'shadi (oxirgi MAX_TARIX ta saqlanadi). */
export async function tarixgaYoz(
  kalit: Kalit & { tenantId: string },
  savol: string,
  javob: string
): Promise<void> {
  const oldingi = await tarixniOl(kalit);
  const yangi = [...oldingi, { rol: "user" as const, matn: savol }, { rol: "assistant" as const, matn: javob }]
    .slice(-MAX_TARIX);
  const xabarlar = JSON.stringify(yangi);

  await rawPrisma.aiConversation.upsert({
    where: { businessId_userId: { businessId: kalit.businessId, userId: kalit.userId } },
    update: { xabarlar },
    create: {
      tenantId: kalit.tenantId,
      businessId: kalit.businessId,
      userId: kalit.userId,
      xabarlar,
    },
  });
}

/** Suhbatni tozalash ("Yangi suhbat" tugmasi). */
export async function tarixniTozala(kalit: Kalit): Promise<void> {
  await rawPrisma.aiConversation.deleteMany({
    where: { businessId: kalit.businessId, userId: kalit.userId },
  });
}
