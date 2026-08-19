import { rawPrisma } from "@/lib/db/rawPrisma";
import { BadRequestError } from "@/lib/auth/guard";
import { MODULLAR, modulByCode } from "@/lib/modules/registry";
import { yoqishMumkinmi, ochirishMumkinmi, talabQiladi, tayanadiganlar } from "@/lib/modules/bogliqlik";
import { planByCode } from "@/lib/billing/plans";
import { SA_AMAL } from "./audit";

/**
 * TENANT MODULLARI — superadmin tomonidan boshqarish (talab 12/13).
 *
 * MUHIM QOIDA: modul O'CHIRILGANDA MA'LUMOT O'CHMAYDI. `TenantModule.isActive`
 * false bo'ladi, xolos — jadvallardagi barcha yozuv joyida qoladi va modul
 * qayta yoqilganda eski ma'lumot AYNAN qaytadi. Bu servisda hech qanday
 * `delete` amali YO'Q va bu ataylab shunday.
 */

export interface ModulHolati {
  code: string;
  nomi: string;
  tavsif: string;
  core: boolean;
  /** Amalda yoqiqmi (core -> har doim). */
  yoqilgan: boolean;
  /** Tenant tarifida bu modul bormi. */
  tarifdaBor: boolean;
  /** Kerak bo'ladigan modullar va unga tayanadiganlar (UI tushuntirishi uchun). */
  talablar: string[];
  tayanadiganlar: string[];
  /** TenantModule yozuvi yaratilgan payt (birinchi marta yoqilgan). */
  createdAt: Date | null;
  /** Oxirgi yoqish/o'chirish — audit jurnalidan (kim va qachon). */
  oxirgiOzgarish: { amal: string; kim: string | null; qachon: Date; sabab: string | null } | null;
}

/** Audit jurnalidagi modul yozuvining `entityId` formati. */
export function modulEntityId(tenantId: string, code: string): string {
  return `${tenantId}:${code}`;
}

/**
 * Kompaniyaning modul holati.
 *
 * "Kim yoqdi / kim o'chirdi" ATAYLAB audit jurnalidan olinadi: `TenantModule`
 * jadvalida bunday ustun yo'q va uni qo'shish tarixni bermasdi (faqat oxirgi
 * qiymat). Audit esa append-only — u to'liq tarixni saqlaydi.
 */
export async function tenantModulHolati(tenantId: string): Promise<ModulHolati[]> {
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new BadRequestError("Kompaniya topilmadi");
  const plan = planByCode(tenant.plan);
  const planModullari = new Set(plan?.modullar ?? []);

  const rows = await rawPrisma.tenantModule.findMany({
    where: { tenantId },
    select: { code: true, isActive: true, createdAt: true },
  });
  const rowMap = new Map(rows.map((r) => [r.code, r]));

  const auditlar = await rawPrisma.auditLog.findMany({
    where: {
      entity: "module",
      entityId: { startsWith: `${tenantId}:` },
      action: { in: [SA_AMAL.MODULE_ENABLED, SA_AMAL.MODULE_DISABLED] },
    },
    orderBy: { createdAt: "desc" },
    select: { action: true, userIsm: true, createdAt: true, sabab: true, entityId: true },
  });
  const oxirgiMap = new Map<string, (typeof auditlar)[number]>();
  for (const a of auditlar) {
    const code = a.entityId.split(":")[1];
    if (code && !oxirgiMap.has(code)) oxirgiMap.set(code, a);
  }

  return MODULLAR.filter((m) => !m.korinmas).map((m) => {
    const row = rowMap.get(m.code);
    const oxirgi = oxirgiMap.get(m.code);
    return {
      code: m.code,
      nomi: m.nomi,
      tavsif: m.tavsif,
      core: m.core,
      yoqilgan: m.core || (!!row?.isActive && planModullari.has(m.code)),
      tarifdaBor: m.core || planModullari.has(m.code),
      talablar: talabQiladi(m.code),
      tayanadiganlar: tayanadiganlar(m.code),
      createdAt: row?.createdAt ?? null,
      oxirgiOzgarish: oxirgi
        ? {
            amal: oxirgi.action,
            kim: oxirgi.userIsm,
            qachon: oxirgi.createdAt,
            sabab: oxirgi.sabab,
          }
        : null,
    };
  });
}

/** Hozir amalda yoqiq modul kodlari (core'lar bilan). */
async function yoqilganTuplam(tenantId: string): Promise<Set<string>> {
  const holat = await tenantModulHolati(tenantId);
  return new Set(holat.filter((m) => m.yoqilgan).map((m) => m.code));
}

export interface ModulOzgartirishNatija {
  code: string;
  nomi: string;
  isActive: boolean;
  amal: typeof SA_AMAL.MODULE_ENABLED | typeof SA_AMAL.MODULE_DISABLED;
  /** Oldingi holat — audit `before` uchun. */
  oldingi: boolean;
}

/**
 * Modulni yoqadi yoki o'chiradi.
 *
 * Tekshiruvlar (hammasi serverda):
 *  1. modul katalogda bor va yashirin emas;
 *  2. core modul o'chirilmaydi;
 *  3. yoqishda — tenant tarifida bo'lishi shart;
 *  4. yoqishda — talab qilinadigan modullar yoqiq bo'lishi shart;
 *  5. o'chirishda — bu modulga tayanadigan yoqiq modul qolmasligi shart.
 */
export async function modulniOzgartir(
  tenantId: string,
  code: string,
  isActive: boolean
): Promise<ModulOzgartirishNatija> {
  const modul = modulByCode(code);
  if (!modul || modul.korinmas) throw new BadRequestError("Noma'lum modul");
  if (modul.core) throw new BadRequestError("Asosiy modulni o'chirib bo'lmaydi");

  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new BadRequestError("Kompaniya topilmadi");

  const yoqilgan = await yoqilganTuplam(tenantId);
  const oldingi = yoqilgan.has(code);

  if (isActive) {
    const plan = planByCode(tenant.plan);
    if (!plan?.modullar.includes(code)) {
      throw new BadRequestError(
        `"${modul.nomi}" moduli ${plan?.nomi ?? tenant.plan} tarifida mavjud emas — avval tarifni ko'taring`
      );
    }
    const b = yoqishMumkinmi(code, yoqilgan);
    if (!b.ok) throw new BadRequestError(b.xabar ?? "Bog'liq modul yoqilmagan");
  } else {
    const b = ochirishMumkinmi(code, yoqilgan);
    if (!b.ok) throw new BadRequestError(b.xabar ?? "Bu modulga boshqa modul tayanadi");
  }

  // MA'LUMOT O'CHIRILMAYDI — faqat bayroq almashadi.
  const mavjud = await rawPrisma.tenantModule.findFirst({
    where: { tenantId, code },
    select: { id: true },
  });
  if (mavjud) {
    await rawPrisma.tenantModule.update({ where: { id: mavjud.id }, data: { isActive } });
  } else {
    await rawPrisma.tenantModule.create({ data: { tenantId, code, isActive } });
  }

  return {
    code,
    nomi: modul.nomi,
    isActive,
    amal: isActive ? SA_AMAL.MODULE_ENABLED : SA_AMAL.MODULE_DISABLED,
    oldingi,
  };
}

export interface ModulQamrovi {
  code: string;
  nomi: string;
  /** Necha kompaniyada yoqiq. */
  soni: number;
  /** Necha kompaniya tarifida mavjud (potensial). */
  imkoniyat: number;
}

/** Platforma bo'ylab modul qo'llanishi (dashboard: "Module Adoption"). */
export async function modulQamrovi(): Promise<ModulQamrovi[]> {
  const [jamiTenant, tariflar, yoqilganlar] = await Promise.all([
    rawPrisma.tenant.count(),
    rawPrisma.tenant.groupBy({ by: ["plan"], _count: { _all: true } }),
    rawPrisma.tenantModule.groupBy({
      by: ["code"],
      where: { isActive: true },
      _count: { _all: true },
    }),
  ]);
  const yoqMap = new Map(yoqilganlar.map((r) => [r.code, r._count._all]));

  return MODULLAR.filter((m) => !m.korinmas).map((m) => {
    const imkoniyat = m.core
      ? jamiTenant
      : tariflar.reduce(
          (acc, t) => acc + (planByCode(t.plan)?.modullar.includes(m.code) ? t._count._all : 0),
          0
        );
    return {
      code: m.code,
      nomi: m.nomi,
      soni: m.core ? jamiTenant : (yoqMap.get(m.code) ?? 0),
      imkoniyat,
    };
  });
}
