import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { resolveActiveBusinessId } from "@/lib/business";
import { qarzMijozlariTakror, mijozOchiqQarzi } from "@/lib/queries/qarz";
import { yangiMijozSchema } from "@/lib/validation/qarz";
import { qarzMijozYarat } from "@/lib/services/mijozAniqla";
import { isModuleOnForTenant } from "@/lib/modules/guard";

/**
 * Qarz formasidagi mijoz qidiruvi (autocomplete).
 *
 * `/api/mijozlar` dan alohida, chunki u MIJOZLAR moduliga bog'langan —
 * qarz esa modulsiz ham yozilishi kerak. Bu yerdagi manba ikkita: mijoz
 * kartochkalari va oldingi qarzlardagi ism/telefon.
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);

  const params = new URL(request.url).searchParams;

  // `?contactId=` — bitta mijozning joriy qarzi (qarzga sotish oynasidagi
  // "Hozirgi qarz" paneli uchun). Qidiruv ro'yxatini yuklashning hojati yo'q.
  const contactId = params.get("contactId");
  if (contactId) {
    return NextResponse.json({ ochiqQarz: await mijozOchiqQarzi(businessId, contactId) });
  }

  return NextResponse.json(await qarzMijozlariTakror(businessId, params.get("q")));
});

/**
 * "+ Yangi mijoz" — qarz/sotuv oynasini yopmasdan kartochka ochish.
 *
 * Nega alohida endpoint: kassir qarzga sotayotganda mijoz kartochkasi
 * DARHOL kerak — u yaratilib, o'sha zahoti tanlangan holatga o'tishi kerak.
 * Sotuvni yakunlashni kutib turish "yangi mijoz shu yerda paydo bo'ldimi"
 * degan ikkilanishni tug'dirardi.
 *
 * Takrorlanishdan himoya `mijozniAniqlaTx` da: shu ism/telefon bilan
 * kartochka allaqachon bo'lsa yangisi YARATILMAYDI, mavjudi qaytariladi.
 */
export const POST = withTenant(async (request, _ctx, tenantCtx) => {
  const user = tenantCtx.session;
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const parsed = yangiMijozSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  // MIJOZLAR moduli o'chirilgan bo'lsa kartochka yaratilmaydi — forma
  // kiritilgan ism/telefon bilan avvalgidek ishlayveradi.
  const mijozlarModuli = await isModuleOnForTenant(tenantCtx.tenantId, "MIJOZLAR");
  if (!mijozlarModuli) {
    return NextResponse.json({
      contactId: null,
      ism: parsed.data.ism,
      tel: parsed.data.tel,
      ochiqQarz: 0,
      mavjud: false,
    });
  }

  const mijoz = await qarzMijozYarat({
    businessId,
    userId: user.userId,
    ism: parsed.data.ism,
    tel: parsed.data.tel,
    izoh: parsed.data.izoh,
  });
  return NextResponse.json(mijoz, { status: 201 });
});
