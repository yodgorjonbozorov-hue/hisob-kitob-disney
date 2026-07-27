import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { resetUserPassword, logSuperadminAction } from "@/lib/superadmin/service";

/**
 * Foydalanuvchi parolini tiklash: yangi tasodifiy parol yaratiladi va BIR MARTA
 * qaytariladi (superadmin mijozga yetkazadi); birinchi kirishda almashtirish majburiy.
 */
export const POST = withSuperadmin<{ params: { id: string } }>(async (_request, { params }, session) => {
  const { login, yangiParol } = await resetUserPassword(params.id);
  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: "password_reset",
    entity: "user",
    entityId: params.id,
    detail: { login },
  });
  return NextResponse.json({ ok: true, login, yangiParol });
});
