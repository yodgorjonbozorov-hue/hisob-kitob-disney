import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { ForbiddenError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { moveTask } from "@/lib/tasks/service";
import { z } from "zod";

const schema = z.object({
  holat: z.enum(["OCHIQ", "JARAYONDA", "BAJARILDI"]).optional(),
  nomi: z.string().trim().min(1).max(200).optional(),
  izoh: z.string().max(1000).optional().nullable(),
  masulId: z.string().optional(),
  muddat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

/** Vazifani tahrirlash / holatini ko'chirish. */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    const data = parsed.data;

    if (data.holat) {
      await moveTask({ businessId, taskId: params.id, holat: data.holat });
    }

    if (data.nomi !== undefined || data.izoh !== undefined || data.masulId !== undefined || data.muddat !== undefined) {
      const existing = await prisma.task.findFirst({
        where: { id: params.id, businessId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) throw new ForbiddenError("Vazifa topilmadi");

      if (data.masulId) {
        const masul = await prisma.user.findFirst({ where: { id: data.masulId, isActive: true }, select: { id: true } });
        if (!masul) return NextResponse.json({ error: "Mas'ul topilmadi" }, { status: 400 });
      }

      await prisma.task.update({
        where: { id: params.id },
        data: {
          ...(data.nomi !== undefined ? { nomi: data.nomi } : {}),
          ...(data.izoh !== undefined ? { izoh: data.izoh } : {}),
          ...(data.masulId !== undefined ? { masulId: data.masulId } : {}),
          ...(data.muddat !== undefined
            ? { muddat: data.muddat ? new Date(data.muddat + "T00:00:00Z") : null }
            : {}),
        },
      });
    }

    const task = await prisma.task.findFirst({ where: { id: params.id, businessId } });
    return NextResponse.json(task);
  },
  { module: "VAZIFALAR" }
);

/** Vazifani o'chirish (soft delete). */
export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    const existing = await prisma.task.findFirst({
      where: { id: params.id, businessId: businessId ?? "-", deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new ForbiddenError("Vazifa topilmadi");
    await prisma.task.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ ok: true });
  },
  { module: "VAZIFALAR" }
);
