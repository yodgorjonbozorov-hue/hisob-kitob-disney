import { NextRequest, NextResponse } from "next/server";
// Signup tizim-darajali amal (tenant endi yaratilmoqda) — rawPrisma.
import { rawPrisma } from "@/lib/db/rawPrisma";
import { getSession } from "@/lib/auth/session";
import { signupSchema, normalizePhone } from "@/lib/validation/auth";
import { createTenantWithOwner, findRecentDuplicateTenant } from "@/lib/services/signup";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/services/audit";

/**
 * Yangi kompaniya ro'yxatdan o'tishi: Tenant (TRIAL, 14 kun) + OWNER + default
 * biznes + boshlang'ich kategoriyalar — bitta tranzaksiyada. Muvaffaqiyatda
 * foydalanuvchi darhol tizimga kiritiladi (sessiya ochiladi).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  // Bir IP dan soatiga 5 ta ro'yxatdan o'tish urinishi.
  const rl = await rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Juda ko'p urinish. ${rl.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const login = normalizePhone(parsed.data.telefon);
  if (login.replace("+", "").length < 9) {
    return NextResponse.json({ error: "Telefon raqam noto'g'ri" }, { status: 400 });
  }

  // Login (telefon) butun tizim bo'ylab unique.
  const existing = await rawPrisma.user.findUnique({ where: { login }, select: { id: true } });
  if (existing) {
    return NextResponse.json(
      { error: "Bu telefon raqam allaqachon ro'yxatdan o'tgan. Tizimga kiring." },
      { status: 409 }
    );
  }

  // Takroriy yuborish himoyasi: shu nomdagi kompaniya hozirgina ochilgan bo'lsa
  // ikkinchi tenant yaratilmaydi (tugma ikki marta bosilgan yoki so'rov qaytarilgan).
  const takror = await findRecentDuplicateTenant(parsed.data.kompaniya);
  if (takror) {
    return NextResponse.json(
      {
        error:
          "Bu nomdagi kompaniya hozirgina ro'yxatdan o'tdi. Tizimga kiring — ikkinchi marta " +
          "ro'yxatdan o'tish shart emas.",
      },
      { status: 409 }
    );
  }

  const { tenant, user } = await createTenantWithOwner({
    kompaniyaNomi: parsed.data.kompaniya,
    ism: parsed.data.ism,
    login,
    parol: parsed.data.parol,
  });

  // Darhol tizimga kiritamiz.
  const session = await getSession();
  session.userId = user.id;
  session.login = user.login;
  session.ism = user.ism;
  session.rol = "OWNER";
  session.tenantId = tenant.id;
  session.businessId = null;
  session.mustChangePassword = false;
  await session.save();

  return NextResponse.json({ ok: true, tenantSlug: tenant.slug }, { status: 201 });
}
