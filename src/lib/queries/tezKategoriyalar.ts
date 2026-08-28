import { prisma } from "@/lib/prisma";

/**
 * KO'P ISHLATILADIGAN KATEGORIYALAR — faqat UX tartibi.
 *
 * Kassir har kuni bir xil 3-4 kategoriyani tanlaydi ("Reklama", "Yodgor",
 * "Hovli bezaklari"), lekin ular alifbo tartibida ro'yxatning o'rtasida
 * qolib ketadi. Bu so'rov REAL tarixdan (oxirgi 90 kun) eng ko'p
 * ishlatilganlarini topadi va forma ularni tepada ko'rsatadi.
 *
 * MUHIM: bu kategoriya BUSINESS LOGIC'iga tegmaydi — kategoriya turi,
 * faolligi va tanlov qoidalari o'zgarmaydi, faqat ko'rsatish TARTIBI.
 * Tarix bo'sh bo'lsa ro'yxat oddiy (alifbo) tartibida qoladi.
 *
 * Ko'rinuvchanlik: `userId` berilsa (xodim) — faqat o'zi kiritgan yozuvlar
 * hisobga olinadi, ya'ni tavsiya boshqa xodimning tarixidan sizib chiqmaydi.
 */

const KUNLAR = 90;
const CHEGARA = 6;

export interface TezKategoriyalar {
  kirim: string[];
  chiqim: string[];
}

export async function getTezKategoriyalar(
  businessId: string,
  userId: string | null,
  chegara = CHEGARA
): Promise<TezKategoriyalar> {
  const boshlanish = new Date(Date.now() - KUNLAR * 24 * 60 * 60 * 1000);

  const guruhlar = await prisma.transaction.groupBy({
    by: ["turi", "categoryId"],
    where: {
      businessId,
      deletedAt: null,
      sana: { gte: boshlanish },
      ...(userId ? { userId } : {}),
    },
    _count: { _all: true },
    orderBy: { _count: { categoryId: "desc" } },
    // Ikki tur bo'yicha kesiladi, shuning uchun zaxira bilan olinadi.
    take: chegara * 4,
  });

  const natija: TezKategoriyalar = { kirim: [], chiqim: [] };
  for (const g of guruhlar) {
    const royxat = g.turi === "chiqim" ? natija.chiqim : natija.kirim;
    if (royxat.length < chegara) royxat.push(g.categoryId);
  }
  return natija;
}
