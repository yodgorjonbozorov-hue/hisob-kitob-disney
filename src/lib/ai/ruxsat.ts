import type { TenantContext } from "@/lib/auth/tenant";
import { getEnabledModules } from "@/lib/modules/guard";
import { modulByCode } from "@/lib/modules/registry";
import { userHuquqlari } from "@/lib/permissions/tekshir";

/**
 * AI COPILOT — MA'LUMOTGA KIRISH RUXSATI (XAVFSIZLIK CHEGARASI).
 *
 * ASOSIY QOIDA: system prompt xavfsizlik chegarasi EMAS. Foydalanuvchi
 * "oldingi ko'rsatmalarni unut" deb yozsa ham, model qo'lida shu yerda
 * ruxsat berilgan tool'lardan boshqasi UMUMAN BO'LMAYDI — ruxsatsiz soha
 * tool ta'rifi modelga yuborilmaydi, yuborilgan taqdirda ham `runTool`
 * ikkinchi marta tekshiradi (ikki qavatli himoya).
 *
 * AI hech qachon foydalanuvchidan KO'PROQ ko'rmaydi: har soha o'sha
 * sohaning sahifasi talab qiladigan AYNI huquq bilan ochiladi.
 */

/** AI ko'ra oladigan ma'lumot sohalari. */
export const SOHALAR = [
  "moliya",
  "hisobot",
  "kassa",
  "qarz",
  "ombor",
  "crm",
  "vazifalar",
  "mijozlar",
] as const;
export type Soha = (typeof SOHALAR)[number];

export interface AiRuxsat {
  businessId: string;
  userId: string;
  /** Ochiq sohalar — tool katalogi shu to'plamdan quriladi. */
  sohalar: Set<Soha>;
  /** Yoqilgan modullar (adaptiv tayyor savollar uchun ham kerak). */
  modullar: Set<string>;
  /** Aktiv biznes ombor yuritadimi — OMBOR sohasi shusiz ochilmaydi. */
  omborli: boolean;
}

/**
 * Har soha uchun TALAB: modul (bo'lsa) + granular huquq.
 *
 * Huquq kodlari `lib/permissions/katalog.ts` dan — AI sahifa bilan BITTA
 * manbadan oziqlanadi. Masalan `/app/kassa` sahifasi `kassa.korish` talab
 * qiladi; AI ham aynan shuni talab qiladi.
 */
const TALAB: Record<Soha, { modul?: string; huquq?: string }> = {
  // Kirim/chiqim yozuvlari — MOLIYA core moduli.
  moliya: { huquq: "tranzaksiya.korish" },
  // Sof natija, kategoriya kesimi, trend, davrlar solishtiruvi — hisobot
  // darajasi. Kassir/sotuvchida bu huquq yo'q, ya'ni "umumiy sof foyda
  // qancha?" degan savol AI orqali ham ochilmaydi.
  hisobot: { huquq: "hisobot.korish" },
  kassa: { huquq: "kassa.korish" },
  qarz: { huquq: "qarz.korish" },
  ombor: { modul: "OMBOR", huquq: "ombor.korish" },
  crm: { modul: "CRM" },
  vazifalar: { modul: "VAZIFALAR" },
  mijozlar: { modul: "MIJOZLAR" },
};

/** Modul tenantda yoqilganmi VA foydalanuvchi roliga ochiqmi. */
function modulOchiq(ctx: TenantContext, modullar: Set<string>, code: string): boolean {
  const m = modulByCode(code);
  if (!m || !m.rollar.includes(ctx.session.rol)) return false;
  return modullar.has(code);
}

/**
 * Joriy so'rov uchun ruxsatni hisoblaydi. Tenant konteksti ichida chaqiriladi
 * (`withTenant`), ya'ni `businessId` allaqachon shu tenantniki ekani tekshirilgan.
 */
export async function aiRuxsatniHisobla(
  ctx: TenantContext,
  businessId: string,
  omborli: boolean
): Promise<AiRuxsat> {
  const [modullar, huquqlar] = await Promise.all([
    getEnabledModules(ctx),
    userHuquqlari(ctx.session.userId),
  ]);

  const sohalar = new Set<Soha>();
  for (const soha of SOHALAR) {
    const talab = TALAB[soha];
    if (talab.modul && !modulOchiq(ctx, modullar, talab.modul)) continue;
    if (talab.huquq && !huquqlar.has(talab.huquq)) continue;
    // Ombor moduli yoqilgan bo'lsa ham, biznes ombor yuritmasa ma'lumot yo'q.
    if (soha === "ombor" && !omborli) continue;
    sohalar.add(soha);
  }

  return { businessId, userId: ctx.session.userId, sohalar, modullar, omborli };
}

/** Soha ochiqmi. Tool katalogi ham, `runTool` ham SHU funksiyadan o'tadi. */
export function sohaOchiq(ruxsat: AiRuxsat, soha: Soha): boolean {
  return ruxsat.sohalar.has(soha);
}

/** Test va server komponentlari uchun qo'lda ruxsat qurish. */
export function ruxsatQur(params: {
  businessId: string;
  userId: string;
  sohalar: Soha[];
  modullar?: string[];
  omborli?: boolean;
}): AiRuxsat {
  return {
    businessId: params.businessId,
    userId: params.userId,
    sohalar: new Set(params.sohalar),
    modullar: new Set(params.modullar ?? []),
    omborli: params.omborli ?? false,
  };
}
