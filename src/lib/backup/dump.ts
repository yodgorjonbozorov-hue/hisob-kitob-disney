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
import { randomBytes } from "node:crypto";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { deshifrla, kalitBormi, shifrla } from "./crypto";

/**
 * Zaxira formati versiyasi. Format buzilib o'zgarsa oshiriladi (eski fayl tiklanmaydi).
 *
 * Parol hashlari zaxira TANASIDAN chiqarilganda (audit: Critical #2) versiya
 * ATAYLAB oshirilmadi: `restoreDump` ikkala ko'rinishni ham tushunadi —
 * hash qator ichida turgan ESKI fayllarni ham, alohida shifrlangan `sirlar`
 * blokidagi yangilarini ham. Versiyani oshirish mavjud zaxiralarni
 * yaroqsiz qilib qo'yardi — ya'ni himoya qo'shish tiklash imkonini yo'q qilardi.
 */
export const BACKUP_VERSION = 1;

/**
 * Jadvallar BOG'LIQLIK TARTIBIDA: ota jadval avval, bola keyin.
 * Tiklashda aynan shu tartibda yoziladi, aks holda tashqi kalit xatosi chiqadi.
 *
 * DIQQAT: schema.prisma'ga yangi model qo'shsangiz, uni SHU RO'YXATGA ham qo'shing —
 * aks holda yangi jadval zaxiraga umuman tushmaydi. `tests/backup.test.ts` dagi
 * "barcha modellar qamrab olingan" testi buni tekshiradi.
 */
/**
 * Zaxira va TIKLASH tartibi. `restoreDump` aynan shu ketma-ketlikda yozadi,
 * shuning uchun ro'yxat BOG'LIQLIK TARTIBIDA bo'lishi shart: har jadval o'zi
 * murojaat qiladigan jadvallardan KEYIN turadi.
 *
 * Yangi model qo'shsangiz, uning FK'lari ro'yxatda undan oldinroqda ekaniga
 * ishonch hosil qiling — aks holda tiklash yarim yo'lda to'xtaydi.
 */
export const ZAXIRA_JADVALLARI = [
  "tenant",
  "business",
  // DIQQAT: `role` `user`dan OLDIN turishi SHART — User.roleId FK Role'ga
  // murojaat qiladi. Tartib buzilsa zaxira tiklanmaydi.
  "role",
  "user",
  "tenantModule",
  "subscription",
  "payment",
  "appSetting",
  "account",
  "category",
  "transaction",
  "auditLog",
  "shiftClose",
  "recurringTransaction",
  "budget",
  "product",
  "productExpense",
  "stockEntry",
  // DIQQAT: `contact` `sale` va `debt` dan OLDIN turishi SHART — ikkalasida
  // ham `contactId` FK bor (MIJOZLAR moduli). Tartib buzilsa zaxira tiklanmaydi:
  // "Foreign key constraint violated". `tests/backup.test.ts` buni qo'riqlaydi.
  "contact",
  "sale",
  "debt",
  "debtPayment",
  "stage",
  "deal",
  "task",
  "activity",
  "accountTransfer",
  "stockAdjustment",
  "supplier",
  "purchaseOrder",
  "purchaseOrderItem",
  "approvalRule",
  "approvalRequest",
  "employee",
  "attendance",
  "payroll",
  "payrollAdvance",
  "contract",
  "attachment",
  // dailyReport business/user'dan keyin; dailyTransaction dailyReport'ga FK bilan bog'liq.
  "dailyReport",
  "dailyTransaction",
  "dailyReportSetting",
  // Smena yakuni — faqat Business'ga FK bilan bog'liq (undan keyin tursa yetarli).
  "smena",
  // Kassa topshirig'i — faqat Business'ga FK bilan bog'liq (kassir/qabul
  // qiluvchi ataylab FK'siz: foydalanuvchi o'chirilsa ham tarix qolsin).
  "cashHandover",
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
  // AI yordamchi suhbati — vaqtinchalik kontekst, tiklashning ma'nosi yo'q.
  "aiConversation",
] as const;

/** Parol hashlari saqlanadigan maydon nomi (`User.parolHash`). */
const PAROL_MAYDON = "parolHash";

export type Zaxira = {
  version: number;
  /** ISO sana — zaxira olingan payt */
  createdAt: string;
  /** Har jadval bo'yicha yozuvlar soni (tiklashdan keyin solishtirish uchun) */
  counts: Record<string, number>;
  data: Record<string, Record<string, unknown>[]>;
  /**
   * ALOHIDA SHIFRLANGAN sirlar bloki — hozircha faqat parol hashlari
   * (`{ parolHash: { <userId>: "<hash>" } }` ning AES-256-GCM shifri, base64).
   *
   * Nega alohida: hashlar zaxira tanasida (`data.user`) turgan edi, ya'ni
   * `npm run backup` diskka yozgan JSON va Telegramga ketgan fayl ochiq
   * hashlar bilan yotardi. Endi tanada ular UMUMAN yo'q — kalitsiz zaxirani
   * ochgan odam parol hashlarini ko'rmaydi.
   *
   * Kalit sozlanmagan bo'lsa bu maydon BO'LMAYDI va hashlar zaxiraga
   * umuman tushmaydi (ochiq holda hech qachon yozilmaydi).
   */
  sirlar?: string;
};

/** Prisma delegate'ini nomi bo'yicha olish (jadval nomlari yuqoridagi ro'yxatdan). */
function delegate(client: unknown, jadval: string) {
  const d = (client as Record<string, any>)[jadval];
  if (!d?.findMany) throw new Error(`Zaxira: '${jadval}' jadvali Prisma clientda topilmadi`);
  return d;
}

/**
 * Foydalanuvchi qatorlaridan parol hashlarini AJRATADI.
 *
 * Qatorlar o'rniga NUSXA qaytariladi — chaqiruvchi qo'lidagi obyektlar
 * (Prisma natijasi) o'zgartirilmaydi.
 *
 * @returns tozalangan qatorlar va `{ <userId>: <hash> }` xaritasi.
 */
function parolniAjrat(rows: Record<string, unknown>[]): {
  tozalangan: Record<string, unknown>[];
  hashlar: Record<string, string>;
} {
  const hashlar: Record<string, string> = {};
  const tozalangan = rows.map((row) => {
    const { [PAROL_MAYDON]: hash, ...qolgan } = row;
    const id = row.id;
    if (typeof hash === "string" && typeof id === "string") hashlar[id] = hash;
    return qolgan;
  });
  return { tozalangan, hashlar };
}

/** Butun bazani o'qib, bitta obyektga yig'adi. */
export async function createDump(client: unknown = rawPrisma): Promise<Zaxira> {
  const data: Zaxira["data"] = {};
  const counts: Zaxira["counts"] = {};
  let hashlar: Record<string, string> = {};

  for (const jadval of ZAXIRA_JADVALLARI) {
    const rows = await delegate(client, jadval).findMany();
    if (jadval === "user") {
      // Parol hashlari zaxira TANASIGA hech qachon tushmaydi.
      const ajratilgan = parolniAjrat(rows);
      data[jadval] = ajratilgan.tozalangan;
      hashlar = ajratilgan.hashlar;
    } else {
      data[jadval] = rows;
    }
    counts[jadval] = rows.length;
  }

  const zaxira: Zaxira = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    counts,
    data,
  };

  // Kalit bo'lsa — hashlar alohida shifrlangan blokda saqlanadi (tiklash
  // to'liq bo'lishi uchun). Kalit yo'q bo'lsa hashlar TASHLAB YUBORILADI:
  // ochiq holda yozishdan ko'ra tiklashda parol tiklash afzal.
  if (Object.keys(hashlar).length > 0 && kalitBormi()) {
    zaxira.sirlar = shifrla(Buffer.from(JSON.stringify({ [PAROL_MAYDON]: hashlar }))).toString(
      "base64"
    );
  }

  return zaxira;
}

/** Zaxiradagi jami yozuvlar soni. */
export function jamiYozuvlar(zaxira: Zaxira): number {
  return Object.values(zaxira.counts).reduce((a, b) => a + b, 0);
}

/**
 * Shifrlangan `sirlar` blokini ochadi.
 *
 * Blok yo'q bo'lsa (kalitsiz olingan yoki eski format zaxira) — bo'sh xarita.
 * Blok bor, lekin kalit yo'q/noto'g'ri bo'lsa — XATO: jimgina parolsiz
 * tiklash o'rniga operatorga aniq aytiladi (u kalitni topib qayta uradi).
 */
function sirlarniOch(zaxira: Zaxira, parolsiz = false): Record<string, string> {
  if (!zaxira.sirlar || parolsiz) return {};
  if (!kalitBormi()) {
    throw new Error(
      "Zaxirada shifrlangan parol hashlari bor, lekin BACKUP_ENCRYPTION_KEY sozlanmagan. " +
        "Kalitni env'ga qo'ying yoki `parolsiz: true` bilan tiklang " +
        "(u holda barcha foydalanuvchilarga yangi parol beriladi)."
    );
  }
  const ochiq = JSON.parse(deshifrla(Buffer.from(zaxira.sirlar, "base64")).toString("utf8"));
  const hashlar = ochiq?.[PAROL_MAYDON];
  return hashlar && typeof hashlar === "object" ? (hashlar as Record<string, string>) : {};
}

/**
 * Foydalanuvchi qatoriga parol hashini qaytaradi.
 *
 * Uchta holat:
 *  1. qatorda hash bor (ESKI format zaxira) — o'zgarishsiz qoladi;
 *  2. `sirlar` dan topildi — o'sha yoziladi (to'liq tiklash);
 *  3. topilmadi — HECH QACHON mos kelmaydigan tasodifiy qiymat qo'yiladi va
 *     `mustChangePassword` yoqiladi. `parolHash` sxemada majburiy, shuning
 *     uchun bo'sh qoldirib bo'lmaydi; bu qiymat bilan kirib ham bo'lmaydi
 *     (bcrypt formati emas — solishtirish har doim false). Direktor/superadmin
 *     parolni qayta beradi.
 */
function parolniQaytar(
  row: Record<string, unknown>,
  hashlar: Record<string, string>
): Record<string, unknown> {
  if (typeof row[PAROL_MAYDON] === "string" && row[PAROL_MAYDON]) return row;

  const id = typeof row.id === "string" ? row.id : null;
  const hash = id ? hashlar[id] : undefined;
  if (hash) return { ...row, [PAROL_MAYDON]: hash };

  return {
    ...row,
    [PAROL_MAYDON]: `tiklangan-parolsiz:${randomBytes(16).toString("hex")}`,
    mustChangePassword: true,
  };
}

/**
 * Zaxirani bazaga tiklaydi.
 *
 * Standart holatda faqat BO'SH bazaga tiklaydi (server ko'chirish stsenariysi).
 * Ustiga yozish halokatli bo'lgani uchun `force: true` ochiq talab qilinadi.
 *
 * @param client — maqsad baza clienti (ko'chirishda YANGI serverning clienti)
 * @param opts.parolsiz — shifr kaliti yo'q bo'lsa ham davom etish: parollar
 *   tiklanmaydi, har foydalanuvchiga yangi parol berish kerak bo'ladi.
 */
export async function restoreDump(
  zaxira: Zaxira,
  client: unknown = rawPrisma,
  opts: { force?: boolean; parolsiz?: boolean } = {}
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

  const hashlar = sirlarniOch(zaxira, opts.parolsiz);

  const yozilgan: Record<string, number> = {};
  for (const jadval of ZAXIRA_JADVALLARI) {
    const xomRows = zaxira.data[jadval] ?? [];
    const rows = jadval === "user" ? xomRows.map((row) => parolniQaytar(row, hashlar)) : xomRows;
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
