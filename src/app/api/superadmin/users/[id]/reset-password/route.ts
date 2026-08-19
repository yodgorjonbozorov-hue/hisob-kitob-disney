import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { resetUserPassword } from "@/lib/superadmin/service";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { parolTiklashSchema } from "@/lib/validation/superadmin";
import { sessiyalarniBekorQil } from "@/lib/superadmin/sessiyalar";
import { rawPrisma } from "@/lib/db/rawPrisma";

/**
 * Foydalanuvchi parolini tiklash.
 *
 * Yangi tasodifiy parol BIR MARTA qaytariladi (superadmin mijozga yetkazadi)
 * va birinchi kirishda almashtirish majburiy bo'ladi.
 *
 * QO'SHIMCHA: parol tiklanganda eski sessiyalar ham BEKOR QILINADI. Aks holda
 * hisob o'g'irlangan bo'lsa, hujumchining ochiq sessiyasi parol almashgach
 * ham ishlayverardi.
 */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("foydalanuvchilar", "UPDATE"),
  async (request, { params }, sa) => {
    const parsed = parolTiklashSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Sabab kiritilishi shart" },
        { status: 400 }
      );
    }

    const user = await rawPrisma.user.findUnique({
      where: { id: params.id },
      select: { tenantId: true },
    });
    if (!user) return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });

    const { login, yangiParol } = await resetUserPassword(params.id);
    await sessiyalarniBekorQil(params.id);

    await superadminAudit({
      sa,
      amal: SA_AMAL.USER_PASSWORD_RESET,
      entity: "user",
      entityId: params.id,
      tenantId: user.tenantId,
      // Parolning O'ZI jurnalga tushmaydi.
      after: { login, sessiyalarBekorQilindi: true },
      sabab: parsed.data.sabab,
    });

    return NextResponse.json({ ok: true, login, yangiParol });
  }
);
