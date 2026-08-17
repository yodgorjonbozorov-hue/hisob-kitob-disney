/**
 * YOPILGAN DAVR QULFI (audit: Critical #4).
 *
 * MUAMMO. Loyihada ikkita "davr yopish" tushunchasi bor va ikkalasi ham
 * NAZORAT uchun ishlatiladi — lekin ularning hech biri moliyaviy yozuvni
 * himoya qilmasdi:
 *
 *  1. KUNLIK HISOBOT (`DailyReport`) — direktor kunni TASDIQLAYDI
 *     (`holat: "CONFIRMED"`): naqd sanaldi, farq tekshirildi, kun yopildi.
 *     Shundan keyin ham o'sha kunga yangi kirim yozib, eskisini o'chirib
 *     yuborish mumkin edi. Tasdiqlangan hisobot raqamlari esa muzlagan —
 *     natijada hisobot bilan yozuvlar bir-biriga mos kelmay qolardi.
 *  2. SMENA (`Smena`) — xodim kassani sanab topshiradi, summalar yopish
 *     paytida MUZLATILADI. Yopilgan smena oynasidagi yozuvni keyin
 *     o'chirish "kassada farq yo'q edi" degan yozuvni yolg'onga
 *     aylantirardi va aynan o'g'irlikni yashirish yo'li shu edi.
 *
 * DAVR TUSHUNCHASI KODDAGIDEK OLINDI (yangisi o'ylab topilmadi):
 *  - kunlik hisobot yozuvning `sana` si bo'yicha topiladi — u kalendar kun
 *    (`@@unique([businessId, sana])`);
 *  - smena esa `createdAt` bo'yicha kesiladi (`boshlanishAt < createdAt <=
 *    tugashAt`) — chunki kassadagi pul yozuvning sanasiga emas, KIRITILGAN
 *    paytiga qarab to'planadi (`smena.ts` dagi izohga qarang).
 *
 * SHUNING UCHUN:
 *  - YANGI yozuv uchun faqat kunlik hisobot tekshiriladi. Yangi yozuvning
 *    `createdAt` i har doim "hozir", ya'ni oxirgi yopilgan smenadan KEYIN —
 *    u yopilgan smena oynasiga tushishi mumkin emas.
 *  - MAVJUD yozuvni o'zgartirishda (o'chirish, tiklash, storno) ikkalasi
 *    ham tekshiriladi.
 *
 * ESKI MA'LUMOTGA TEGILMAYDI: qulf faqat TEGISHLI davr yozuvi mavjud
 * bo'lgandagina ishlaydi. Kunlik/smena modulidan foydalanmaydigan mijozda
 * bunday yozuv umuman bo'lmaydi — ular uchun hech narsa o'zgarmaydi.
 *
 * QAMROV: barcha yozuv yaratish `createTransaction`/`createTransactionTx`
 * dan o'tadi (sotuv, qarz, xarid, HR, tasdiqlash, CRM) — qulf o'sha yerda.
 * O'zgartirish yo'llari: o'chirish/ommaviy o'chirish/tiklash route'lari,
 * storno xizmati, sotuv va xarajat bekor qilish.
 */
import { BadRequestError } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import type { BusinessTx } from "@/lib/db/businessTx";
import { utcDateToDateOnlyString } from "@/lib/date";

/** Kunlik hisobotning yozuvni qulflaydigan holati. */
const QULFLOVCHI_HOLAT = "CONFIRMED";

/** Qulf topilgan davr haqidagi eng kerakli ma'lumot. */
interface KunlikQulf {
  sana: Date;
}
interface SmenaQulf {
  sana: Date;
  raqam: number;
}

/**
 * Tasdiqlangan kunga yozuv kiritish/o'zgartirish taqiqi matni.
 *
 * Xato ATAYLAB uzun: foydalanuvchi nima uchun bloklanganini va nima
 * qilishini bilishi kerak — aks holda u yo'lni "aylanib o'tishga" harakat
 * qiladi (masalan sanani o'zgartirib yozadi).
 */
function kunlikXatosi(qulf: KunlikQulf, amal: string): BadRequestError {
  const sana = utcDateToDateOnlyString(qulf.sana);
  return new BadRequestError(
    `${sana} kunlik hisoboti tasdiqlangan (yopilgan) — o'sha kunga tegishli yozuvni ${amal} mumkin emas. ` +
      "Tuzatish uchun ikki yo'l bor: direktor o'sha kunni qayta ochsin " +
      "(Kunlik hisobot -> Qayta ochish), yoki JORIY OCHIQ kunga tuzatuvchi " +
      "(qarama-qarshi) yozuv kiriting — u holda yopilgan kun raqamlari o'z holicha qoladi."
  );
}

/** Yopilgan smena oynasidagi yozuvga tegish taqiqi matni. */
function smenaXatosi(qulf: SmenaQulf, amal: string): BadRequestError {
  const sana = utcDateToDateOnlyString(qulf.sana);
  return new BadRequestError(
    `Bu yozuv yopilgan smenaga tegishli (${sana}, ${qulf.raqam}-smena) — uni ${amal} mumkin emas. ` +
      "Yopilgan smenada kassa sanalgan va farq qayd etilgan; yozuvni keyin o'zgartirish " +
      "o'sha tekshiruvni ma'nosiz qiladi. Tuzatish uchun JORIY OCHIQ smenaga " +
      "tuzatuvchi (qarama-qarshi) yozuv kiriting."
  );
}

// ---------------------------------------------------------------------------
// So'rovlar — `prisma` (tenant-scoped) va `tx` (xom) variantlari.
// Xom variantda `businessId` sharti QO'LDA yoziladi (CLAUDE.md qoidasi).
// ---------------------------------------------------------------------------

async function kunlikQulfiTx(
  tx: BusinessTx,
  businessId: string,
  sana: Date
): Promise<KunlikQulf | null> {
  return tx.dailyReport.findFirst({
    where: { businessId, sana, holat: QULFLOVCHI_HOLAT },
    select: { sana: true },
  });
}

async function smenaQulfiTx(
  tx: BusinessTx,
  businessId: string,
  payt: Date
): Promise<SmenaQulf | null> {
  return tx.smena.findFirst({
    where: { businessId, boshlanishAt: { lt: payt }, tugashAt: { gte: payt } },
    select: { sana: true, raqam: true },
  });
}

// ---------------------------------------------------------------------------
// Ommaviy API
// ---------------------------------------------------------------------------

/**
 * YANGI yozuv uchun: `sana` tasdiqlangan kunga tushmasin.
 *
 * @param amal xato matnida ishlatiladigan fe'l ("kiritish", "o'chirish"...).
 * @throws BadRequestError — kun tasdiqlangan bo'lsa.
 */
export async function assertYangiYozuvDavriTx(
  tx: BusinessTx,
  businessId: string,
  sana: Date,
  amal = "kiritish"
): Promise<void> {
  const qulf = await kunlikQulfiTx(tx, businessId, sana);
  if (qulf) throw kunlikXatosi(qulf, amal);
}

/** `assertYangiYozuvDavriTx` ning tranzaksiyasiz (tenant-scoped) varianti. */
export async function assertYangiYozuvDavri(
  businessId: string,
  sana: Date,
  amal = "kiritish"
): Promise<void> {
  const qulf = await prisma.dailyReport.findFirst({
    where: { businessId, sana, holat: QULFLOVCHI_HOLAT },
    select: { sana: true },
  });
  if (qulf) throw kunlikXatosi(qulf, amal);
}

/** O'zgartirilayotgan yozuvdan qulf uchun kerak bo'ladigan maydonlar. */
export interface OzgaruvchiYozuv {
  sana: Date;
  createdAt: Date;
}

/**
 * MAVJUD yozuvni o'zgartirish (o'chirish, tiklash, storno) uchun: yozuv
 * tasdiqlangan kunga ham, yopilgan smena oynasiga ham tegishli bo'lmasin.
 *
 * @throws BadRequestError — davr yopiq bo'lsa.
 */
export async function assertYozuvOzgarishiTx(
  tx: BusinessTx,
  businessId: string,
  yozuv: OzgaruvchiYozuv,
  amal = "o'zgartirish"
): Promise<void> {
  const kunlik = await kunlikQulfiTx(tx, businessId, yozuv.sana);
  if (kunlik) throw kunlikXatosi(kunlik, amal);

  const smena = await smenaQulfiTx(tx, businessId, yozuv.createdAt);
  if (smena) throw smenaXatosi(smena, amal);
}

/** `assertYozuvOzgarishiTx` ning tranzaksiyasiz (tenant-scoped) varianti. */
export async function assertYozuvOzgarishi(
  businessId: string,
  yozuv: OzgaruvchiYozuv,
  amal = "o'zgartirish"
): Promise<void> {
  const kunlik = await prisma.dailyReport.findFirst({
    where: { businessId, sana: yozuv.sana, holat: QULFLOVCHI_HOLAT },
    select: { sana: true },
  });
  if (kunlik) throw kunlikXatosi(kunlik, amal);

  const smena = await prisma.smena.findFirst({
    where: {
      businessId,
      boshlanishAt: { lt: yozuv.createdAt },
      tugashAt: { gte: yozuv.createdAt },
    },
    select: { sana: true, raqam: true },
  });
  if (smena) throw smenaXatosi(smena, amal);
}

/**
 * Ommaviy amal uchun: berilgan yozuvlardan BIRORTASI yopiq davrda bo'lsa
 * butun amal to'xtaydi.
 *
 * Yarim bajarilgan ommaviy o'chirish eng yomon holat: foydalanuvchi nimalar
 * o'chganini bilmaydi. Shuning uchun "hammasi yoki hech biri".
 */
export async function assertYozuvlarOzgarishi(
  businessId: string,
  yozuvlar: OzgaruvchiYozuv[],
  amal = "o'zgartirish"
): Promise<void> {
  for (const yozuv of yozuvlar) {
    await assertYozuvOzgarishi(businessId, yozuv, amal);
  }
}
