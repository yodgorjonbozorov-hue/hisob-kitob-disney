import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { getSotuvchiDetal } from "@/lib/queries/sotuvchiKpi";
import { joriyOyOraliq, sanaOraliqOqi } from "@/lib/xodimDavr";

/**
 * BITTA SOTUVCHI STATISTIKASI (11/21/22-talab).
 *
 * HIMOYA (28-talab): `hisobot.korish` bo'lsa — istalgan sotuvchi; bo'lmasa
 * FAQAT o'zining xodim kartochkasi. Ya'ni sotuvchi o'z natijasini ko'radi,
 * boshqalarning oyligi/bonusi/KPI'si esa unga ko'rinmaydi.
 */
export const GET = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    if (!(await hasPermission(user.userId, "hisobot.korish"))) {
      const ozi = await prisma.employee.findFirst({
        where: { id: params.id, businessId, userId: user.userId, deletedAt: null },
        select: { id: true },
      });
      if (!ozi) return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const sp = new URL(request.url).searchParams;
    const oraliq = sanaOraliqOqi(sp) ?? joriyOyOraliq();
    const detal = await getSotuvchiDetal({ businessId, employeeId: params.id, ...oraliq });
    if (!detal) return NextResponse.json({ error: "Xodim topilmadi" }, { status: 404 });
    return NextResponse.json(detal);
  },
  { module: "HR" }
);
