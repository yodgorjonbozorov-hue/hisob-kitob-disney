import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { createTask } from "@/lib/tasks/service";
import { z } from "zod";

/** Vazifalar ro'yxati (aktiv biznes) — mas'ul ismlari bilan. */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);

    const [tasks, users] = await Promise.all([
      prisma.task.findMany({
        where: { businessId, deletedAt: null },
        include: { deal: { select: { id: true, nomi: true } } },
        orderBy: [{ muddat: "asc" }, { createdAt: "desc" }],
        take: 300,
      }),
      prisma.user.findMany({ where: { isActive: true }, select: { id: true, ism: true } }),
    ]);
    const ismlar = new Map(users.map((u) => [u.id, u.ism]));

    return NextResponse.json(
      tasks.map((t) => ({
        id: t.id,
        nomi: t.nomi,
        izoh: t.izoh,
        holat: t.holat,
        masulId: t.masulId,
        masulIsm: ismlar.get(t.masulId) ?? "—",
        muddat: t.muddat?.toISOString() ?? null,
        deal: t.deal ? { id: t.deal.id, nomi: t.deal.nomi } : null,
      }))
    );
  },
  { module: "VAZIFALAR" }
);

const schema = z.object({
  nomi: z.string().trim().min(1, "Vazifa nomi kiritilsin").max(200),
  izoh: z.string().max(1000).optional().nullable(),
  masulId: z.string().optional().nullable(),
  muddat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dealId: z.string().optional().nullable(),
});

/** Yangi vazifa (3 klik: + -> nomi/mas'ul -> saqlash). */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const task = await createTask({ businessId, createdBy: user.userId, ...parsed.data });
    return NextResponse.json(task, { status: 201 });
  },
  { module: "VAZIFALAR" }
);
