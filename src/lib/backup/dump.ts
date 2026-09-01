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
  // Ko'p-bizneslik biriktiruvi — `user` VA `business` dan KEYIN turishi SHART
  // (ikkalasiga ham FK bilan murojaat qiladi).
  "userBusiness",
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
  // MAGAZIN: DIQQAT: `productCategory` `product`dan OLDIN turishi SHART —
  // `Product.categoryId` unga FK bilan murojaat qiladi.
  "productCategory",
  "product",
  "productExpense",
  "stockEntry",
  // DIQQAT: `contact` `sale` va `debt` dan OLDIN turishi SHART — ikkalasida
  // ham `contactId` FK bor (MIJOZLAR moduli). Tartib buzilsa zaxira tiklanmaydi:
  // "Foreign key constraint violated". `tests/backup.test.ts` buni qo'riqlaydi.
  "contact",
  // MAGAZIN: DIQQAT: `posChek` `sale`dan OLDIN turishi SHART — `Sale.chekId`
  // unga FK bilan murojaat qiladi. O'zi esa `contact`dan KEYIN turadi
  // (`PosChek.contactId`).
  "posChek",
  "sale",
  "debt",
  "debtPayment",
  "stage",
  "deal",
  "activity",
  "accountTransfer",
  "stockAdjustment",
  "supplier",
  "purchaseOrder",
  "purchaseOrderItem",
  "approvalRule",
  "approvalRequest",
  // Davomat 2.0: DIQQAT: `workLocation` va `workSchedule` `employee`dan OLDIN
  // turishi SHART — Employee ikkalasiga FK bilan murojaat qiladi
  // (workLocationId/workScheduleId). `workScheduleDay` jadvaldan KEYIN.
  "workLocation",
  "workSchedule",
  "workScheduleDay",
  "employee",
  // DIQQAT: `task` `deal` VA `employee`dan KEYIN turishi SHART — Task ikkalasiga
  // FK bilan murojaat qiladi (dealId/employeeId). Shu sabab u CRM blokidan
  // shu yerga ko'chirilgan. `employeePlan` esa `employee`dan keyin.
  "task",
  "employeePlan",
  // Xodim kategoriyalari: `employeeCategory` `business`dan keyin yetarli;
  // `employeeCategoryMember` employee VA employeeCategory'dan KEYIN;
  // `dealEmployee` esa deal (CRM bloki) VA shu ikkalasidan KEYIN turishi SHART —
  // uchalasiga FK bilan murojaat qiladi. Tartib buzilsa zaxira tiklanmaydi.
  "employeeCategory",
  "employeeCategoryMember",
  "dealEmployee",
  "attendance",
  // `attendanceSelfie` `attendanceCheck`dan OLDIN — Check.selfieId unga FK.
  "attendanceSelfie",
  "attendanceCheck",
  "penaltyRule",
  // `employeePenalty` employee/attendance/penaltyRule'dan KEYIN (uchalasiga FK).
  "employeePenalty",
  "employeeBonus",
  "hrSetting",
  "payroll",
  "payrollAdvance",
  // KPI moduli. TARTIB MUHIM: `kpiTask` `business`dan keyin yetarli;
  // `kpiTaskAssignment` va `kpiPointLog` — `kpiTask` VA `employee`dan KEYIN
  // (ikkalasiga ham FK); `kpiPenaltyPreset` — `kpiTask`dan keyin;
  // `kpiSalesTarget` — `employee`dan keyin; `kpiPayrollItem` va
  // `kpiPayrollAdjustment` — `kpiPayroll`dan KEYIN (`kpiPayrollItem` yana
  // `kpiTask`ka ham FK bilan murojaat qiladi). Tartib buzilsa zaxira
  // tiklanmaydi: "Foreign key constraint violated".
  "kpiSetting",
  "kpiSalesBracket",
  "kpiScoreRule",
  "kpiTask",
  "kpiTaskAssignment",
  "kpiPenaltyPreset",
  "kpiPointLog",
  "kpiSalesTarget",
  "kpiPayroll",
  "kpiPayrollItem",
  "kpiPayrollAdjustment",
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
  // Superadmin 2.0 — platforma darajasidagi bayroq, FK'siz (istalgan joyda tursa bo'ladi).
  "featureFlag",
  // Support tiketi tenant va user'ga FK bilan bog'liq — ikkalasidan KEYIN turadi.
  "supportTicket",
  // Tiket yozishmasi tiketdan KEYIN.
  "supportMessage",
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
  // AI copilot suhbati — vaqtinchalik kontekst, tiklashning ma'nosi yo'q.
  "aiSuhbat",
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
