import { rawPrisma } from "@/lib/db/rawPrisma";
import { BadRequestError } from "@/lib/auth/guard";
import { createTenantWithOwner, findRecentDuplicateTenant } from "@/lib/services/signup";
import { planByCode } from "@/lib/billing/plans";

const KUN_MS = 24 * 60 * 60 * 1000;

export interface YangiMijozParams {
  /** Kompaniya nomi — biznes ham shu nom bilan ochiladi. */
  nom: string;
  /** OWNER logini (telefon yoki matn). Global unique. */
  login: string;
  parol: string;
  /** OWNER ismi (bo'lmasa kompaniya nomi). */
  ism?: string | null;
  /** Tarif kodi: STANDARD | AVTO | PRO. */
  tarif: string;
  /** Biznes turi: "umumiy" | "avto". */
  turi: "umumiy" | "avto";
  /** Obuna kunlari. 0 → 14 kunlik TRIAL holida qoladi. */
  kunlar: number;
}

/**
 * TIZIM-DARAJALI: yangi mijoz (tenant) yaratadi — superadmin paneli va
 * `npm run client:create` skripti shu funksiyani chaqiradi (bitta manba).
 *
 * Tenant + OWNER + biznes + kategoriyalar `createTenantWithOwner` da bitta
 * tranzaksiyada yaratiladi; kunlar berilsa obuna darhol ACTIVE qilinadi.
 */
export async function createClientTenant(params: YangiMijozParams) {
  const nom = params.nom.trim();
  const login = params.login.trim();
  if (!nom) throw new BadRequestError("Kompaniya nomi kiritilishi shart");
  if (!login) throw new BadRequestError("Login kiritilishi shart");
  if (params.parol.length < 8) throw new BadRequestError("Parol kamida 8 belgi bo'lishi kerak");
  if (params.turi !== "umumiy" && params.turi !== "avto") {
    throw new BadRequestError("Biznes turi 'umumiy' yoki 'avto' bo'lishi kerak");
  }
  const plan = planByCode(params.tarif);
  if (!plan) throw new BadRequestError(`'${params.tarif}' tarifi mavjud emas`);
  if (!Number.isFinite(params.kunlar) || params.kunlar < 0) {
    throw new BadRequestError("Obuna kunlari musbat son bo'lishi kerak");
  }

  const band = await rawPrisma.user.findUnique({ where: { login }, select: { id: true } });
  if (band) throw new BadRequestError(`'${login}' logini allaqachon band`);

  // Tugma ikki marta bosilsa ikkinchi mijoz ochilib ketmasin.
  const takror = await findRecentDuplicateTenant(nom);
  if (takror) {
    throw new BadRequestError(
      `'${takror.name}' hozirgina yaratilgan (${takror.slug}). Takror yaratilmadi — ro'yxatni tekshiring.`
    );
  }

  // eslint-disable-next-line prefer-const -- tenant obuna yoqilganda yangilanadi
  let { tenant, user, business } = await createTenantWithOwner({
    kompaniyaNomi: nom,
    ism: params.ism?.trim() || nom,
    login,
    parol: params.parol,
    biznesTuri: params.turi,
    plan: plan.code,
  });

  let periodEnd: Date | null = null;
  if (params.kunlar > 0) {
    const now = new Date();
    periodEnd = new Date(now.getTime() + params.kunlar * KUN_MS);
    await rawPrisma.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: plan.code,
        status: "ACTIVE",
        periodStart: now,
        periodEnd,
        amount: plan.oylikNarx,
      },
    });
    // Yangilangan tenant qaytariladi — chaqiruvchi eski (TRIAL) holatni ko'rmasligi uchun.
    tenant = await rawPrisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "ACTIVE", currentPeriodEnd: periodEnd },
    });
  }

  return { tenant, user, business, plan, periodEnd };
}
