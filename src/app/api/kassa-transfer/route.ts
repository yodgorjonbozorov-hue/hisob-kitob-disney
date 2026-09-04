import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { listKutilayotganTransferlar } from "@/lib/queries/accounts";
import { kassaTransferYarat, ozKassaTopshirishimi } from "@/lib/services/kassaTransfer";
import { kassaTransferSchema } from "@/lib/validation/account";
import { hasPermission, requirePermission } from "@/lib/permissions/tekshir";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * KASSADAN KASSAGA O'TKAZMA (tasdiq bilan).
 *
 * Bu route kirim/chiqim yozmaydi — pul biznes ichida joyini o'zgartiradi,
 * xolos (lib/services/kassaTransfer.ts). Shuning uchun savdo, xarajat va sof
 * foyda raqamlari o'zgarmaydi.
 */

/**
 * GET — tasdiq kutayotgan o'tkazmalar.
 *
 * KASSA MAXFIYLIGI: "kassa.jami" bo'lsa biznesdagi hammasi; aks holda faqat
 * shu foydalanuvchi yuborgan yoki unga yuborilgan o'tkazmalar — boshqa
 * xodimlar orasidagi summalar kassirga ochilmaydi (server tomonda kesiladi).
 */
export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  await requirePermission(user.userId, "kassa.korish");
  const hammasi = await hasPermission(user.userId, "kassa.jami");
  return NextResponse.json(
    await listKutilayotganTransferlar(businessId, 50, hammasi ? null : user.userId)
  );
});

/**
 * POST — yangi o'tkazma. Qabul qiluvchi boshqa odam bo'lsa tasdiq kutadi.
 *
 * ═══ HUQUQ ═══
 * Boshqa kassadan pul chiqarish "pul.berish" huquqini talab qiladi. Xodimning
 * O'Z kassasini TOPSHIRISHI (`turi = "smena"`) esa huquq emas, MAJBURIYAT:
 * kun oxirida qo'lidagi naqdni topshirmasa pul hisobda osilib qoladi.
 * Shuning uchun o'z kassasidan topshirish huquqsiz ham ishlaydi — sotuvchi
 * rolida "pul.berish" yo'q. Kassaning kimniki ekanini xizmat qatlami
 * mustaqil tekshiradi (`lib/services/kassaTransfer.ts`): birovning shaxsiy
 * kassasidan pul chiqarish baribir faqat boshqaruvchiga.
 */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const parsed = kassaTransferSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  if (!(await ozKassaTopshirishimi(businessId, user.userId, parsed.data))) {
    await requirePermission(user.userId, "pul.berish");
  }

  const transfer = await kassaTransferYarat(
    businessId,
    { userId: user.userId, ism: user.ism, rol: user.rol },
    parsed.data
  );
  dashboardYangilandi(businessId);
  return NextResponse.json(transfer, { status: 201 });
});
