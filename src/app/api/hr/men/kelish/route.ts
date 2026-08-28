import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { BadRequestError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { rateLimit } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";
import { ishniBoshla } from "@/lib/services/davomat";
import { checkSchema } from "@/lib/validation/davomat";

/**
 * CHECK-IN — xodim ishni boshlaydi. Kim ekani SESSIYADAN aniqlanadi
 * (frontenddan kelgan employeeId/businessId/vaqtga ishonilmaydi), vaqt esa
 * FAQAT server soati.
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const limit = await rateLimit(`davomat:${user.userId}`, 12, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Juda ko'p urinish — biroz kutib qaytadan urinib ko'ring" },
        { status: 429 }
      );
    }

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const xodim = await prisma.employee.findFirst({
      where: { businessId, userId: user.userId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!xodim) {
      throw new BadRequestError(
        "Hisobingiz xodim kartochkasiga bog'lanmagan — administratorga murojaat qiling"
      );
    }

    const parsed = checkSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(
      await ishniBoshla({ businessId, employeeId: xodim.id, input: parsed.data }),
      { status: 201 }
    );
  },
  { module: "HR" }
);
