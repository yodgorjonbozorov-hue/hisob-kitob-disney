import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { updateCategorySchema } from "@/lib/validation/category";
import { resolveActiveBusinessId } from "@/lib/business";
import { kategoriyaYangila } from "@/lib/services/kategoriya";

/**
 * Kategoriyani yangilash: nomi, turi, holati, kg bayrog'i.
 *
 * DELETE ATAYLAB YO'Q. Kategoriyaga tranzaksiya, budjet, qarz va CRM
 * bitimlari FK bilan bog'langan — o'chirish yo so'rovni yiqitardi
 * (`onDelete: Restrict`), yo tarixiy hisobotni buzardi. "Olib tashlash"ning
 * yagona yo'li — `isActive = false` (nofaollashtirish): eski yozuvlar
 * joyida qoladi, yangi formalarda esa kategoriya ko'rinmaydi.
 */
export const PATCH = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Egalik tekshiruvi, tizim kategoriyasi himoyasi va dublikat qoidalari —
  // hammasi servisda (lib/services/kategoriya.ts), chunki ular API'dan
  // tashqarida (testlar, kelajakdagi bot buyrug'i) ham bir xil bo'lishi kerak.
  const category = await kategoriyaYangila(businessId, params.id, parsed.data);
  return NextResponse.json(category);
});
