import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { prisma } from "@/lib/prisma";
import { getDavomatTarixi, listJarimalar, listBonuslar } from "@/lib/queries/davomat";
import { getHrSozlama } from "@/lib/services/davomatJadval";
import { toshkentSana } from "@/lib/davomat/vaqt";
import { shiftMonthString, currentMonthString } from "@/lib/date";

const SANA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * XODIMNING O'ZI: davomat tarixi, jarima/bonuslari va (biznes ruxsat bersa)
 * oylik vedomosti. FAQAT o'z yozuvlari — employeeId sessiyadan aniqlanadi,
 * so'rov parametridan EMAS.
 */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ xodim: null });

    const xodim = await prisma.employee.findFirst({
      where: { businessId, userId: user.userId, deletedAt: null },
      select: { id: true, ism: true },
    });
    if (!xodim) return NextResponse.json({ xodim: null });

    const p = new URL(request.url).searchParams;
    const bugun = toshkentSana(new Date());
    const oyBoshi = `${bugun.slice(0, 7)}-01`;
    const from = SANA_RE.test(p.get("from") ?? "") ? p.get("from")! : oyBoshi;
    const to = SANA_RE.test(p.get("to") ?? "") ? p.get("to")! : bugun;

    const [tarix, jarimalar, bonuslar, sozlama] = await Promise.all([
      getDavomatTarixi(businessId, { from, to, employeeId: xodim.id }),
      listJarimalar(businessId, { employeeId: xodim.id, from, to }),
      listBonuslar(businessId, { employeeId: xodim.id, from, to }),
      getHrSozlama(businessId),
    ]);

    // Oylik faqat biznes siyosati ruxsat berganda ko'rinadi.
    let oyliklar: unknown[] = [];
    if (sozlama.xodimOylikKoradi) {
      const joriy = currentMonthString();
      oyliklar = await prisma.payroll.findMany({
        where: { businessId, employeeId: xodim.id, oy: { in: [joriy, shiftMonthString(joriy, -1)] } },
        select: {
          oy: true,
          hisoblangan: true,
          qoshimcha: true,
          ushlab: true,
          bonuslar: true,
          jarimalar: true,
          avans: true,
          tolanadigan: true,
          holat: true,
        },
        orderBy: { oy: "desc" },
      });
    }

    return NextResponse.json({
      xodim: { id: xodim.id, ism: xodim.ism },
      from,
      to,
      tarix,
      jarimalar,
      bonuslar,
      oylikOchiq: sozlama.xodimOylikKoradi,
      oyliklar,
    });
  },
  { module: "HR" }
);
