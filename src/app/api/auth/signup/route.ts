import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { signupSchema } from "@/lib/validation/auth";
import { telE164 } from "@/lib/tel";
import { telefonBandmi } from "@/lib/auth/loginTop";
import { createTenantWithOwner, findRecentDuplicateTenant } from "@/lib/services/signup";
import { isBusinessType } from "@/lib/pricing/profil";
import { isAddonKey } from "@/lib/pricing/config";
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

  // Login — telefon E.164 ko'rinishida (`+998901234567`): foydalanuvchi uni
  // qanday yozganidan qat'i nazar bazaga bitta format tushadi (lib/tel.ts).
  const login = telE164(parsed.data.telefon);
  if (!login) {
    return NextResponse.json(
      {
        error:
          "Telefon raqam noto'g'ri. O'zbekiston raqami: +998 90 123 45 67. " +
          "Boshqa davlat raqamini + va davlat kodi bilan kiriting.",
      },
      { status: 400 }
    );
  }

  // Login (telefon) butun tizim bo'ylab unique — eski yozuvlardagi BARCHA
  // ko'rinishlar bo'yicha (`901234567` bilan ochilgan akkaunt ham hisobga olinadi).
  if (await telefonBandmi(login)) {
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

  // Onboarding tanlovlari ishonchsiz kirish: yaroqsiz qiymat jimgina
  // tashlab yuboriladi (xato emas) — ro'yxatdan o'tish baribir davom etadi.
  const yonalish = isBusinessType(parsed.data.yonalish) ? parsed.data.yonalish : undefined;
  const addons = (parsed.data.addons ?? []).filter(isAddonKey);

  const { tenant, user } = await createTenantWithOwner({
    kompaniyaNomi: parsed.data.kompaniya,
    ism: parsed.data.ism,
    login,
    parol: parsed.data.parol,
    yonalish,
    addons,
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
