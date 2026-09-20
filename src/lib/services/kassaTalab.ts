import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { KASSA_TANLANMADI, kassaKerakmi } from "@/lib/kassaQoida";
import { resolveAccountId } from "@/lib/services/accounts";

/**
 * KASSA MAJBURIYLIGI — YAGONA QOIDA (frontend va backend uchun bir xil).
 *
 * Audit K-1: Kirim/Chiqim formasida kassa maydoni "Tanlang..." bo'sh turganda
 * ham yozuv saqlanardi va server uni JIMGINA foydalanuvchining shaxsiy
 * kassasiga yozardi. Do'konda sotuvchi naqd pulni umumiy yashikka soladi,
 * tizim esa uni "sotuvchining shaxsiy kassasi"ga yozadi — keyin kassa
 * topshirilmasa, xodimda pul bordek ko'rinadi. Aynan shu yo'l bilan Direktor
 * kassasi −17 450 000 ga tushgan.
 *
 * Shuning uchun ODAM TO'LDIRADIGAN formalarda (web) kassa MAJBURIY. Bu modul
 * shu qoidaning yagona manbai: `POST /api/transactions` va `PATCH
 * /api/transactions/[id]` ikkalasi ham shu yerdan o'tadi.
 *
 * NIMA O'ZGARMAYDI (ataylab): Telegram bot, CSV import, CRM "Yutildi"
 * ko'chirmasi, qarz to'lovi, oylik, POS va takroriy chiqimlar — ularda kassa
 * tanlash ekrani YO'Q, shuning uchun ular avvalgidek `resolveAccountId`
 * qoidasi bo'yicha standart kassaga yoziladi (lib/services/accounts.ts).
 */

// Shart va matn klient bilan BAHAM ko'riladi (lib/kassaQoida.ts) — forma
// va API bir xil qoidani, bir xil so'z bilan majburlaydi.
export { KASSA_TANLANMADI, kassaKerakmi };

/**
 * Web formasidan kelgan kassani tekshiradi.
 *
 * Rad etiladi: kassa berilmagan, boshqa biznes/tenant kassasi, mavjud emas,
 * nofaol kassa. `prisma` tenant-scoped, shuning uchun boshqa tenantning
 * kassasi umuman topilmaydi — cross-tenant bog'lanish mumkin emas.
 *
 * Qaytaradi: yoziladigan `accountId`, yoki qarz yozuvida `null`.
 */
export async function webKassaId(params: {
  businessId: string;
  accountId?: string | null;
  tolovTuri?: string | null;
}): Promise<string | null> {
  if (!kassaKerakmi(params.tolovTuri)) return null;

  const id = params.accountId?.trim();
  if (!id) throw new BadRequestError(KASSA_TANLANMADI);

  const kassa = await prisma.account.findFirst({
    where: { id, businessId: params.businessId },
    select: { id: true, isActive: true },
  });
  if (!kassa) throw new ForbiddenError("Kassa topilmadi yoki boshqa biznesga tegishli");
  if (!kassa.isActive) {
    throw new BadRequestError("Bu kassa nofaol — yangi yozuv unga yozilmaydi");
  }
  return kassa.id;
}

/**
 * TAHRIRDA KASSA BOG'LANISHI — `PATCH /api/transactions/[id]` qoidasi.
 *
 * Ilgari kassa FAQAT `tolovTuri` bilan birga kelganda qo'llanardi, shuning
 * uchun xato kassaga tushgan yozuvni UI orqali to'g'rilab bo'lmasdi
 * (audit K-2). Endi kassa mustaqil maydon.
 *
 * QOLDIQ IKKI MARTA O'ZGARMAYDI: kassa qoldig'i saqlanadigan raqam emas —
 * u har safar ledgerdan hisoblanadi (lib/queries/accounts.ts:
 * kirim − chiqim ± transfer). `accountId` ko'chganda pul eski kassadan
 * avtomatik chiqadi va yangisiga qo'shiladi; qo'shimcha tuzatish yozuvi
 * KERAK EMAS va yaratilmaydi.
 *
 * Bo'sh obyekt qaytsa — kassa bog'lanishi o'zgarmaydi.
 */
export async function kassaYangilanishi(params: {
  businessId: string;
  /** Yozuvning hozirgi kassasi. */
  mavjudAccountId: string | null;
  /** Yozuvni kiritgan xodim — standart kassa qoidasi uchun. */
  mavjudUserId: string;
  /** So'rovda kelgan kassa. `undefined` — umuman kelmadi. */
  yangiAccountId?: string | null;
  /** So'rovda `tolovTuri` maydoni bormi. */
  tolovTuriKeldi: boolean;
  /** Tahrirdan KEYINGI to'lov turi. */
  yakuniyTolov: string | null;
}): Promise<{ accountId: string | null } | Record<string, never>> {
  // QARZ — pul kassaga tushmagan, bog'lanish uziladi.
  if (!kassaKerakmi(params.yakuniyTolov)) {
    return params.mavjudAccountId !== null ? { accountId: null } : {};
  }
  // Kassa ANIQ ko'rsatilgan — web qoidasi bo'yicha tekshiriladi.
  if (params.yangiAccountId !== undefined) {
    return {
      accountId: await webKassaId({
        businessId: params.businessId,
        accountId: params.yangiAccountId,
        tolovTuri: params.yakuniyTolov,
      }),
    };
  }
  // Qarzdan naqd/click'ka qaytdi, lekin kassa ko'rsatilmadi — avvalgidek
  // to'lov turiga mos kassa qayta bog'lanadi (eski xatti-harakat).
  if (params.tolovTuriKeldi && params.mavjudAccountId === null) {
    return {
      accountId: await resolveAccountId(
        params.businessId,
        null,
        params.yakuniyTolov,
        params.mavjudUserId
      ),
    };
  }
  return {};
}
