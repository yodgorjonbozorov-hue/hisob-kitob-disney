import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, UnauthorizedError } from "@/lib/auth/guard";
import { createBusinessSchema } from "@/lib/validation/business";
import { getAccessibleBusinesses } from "@/lib/business";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    // Foydalanuvchi kira oladigan bizneslar (admin → barcha faol; kassir → o'ziniki).
    const businesses = await getAccessibleBusinesses(user);
    return NextResponse.json(businesses);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireRole(user.rol, "admin");

    const body = await request.json();
    const parsed = createBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const business = await prisma.business.create({ data: parsed.data });
    return NextResponse.json(business, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
