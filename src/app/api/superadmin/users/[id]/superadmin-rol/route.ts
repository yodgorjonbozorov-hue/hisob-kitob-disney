import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r, superRolNormalize } from "@/lib/superadmin/rbac";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { superadminRolSchema } from "@/lib/validation/superadmin";

/**
 * Superadmin ichidagi rolni tayinlash (faqat ROOT — `sozlamalar.MANAGE`).
 *
 * O'Z ROLINI o'zgartirish TAQIQLANADI: aks holda oxirgi ROOT o'zini
 * READ_ONLY qilib platformani boshqarib bo'lmaydigan holga keltirardi.
 * Shu sababdan oxirgi ROOT ni pasaytirish ham rad etiladi.
 */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("sozlamalar", "MANAGE"),
  async (request, { params }, sa) => {
    const parsed = superadminRolSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    if (params.id === sa.session.userId) {
      return NextResponse.json({ error: "O'z rolingizni o'zgartira olmaysiz" }, { status: 400 });
    }

    const user = await rawPrisma.user.findUnique({
      where: { id: params.id },
      select: { rol: true, superadminRol: true, ism: true, login: true },
    });
    if (!user) return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });
    if (user.rol !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Bu foydalanuvchi superadmin emas — superadmin roli faqat superadminga beriladi" },
        { status: 400 }
      );
    }

    const oldingi = superRolNormalize(user.superadminRol);
    if (oldingi === "ROOT" && parsed.data.superadminRol !== "ROOT") {
      const rootSoni = await rawPrisma.user.count({
        where: { rol: "SUPERADMIN", isActive: true, superadminRol: "ROOT" },
      });
      if (rootSoni <= 1) {
        return NextResponse.json(
          { error: "Oxirgi ROOT superadminni pasaytirib bo'lmaydi — avval boshqa ROOT tayinlang" },
          { status: 400 }
        );
      }
    }

    await rawPrisma.user.update({
      where: { id: params.id },
      // Rol o'zgargach eski sessiyalar yangi huquq bilan ishlamasligi uchun
      // sessiya avlodi ham oshiriladi.
      data: { superadminRol: parsed.data.superadminRol, sessionEpoch: { increment: 1 } },
    });

    await superadminAudit({
      sa,
      amal: SA_AMAL.ROLE_CHANGED,
      entity: "user",
      entityId: params.id,
      before: { superadminRol: oldingi },
      after: { superadminRol: parsed.data.superadminRol, login: user.login },
      sabab: parsed.data.sabab,
    });

    return NextResponse.json({ ok: true, superadminRol: parsed.data.superadminRol });
  }
);
