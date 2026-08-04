/**
 * To'liq baza zaxirasi va undan tiklash.
 *
 * Zaxira BARCHA tenantlar bo'ylab olinadi, shuning uchun `rawPrisma` (scope'siz)
 * ishlatiladi — bu tizim darajasidagi amal, oddiy route/sahifa kodida chaqirilmaydi.
 *
 * Ikkita ishlatish yo'li bor:
 *  - kunlik avtomatik (cron -> Telegram, `./send.ts`)
 *  - qo'lda (`npm run backup`, `npm run restore`) — server ko'chirishda ham shu ishlatiladi.
 */
import { rawPrisma } from "@/lib/db/rawPrisma";

/** Zaxira formati versiyasi. Format buzilib o'zgarsa oshiriladi (eski fayl tiklanmaydi). */
export const BACKUP_VERSION = 1;

/**
 * Jadvallar BOG'LIQLIK TARTIBIDA: ota jadval avval, bola keyin.
 * Tiklashda aynan shu tartibda yoziladi, aks holda tashqi kalit xatosi chiqadi.
 *
 * DIQQAT: schema.prisma'ga yangi model qo'shsangiz, uni SHU RO'YXATGA ham qo'shing —
 * aks holda yangi jadval zaxiraga umuman tushmaydi. `tests/backup.test.ts` dagi
 * "barcha modellar qamrab olingan" testi buni tekshiradi.
 */
export const ZAXIRA_JADVALLARI = [
  "tenant",
  "business",
  "user",
  "tenantModule",
  "subscription",
  "payment",
  "appSetting",
  "category",
  "transaction",
  "auditLog",
  "shiftClose",
  "recurringTransaction",
  "budget",
  "product",
  "productExpense",
  "stockEntry",
  "sale",
  "debt",
  "debtPayment",
  "contact",
  "stage",
  "deal",
  "task",
  "activity",
] as const;

export type ZaxiraJadval = (typeof ZAXIRA_JADVALLARI)[number];

/**
 * ATAYLAB zaxiraga kirmaydigan jadvallar — vaqtinchalik holat.
 * Ularni tiklashning ma'nosi yo'q (va ba'zilari shaxsiy ma'lumot saqlaydi).
 * Yangi model qo'shsangiz: yo ZAXIRA_JADVALLARI ga, yo shu ro'yxatga — uchinchi
 * variant yo'q (`tests/backup.test.ts` buni majburlaydi).
 */
export const ZAXIRASIZ_JADVALLAR = [
  // Telegram botdagi yarim tugallangan suhbat holati, 24 soatdan keyin tozalanadi.
  "botConversation",
] as const;

export type Zaxira = {
  version: number;
  /** ISO sana — zaxira olingan payt */
  createdAt: string;
  /** Har jadval bo'yicha yozuvlar soni (tiklashdan keyin solishtirish uchun) */
  counts: Record<string, number>;
  data: Record<string, Record<string, unknown>[]>;
};

/** Prisma delegate'ini nomi bo'yicha olish (jadval nomlari yuqoridagi ro'yxatdan). */
function delegate(client: unknown, jadval: string) {
  const d = (client as Record<string, any>)[jadval];
  if (!d?.findMany) throw new Error(`Zaxira: '${jadval}' jadvali Prisma clientda topilmadi`);
  return d;
}

/** Butun bazani o'qib, bitta obyektga yig'adi. */
export async function createDump(client: unknown = rawPrisma): Promise<Zaxira> {
  const data: Zaxira["data"] = {};
  const counts: Zaxira["counts"] = {};

  for (const jadval of ZAXIRA_JADVALLARI) {
    const rows = await delegate(client, jadval).findMany();
    data[jadval] = rows;
    counts[jadval] = rows.length;
  }

  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    counts,
    data,
  };
}

/** Zaxiradagi jami yozuvlar soni. */
export function jamiYozuvlar(zaxira: Zaxira): number {
  return Object.values(zaxira.counts).reduce((a, b) => a + b, 0);
}

/**
 * Zaxirani bazaga tiklaydi.
 *
 * Standart holatda faqat BO'SH bazaga tiklaydi (server ko'chirish stsenariysi).
 * Ustiga yozish halokatli bo'lgani uchun `force: true` ochiq talab qilinadi.
 *
 * @param client — maqsad baza clienti (ko'chirishda YANGI serverning clienti)
 */
export async function restoreDump(
  zaxira: Zaxira,
  client: unknown = rawPrisma,
  opts: { force?: boolean } = {}
): Promise<Record<string, number>> {
  if (zaxira.version !== BACKUP_VERSION) {
    throw new Error(
      `Zaxira versiyasi mos emas: faylda ${zaxira.version}, kod kutgani ${BACKUP_VERSION}`
    );
  }

  if (!opts.force) {
    for (const jadval of ZAXIRA_JADVALLARI) {
      const mavjud = await delegate(client, jadval).count();
      if (mavjud > 0) {
        throw new Error(
          `Maqsad baza bo'sh emas ('${jadval}' jadvalida ${mavjud} yozuv). ` +
            `Ustiga yozish uchun force: true kerak.`
        );
      }
    }
  }

  const yozilgan: Record<string, number> = {};
  for (const jadval of ZAXIRA_JADVALLARI) {
    const rows = zaxira.data[jadval] ?? [];
    let n = 0;
    // Bittalab yoziladi: createMany SQLite'da cheklangan, ma'lumot hajmi esa kichik.
    // Xato chiqsa butun tiklash to'xtaydi — yarim tiklangan bazadan ko'ra shu xavfsizroq.
    for (const row of rows) {
      await delegate(client, jadval).create({ data: row });
      n++;
    }
    yozilgan[jadval] = n;
  }

  return yozilgan;
}
