import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireManager, UnauthorizedError } from "@/lib/auth/guard";
import { createUserSchema } from "@/lib/validation/user";
import { hashPassword } from "@/lib/auth/password";

const USER_SELECT = {
  id: true,
  ism: true,
  login: true,
  rol: true,
  isActive: true,
  createdAt: true,
  businessId: true,
  business: { select: { nomi: true } },
} as const;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireManager(user.rol);

    const users = await prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireManager(user.rol);

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    // Kassir uchun biznes majburiy; admin uchun biznes yo'q (barcha bizneslarni ko'radi).
    let businessId: string | null = null;
    if (parsed.data.rol === "CASHIER") {
      if (!parsed.data.businessId) {
        return NextResponse.json({ error: "Kassir uchun biznes tanlanishi shart" }, { status: 400 });
      }
      const biz = await prisma.business.findUnique({ where: { id: parsed.data.businessId }, select: { id: true } });
      if (!biz) {
        return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
      }
      businessId = biz.id;
    }

    const existing = await prisma.user.findUnique({ where: { login: parsed.data.login } });
    if (existing) {
      return NextResponse.json({ error: "Bu login band" }, { status: 409 });
    }

    const parolHash = await hashPassword(parsed.data.parol);
    const created = await prisma.user.create({
      data: {
        ism: parsed.data.ism,
        login: parsed.data.login,
        parolHash,
        rol: parsed.data.rol,
        businessId,
      },
      select: USER_SELECT,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
