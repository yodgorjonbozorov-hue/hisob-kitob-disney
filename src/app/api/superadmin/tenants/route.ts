import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { createTenantBySuperadmin, logSuperadminAction } from "@/lib/superadmin/service";
import { normalizePhone } from "@/lib/validation/auth";
import { PLANLAR } from "@/lib/billing/plans";
import { SETUP_FEE_USD, TRIAL_KUNLARI } from "@/lib/billing/constants";

const schema = z.object({
  kompaniyaNomi: z.string().trim().min(2, "Kompaniya nomi kamida 2 belgi bo'lsin").max(100),
  direktorIsmi: z.string().trim().min(1, "Direktor ismini kiriting").max(100),
  telefon: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{9,17}$/, "Telefon raqam noto'g'ri (masalan: +998901234567)"),
  plan: z.enum(PLANLAR.map((p) => p.code) as [string, ...string[]]),
  trialKunlari: z.number().int().min(0).max(366).default(TRIAL_KUNLARI),
  setupFeeOlindi: z.boolean().default(false),
  setupFeeAmountUsd: z.number().int().min(0).max(100_000).default(SETUP_FEE_USD),
});

/**
 * Yangi kompaniyani QO'LDA yaratish — mijozlar o'zi ro'yxatdan o'tmaydi.
 * Vaqtinchalik parol javobda BIR MARTA qaytariladi (bazada faqat hash);
 * audit jurnaliga parol EMAS, faqat kim/qachon/nima yaratgani yoziladi.
 */
export const POST = withSuperadmin(async (request, _routeCtx, session) => {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const login = normalizePhone(parsed.data.telefon);
  if (login.replace("+", "").length < 9) {
    return NextResponse.json({ error: "Telefon raqam noto'g'ri" }, { status: 400 });
  }

  const { tenant, user, vaqtinchalikParol } = await createTenantBySuperadmin({
    kompaniyaNomi: parsed.data.kompaniyaNomi,
    direktorIsmi: parsed.data.direktorIsmi,
    login,
    plan: parsed.data.plan,
    trialKunlari: parsed.data.trialKunlari,
    setupFeeAmountUsd: parsed.data.setupFeeOlindi ? parsed.data.setupFeeAmountUsd : undefined,
  });

  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: "tenant_create",
    entity: "tenant",
    entityId: tenant.id,
    detail: {
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      trialKunlari: parsed.data.trialKunlari,
      trialEndsAt: tenant.trialEndsAt,
      ownerLogin: user.login,
      setupFeeOlindi: parsed.data.setupFeeOlindi,
      setupFeeAmountUsd: parsed.data.setupFeeOlindi ? parsed.data.setupFeeAmountUsd : null,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan, trialEndsAt: tenant.trialEndsAt },
      login: user.login,
      // Bir martalik ko'rsatish uchun — boshqa hech qayerda saqlanmaydi/yuborilmaydi.
      vaqtinchalikParol,
    },
    { status: 201 }
  );
});
