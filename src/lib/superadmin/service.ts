import { randomInt } from "node:crypto";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { computeAccess } from "@/lib/billing/access";
import { planByCode } from "@/lib/billing/plans";
import { hashPassword } from "@/lib/auth/password";
import { BadRequestError } from "@/lib/auth/guard";
import { normalizeKompaniyaNomi } from "@/lib/services/signup";
import { MANAGER_ROLLAR } from "@/lib/auth/roles";
import { MODULLAR } from "@/lib/modules/registry";

/**
 * SUPERADMIN xizmat qatlami — barcha amallar rawPrisma bilan (tenantlar aro)
 * va MAJBURIY audit log bilan bajariladi. Faqat requireSuperadmin* guard'idan
 * o'tgan route'lar chaqiradi.
 */

/** Superadmin amalini audit jurnaliga yozadi (kim, qachon, nima). */
export async function logSuperadminAction(params: {
  superadminId: string;
  superadminIsm: string;
  action: string; // "impersonate" | "extend" | "block" | "unblock" | "payment_confirm" | "payment_reject" | "password_reset"
  entity: string; // "tenant" | "payment" | "user"
  entityId: string;
  detail?: Record<string, unknown>;
}) {
  await rawPrisma.auditLog.create({
    data: {
      businessId: null,
      userId: params.superadminId,
      userIsm: `[SUPERADMIN] ${params.superadminIsm}`,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      after: params.detail ? JSON.stringify(params.detail) : null,
    },
  });
}

export interface TenantOverview {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  createdAt: Date;
  /** Amaldagi muddat (TRIAL -> trialEndsAt, aks holda currentPeriodEnd). */
  deadline: Date | null;
  accessMode: string;
  userCount: number;
  businessCount: number;
  lastActivity: Date | null;
  pendingPayments: number;
  /** Shu nomdagi boshqa kompaniya ham bor — ehtimoliy takror ro'yxatdan o'tish. */
  takrorMi: boolean;
  /** Ma'lumot kiritilmagan (tranzaksiya/mahsulot/qarz yo'q) — xavfsiz o'chirsa bo'ladi. */
  bosh: boolean;
  /**
   * Telegram ulagan direktor bormi. Yo'q bo'lsa obuna eslatmalari yetib
   * bormaydi — bunday mijozga qo'ng'iroq qilish kerak.
   */
  telegramUlangan: boolean;
  /** Doimiy bepul mijoz (to'lov talab qilinmaydi). */
  bepul: boolean;
}

/** Barcha tenantlar ro'yxati (panel jadvali uchun). */
export async function listTenantsOverview(): Promise<TenantOverview[]> {
  const tenants = await rawPrisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { select: { lastLoginAt: true, rol: true, telegramChatId: true, isActive: true } },
      _count: { select: { users: true, businesses: true } },
    },
  });
  const pending = await rawPrisma.payment.groupBy({
    by: ["tenantId"],
    where: { status: "PENDING" },
    _count: { _all: true },
  });
  const pendingMap = new Map(pending.map((p) => [p.tenantId, p._count._all]));

  // Bir xil nomli kompaniyalar — takror ro'yxatdan o'tish belgisi (masalan
  // "RedFlora" va "RedFlora" ikki marta). Nom registr/apostrofsiz solishtiriladi.
  const nomSoni = new Map<string, number>();
  for (const t of tenants) {
    const kalit = normalizeKompaniyaNomi(t.name);
    nomSoni.set(kalit, (nomSoni.get(kalit) ?? 0) + 1);
  }

  // Qaysi tenantlarda umuman ish ma'lumoti bor — bo'sh dublikatni ajratish uchun.
  const bandTenantlar = await tenantsWithData();

  return tenants.map((t) => {
    const lastActivity = t.users.reduce<Date | null>((acc, u) => {
      if (!u.lastLoginAt) return acc;
      return !acc || u.lastLoginAt > acc ? u.lastLoginAt : acc;
    }, null);
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      plan: t.plan,
      createdAt: t.createdAt,
      deadline: t.status === "TRIAL" ? t.trialEndsAt : t.currentPeriodEnd,
      accessMode: computeAccess(t).mode,
      userCount: t._count.users,
      businessCount: t._count.businesses,
      lastActivity,
      pendingPayments: pendingMap.get(t.id) ?? 0,
      takrorMi: (nomSoni.get(normalizeKompaniyaNomi(t.name)) ?? 0) > 1,
      bosh: !bandTenantlar.has(t.id),
      telegramUlangan: t.users.some(
        (u) => u.isActive && !!u.telegramChatId && MANAGER_ROLLAR.includes(u.rol as never)
      ),
      bepul: t.bepul,
    };
  });
}

/**
 * Ish ma'lumoti (tranzaksiya, mahsulot, sotuv, qarz, kontakt, bitim, vazifa)
 * kiritilgan tenantlar to'plami. Bo'sh tenant — xatoga ochilgan dublikat.
 */
async function tenantsWithData(): Promise<Set<string>> {
  const bandlar = new Set<string>();
  const bizneslar = await rawPrisma.business.findMany({
    select: {
      tenantId: true,
      // Biznesga bog'lanadigan BARCHA "ish" yozuvlari — biror joyda yozuv bo'lsa
      // tenant bo'sh emas (aks holda o'chirishda FK cheklovi ishga tushardi).
      _count: {
        select: {
          transactions: true,
          products: true,
          sales: true,
          debts: true,
          contacts: true,
          deals: true,
          tasks: true,
          budgets: true,
          shiftCloses: true,
          recurrings: true,
          transfers: true,
        },
      },
    },
  });
  for (const b of bizneslar) {
    const jami = Object.values(b._count).reduce((a, n) => a + n, 0);
    if (jami > 0) bandlar.add(b.tenantId);
  }
  return bandlar;
}

/**
 * BO'SH tenantni butunlay o'chiradi — faqat xatoga ochilgan takror yozuvlar uchun.
 * Ish ma'lumoti (tranzaksiya/mahsulot/sotuv/qarz/CRM/vazifa) yoki tasdiqlangan
 * to'lovi bo'lsa o'chirilmaydi: bunday tenantni bloklash kerak, o'chirish emas.
 */
export async function deleteEmptyTenant(tenantId: string): Promise<{ name: string }> {
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) throw new BadRequestError("Kompaniya topilmadi");

  const band = await tenantsWithData();
  if (band.has(tenantId)) {
    throw new BadRequestError(
      "Bu kompaniyada ish ma'lumotlari bor — o'chirib bo'lmaydi. Kerak bo'lsa bloklang."
    );
  }
  const tolov = await rawPrisma.payment.count({ where: { tenantId, status: "CONFIRMED" } });
  if (tolov > 0) {
    throw new BadRequestError("Bu kompaniyada tasdiqlangan to'lov bor — o'chirib bo'lmaydi.");
  }

  const bizneslar = await rawPrisma.business.findMany({ where: { tenantId }, select: { id: true } });
  const businessIds = bizneslar.map((b) => b.id);

  // Bog'liq yozuvlar chetdan markazga: kategoriya/audit -> biznes -> tenant.
  await rawPrisma.$transaction(async (tx) => {
    if (businessIds.length > 0) {
      await tx.category.deleteMany({ where: { businessId: { in: businessIds } } });
      await tx.auditLog.deleteMany({ where: { businessId: { in: businessIds } } });
      await tx.stage.deleteMany({ where: { businessId: { in: businessIds } } });
      // Kassalar (Faza 4.1) — har biznesda kamida bittasi bo'ladi, shuning uchun
      // ular ham biznesdan OLDIN o'chirilishi shart (Account.businessId Restrict).
      await tx.accountTransfer.deleteMany({ where: { businessId: { in: businessIds } } });
      await tx.account.deleteMany({ where: { businessId: { in: businessIds } } });
    }
    await tx.auditLog.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });
    await tx.business.deleteMany({ where: { tenantId } });
    await tx.tenantModule.deleteMany({ where: { tenantId } });
    await tx.subscription.deleteMany({ where: { tenantId } });
    await tx.payment.deleteMany({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
  });

  return { name: tenant.name };
}

export interface Metrics {
  jamiTenant: number;
  faolObuna: number;
  sinovda: number;
  bloklangan: number;
  /** Oylik takrorlanuvchi tushum (so'm) — faol obunadagi tenantlar tarifi yig'indisi. */
  mrr: number;
}

/**
 * MODUL STATISTIKASI — qaysi modulni nechta kompaniya yoqqan.
 *
 * Nega kerak: "nechta mijozimizda kassa ishlayapti" savoliga javob bo'lmasa,
 * modul rivojiga qancha kuch sarflashni ham, kimga qo'ng'iroq qilishni ham
 * bilib bo'lmaydi.
 *
 * `MAGAZIN` uchun alohida raqam ham chiqadi: modul yoqilgan bo'lsa ham,
 * hech bir bizneste kassa belgilanmagan bo'lsa u AMALDA ishlamayapti —
 * bunday mijozga yordam kerak.
 */
export interface ModulStat {
  code: string;
  nomi: string;
  /** Modulni yoqqan kompaniyalar soni. */
  tenantlar: number;
}

export interface ModulStatistika {
  modullar: ModulStat[];
  /** Ombor yuritiladigan bizneslar soni. */
  omborliBizneslar: number;
  /** Kassa (POS) yoqilgan bizneslar soni. */
  magazinBizneslar: number;
  /** MAGAZIN moduli yoqilgan, lekin bironta biznesda kassa belgilanmagan kompaniyalar. */
  magazinYarimSozlangan: number;
}

export async function getModulStatistika(): Promise<ModulStatistika> {
  const [rows, omborliBizneslar, magazinBizneslar, magazinliTenantIdlar] = await Promise.all([
    rawPrisma.tenantModule.groupBy({
      by: ["code"],
      where: { isActive: true },
      _count: { _all: true },
    }),
    rawPrisma.business.count({ where: { omborli: true } }),
    rawPrisma.business.count({ where: { magazin: true } }),
    rawPrisma.business.findMany({ where: { magazin: true }, select: { tenantId: true } }),
  ]);

  const sonMap = new Map(rows.map((r) => [r.code, r._count._all]));
  const modullar = MODULLAR.filter((m) => !m.core).map((m) => ({
    code: m.code,
    nomi: m.nomi,
    tenantlar: sonMap.get(m.code) ?? 0,
  }));

  const magazinliTenantlar = new Set(magazinliTenantIdlar.map((b) => b.tenantId));
  const magazinModuli = await rawPrisma.tenantModule.findMany({
    where: { code: "MAGAZIN", isActive: true },
    select: { tenantId: true },
  });
  const magazinYarimSozlangan = magazinModuli.filter(
    (m) => !magazinliTenantlar.has(m.tenantId)
  ).length;

  return { modullar, omborliBizneslar, magazinBizneslar, magazinYarimSozlangan };
}

/**
 * Bitta tenantning modul holati (superadmin paneli uchun).
 * Tarifda yo'q modul ham ko'rsatiladi — superadmin sababni ko'rishi kerak.
 */
export interface TenantModulHolat {
  code: string;
  nomi: string;
  core: boolean;
  tarifdaBor: boolean;
  yoqilgan: boolean;
}

export async function getTenantModullari(tenantId: string): Promise<TenantModulHolat[]> {
  const [tenant, rows] = await Promise.all([
    rawPrisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } }),
    rawPrisma.tenantModule.findMany({ where: { tenantId }, select: { code: true, isActive: true } }),
  ]);
  if (!tenant) throw new BadRequestError("Tenant topilmadi");
  const holat = new Map(rows.map((r) => [r.code, r.isActive]));
  const plan = planByCode(tenant.plan);
  return MODULLAR.filter((m) => !m.korinmas).map((m) => ({
    code: m.code,
    nomi: m.nomi,
    core: m.core,
    tarifdaBor: m.core || (plan?.modullar.includes(m.code) ?? false),
    yoqilgan: m.core || (holat.get(m.code) ?? false),
  }));
}

/**
 * Tenantning modulini superadmin nomidan yoqadi/o'chiradi.
 *
 * O'CHIRISH MA'LUMOTGA TEGMAYDI: faqat `TenantModule.isActive` bayrog'i
 * o'zgaradi. Sotuvlar, cheklar, mahsulotlar, ombor harakati va tarix
 * bazada joyida qoladi — modul qayta yoqilsa hammasi ko'rinadi. Bu ataylab
 * shunday: mijoz modulni vaqtincha o'chirib, keyin qaytarishi odatiy holat.
 */
export async function setTenantModul(params: {
  tenantId: string;
  code: string;
  isActive: boolean;
}): Promise<{ code: string; isActive: boolean }> {
  const modul = MODULLAR.find((m) => m.code === params.code);
  if (!modul || modul.korinmas) throw new BadRequestError("Noma'lum modul");
  if (modul.core) throw new BadRequestError("Asosiy modulni o'chirib bo'lmaydi");

  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new BadRequestError("Tenant topilmadi");
  if (params.isActive && !planByCode(tenant.plan)?.modullar.includes(params.code)) {
    throw new BadRequestError(`"${modul.nomi}" moduli ${tenant.plan} tarifida mavjud emas`);
  }

  const bor = await rawPrisma.tenantModule.findFirst({
    where: { tenantId: params.tenantId, code: params.code },
    select: { id: true },
  });
  if (bor) {
    await rawPrisma.tenantModule.update({ where: { id: bor.id }, data: { isActive: params.isActive } });
  } else {
    await rawPrisma.tenantModule.create({
      data: { tenantId: params.tenantId, code: params.code, isActive: params.isActive },
    });
  }
  return { code: params.code, isActive: params.isActive };
}

export async function getMetrics(): Promise<Metrics> {
  const tenants = await rawPrisma.tenant.findMany({ select: { status: true, plan: true } });
  let faolObuna = 0;
  let sinovda = 0;
  let bloklangan = 0;
  let mrr = 0;
  for (const t of tenants) {
    if (t.status === "ACTIVE") {
      faolObuna++;
      mrr += planByCode(t.plan)?.oylikNarx ?? 0;
    } else if (t.status === "TRIAL") {
      sinovda++;
    } else if (t.status === "BLOCKED") {
      bloklangan++;
    }
  }
  return { jamiTenant: tenants.length, faolObuna, sinovda, bloklangan, mrr };
}

/** Tenantni bloklaydi. */
export async function blockTenant(tenantId: string) {
  return rawPrisma.tenant.update({ where: { id: tenantId }, data: { status: "BLOCKED" } });
}

/**
 * Blokdan chiqaradi — status sanalarga qarab tiklanadi:
 * trial hali tugamagan -> TRIAL; obuna davri tugamagan -> ACTIVE; aks holda PAST_DUE.
 */
export function resolveUnblockStatus(
  t: { trialEndsAt: Date | null; currentPeriodEnd: Date | null },
  now: Date = new Date()
): "TRIAL" | "ACTIVE" | "PAST_DUE" {
  if (t.currentPeriodEnd && t.currentPeriodEnd.getTime() > now.getTime()) return "ACTIVE";
  if (t.trialEndsAt && t.trialEndsAt.getTime() > now.getTime()) return "TRIAL";
  return "PAST_DUE";
}

export async function unblockTenant(tenantId: string, now: Date = new Date()) {
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new BadRequestError("Tenant topilmadi");
  return rawPrisma.tenant.update({
    where: { id: tenantId },
    data: { status: resolveUnblockStatus(tenant, now) },
  });
}

/** Foydalanuvchi parolini tiklaydi (yangi parol qaytariladi — bir marta ko'rsatiladi). */
export async function resetUserPassword(userId: string): Promise<{ login: string; yangiParol: string }> {
  const user = await rawPrisma.user.findUnique({ where: { id: userId }, select: { id: true, login: true } });
  if (!user) throw new BadRequestError("Foydalanuvchi topilmadi");
  // 10 belgili tasodifiy parol (o'qilishi oson belgilar: 0/O, 1/l/I yo'q).
  //
  // `crypto.randomInt` — `Math.random` EMAS. `Math.random` kriptografik emas:
  // uning ichki holati bir necha natijadan tiklanadi, ya'ni parolni bashorat
  // qilish mumkin. Bu parol esa hisobga to'liq kirish huquqini beradi.
  // (Telegram bog'lash kodida shu xato allaqachon tuzatilgan edi — bu yer
  // o'shanda e'tibordan chetda qolgan.)
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let yangiParol = "";
  for (let i = 0; i < 10; i++) {
    yangiParol += alphabet[randomInt(0, alphabet.length)];
  }
  await rawPrisma.user.update({
    where: { id: userId },
    data: { parolHash: await hashPassword(yangiParol), mustChangePassword: true },
  });
  return { login: user.login, yangiParol };
}

/** Impersonatsiya uchun tenantning birinchi faol boshqaruvchisini (OWNER, bo'lmasa ADMIN) topadi. */
export async function findImpersonationTarget(tenantId: string) {
  const owner = await rawPrisma.user.findFirst({
    where: { tenantId, isActive: true, rol: "OWNER" },
    orderBy: { createdAt: "asc" },
  });
  if (owner) return owner;
  return rawPrisma.user.findFirst({
    where: { tenantId, isActive: true, rol: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
}
