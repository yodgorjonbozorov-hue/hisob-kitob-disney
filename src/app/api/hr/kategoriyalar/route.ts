import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { listKategoriyalar, createKategoriya } from "@/lib/services/xodimKategoriya";
import { kategoriyaCreateSchema } from "@/lib/validation/xodimKategoriya";

/** Xodim kategoriyalari ro'yxati (a'zolari bilan) — boshqaruv sahifasi. */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);
    return NextResponse.json(await listKategoriyalar(businessId));
  },
  { module: "HR" }
);

/** Yangi kategoriya (Sotuvchi, Diktor, Animator, ... — biznes o'zi sozlaydi). */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = kategoriyaCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await createKategoriya(businessId, parsed.data), { status: 201 });
  },
  { module: "HR" }
);
