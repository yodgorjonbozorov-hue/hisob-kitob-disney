import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager, BadRequestError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { dashboardYangilandi } from "@/lib/cache";
import { pulHarakatiTahrirSchema, pulHarakatiBekorSchema } from "@/lib/validation/moliya";
import { pulHarakatiTahrirla, pulHarakatiBekor } from "@/lib/services/pulOqimiTuzatish";

/**
 * PUL HARAKATINI TUZATISH VA BEKOR QILISH — FAQAT DIREKTOR (11-talab).
 *
 * `requireManager` — mavjud qoida (OWNER/ADMIN). Yangi rol tizimi
 * kiritilmaydi: kassir o'z xatosini o'zi to'g'rilay olsa kassa nazorati
 * ma'nosini yo'qotardi, shu bois tuzatish rahbar qo'lida qoladi.
 *
 * Amal AYNI biznesga tegishli ekani shu yerda tekshiriladi (cross-business
 * himoyasi), qolgan hamma narsa xizmat qatlamining atomik tranzaksiyasida.
 */
async function amalniTekshir(businessId: string, amalId: string): Promise<void> {
  const bor = await prisma.transaction.findFirst({
    where: { businessId, amalId, deletedAt: null },
    select: { id: true },
  });
  if (!bor) {
    throw new BadRequestError(
      "Bu pul harakati topilmadi. Sotuv, oylik yoki xarid yozuvi o'z bo'limidan tuzatiladi."
    );
  }
}

export const PATCH = withTenant<{ params: { amalId: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await amalniTekshir(businessId, params.amalId);

    const parsed = pulHarakatiTahrirSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const natija = await pulHarakatiTahrirla({
      businessId,
      userId: user.userId,
      amalId: params.amalId,
      ...parsed.data,
    });

    dashboardYangilandi(businessId);
    return NextResponse.json(natija);
  }
);

export const DELETE = withTenant<{ params: { amalId: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await amalniTekshir(businessId, params.amalId);

    // Sabab ixtiyoriy: DELETE tanasi bo'sh kelishi mumkin.
    let sabab: string | null = null;
    try {
      const parsed = pulHarakatiBekorSchema.safeParse(await request.json());
      if (parsed.success) sabab = parsed.data.sabab ?? null;
    } catch {
      /* tanasiz so'rov — sababsiz bekor qilinadi */
    }

    const natija = await pulHarakatiBekor({
      businessId,
      userId: user.userId,
      amalId: params.amalId,
      sabab,
    });

    dashboardYangilandi(businessId);
    return NextResponse.json(natija);
  }
);
