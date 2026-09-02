import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { createUserSchema } from "@/lib/validation/user";
import { hashPassword } from "@/lib/auth/password";
import { requirePro } from "@/lib/billing/pro";
import { biznesIdlariniHalQil, biriktiruvlarniYangila, birlamchiBiznes } from "@/lib/services/userBiznes";
import { listXodimlar, xodimSanoqlari, xodimniOqi, type XodimHolat } from "@/lib/queries/xodimlar";
import { egalikTekshir } from "@/lib/services/userGuard";

const USER_SELECT = {
  id: true,
  ism: true,
  login: true,
  rol: true,
  isActive: true,
  createdAt: true,
  businessId: true,
  business: { select: { nomi: true } },
  // Ko'p-bizneslik: xodim biriktirilgan barcha bizneslar.
  bizneslar: { select: { businessId: true, business: { select: { nomi: true } } } },
  roleId: true,
  role: { select: { nomi: true, bazaRol: true } },
  huquqPlus: true,
  huquqMinus: true,
} as const;

/**
 * XODIMLAR RO'YXATI — qidiruv/filtr/sahifalash SERVERDA.
 *
 * Ilgari bu route BARCHA xodimlarni bir massivda qaytarardi va filtrlash
 * brauzerda bo'lardi. 500+ xodimda bu qabul qilib bo'lmas: butun ro'yxat
 * har qidiruvda tarmoqdan o'tardi. Endi shartlar bazaga tushadi.
 *
 * Javob shakli: `{ items, total, page, pageSize, sanoq }`.
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const p = new URL(request.url).searchParams;
  const holatRaw = p.get("holat");
  const holat: XodimHolat =
    holatRaw === "faol" || holatRaw === "nofaol" ? holatRaw : "hammasi";

  const [royxat, sanoq] = await Promise.all([
    listXodimlar({
      q: p.get("q") ?? undefined,
      holat,
      rol: p.get("rol"),
      biznes: p.get("biznes"),
      page: Number(p.get("page")) || 1,
      pageSize: Number(p.get("pageSize")) || 50,
    }),
    xodimSanoqlari(),
  ]);

  return NextResponse.json({ ...royxat, sanoq });
});

export const POST = withTenant(async (request, _ctx, tenant) => {
  const user = tenant.session;
  requireManager(user.rol);

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // MAXSUS ROL (PRO): tanlangan bo'lsa tizim roli rol.bazaRol'dan olinadi —
  // nav/modul skeleti shu orqali ishlaydi, granular huquqlar esa roldan.
  let roleId: string | null = null;
  let effectiveRol: string = parsed.data.rol;
  if (parsed.data.roleId) {
    requirePro(tenant);
    const role = await prisma.role.findFirst({
      where: { id: parsed.data.roleId, deletedAt: null, isActive: true },
      select: { id: true, bazaRol: true },
    });
    if (!role) return NextResponse.json({ error: "Rol topilmadi" }, { status: 404 });
    roleId = role.id;
    effectiveRol = role.bazaRol;
  }
  if (parsed.data.huquqPlus?.length || parsed.data.huquqMinus?.length) {
    requirePro(tenant);
  }

  // EGALIK HIMOYASI: direktor (OWNER) rolini faqat direktor bera oladi.
  // Tekshiruv `effectiveRol` ustida — ya'ni maxsus rolning `bazaRol` i orqali
  // kelgan daraja ham shu yerda ushlanadi (lib/services/userGuard.ts).
  await egalikTekshir({ userId: user.userId, rol: user.rol }, { yangiRol: effectiveRol }, "yangi");

  // Kassir uchun kamida bitta biznes MAJBURIY; sotuvchi uchun IXTIYORIY
  // (biriktirilsa — yozuvlari faqat o'sha bizneslarga tushadi; biriktirilmasa
  // — barcha bizneslar). Owner/admin — biznessiz (lib/services/userBiznes.ts).
  const biznesIdlar = await biznesIdlariniHalQil({
    rol: effectiveRol,
    businessIds: parsed.data.businessIds,
    businessId: parsed.data.businessId,
    mavjud: [],
  });

  // Login BUTUN tizim bo'ylab unique — shuning uchun rawPrisma (tenantlar aro tekshiruv).
  const existing = await rawPrisma.user.findUnique({ where: { login: parsed.data.login } });
  if (existing) {
    return NextResponse.json({ error: "Bu login band" }, { status: 409 });
  }

  const parolHash = await hashPassword(parsed.data.parol);
  const created = await prisma.user.create({
    data: {
      ism: parsed.data.ism,
      login: parsed.data.login,
      parolHash,
      rol: effectiveRol,
      // Direktor qo'ygan parol VAQTINCHALIK — xodim birinchi kirishda o'zinikini
      // qo'yadi (src/app/app/layout.tsx `mustChangePassword` ni ushlaydi).
      mustChangePassword: true,
      businessId: birlamchiBiznes(biznesIdlar),
      roleId,
      huquqPlus: parsed.data.huquqPlus?.length ? JSON.stringify(parsed.data.huquqPlus) : undefined,
      huquqMinus: parsed.data.huquqMinus?.length ? JSON.stringify(parsed.data.huquqMinus) : undefined,
    },
    select: USER_SELECT,
  });

  await biriktiruvlarniYangila(created.id, biznesIdlar);

  // Biriktiruvlar YOZILGANDAN keyin o'qiladi — aks holda javobdagi biznes
  // nomlari bo'sh bo'lib, UI yangi xodimni "Barcha bizneslar" deb ko'rsatardi.
  return NextResponse.json(await xodimniOqi(created.id), { status: 201 });
});
