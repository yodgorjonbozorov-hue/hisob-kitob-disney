import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { TakroriyClient } from "./TakroriyClient";

export default async function TakroriyPage() {
  const session = await requireUser();
  if (session.rol !== "admin") {
    redirect("/tranzaksiyalar");
  }
  const businessId = await resolveActiveBusinessId(session);
  const business = await getActiveBusiness(session);

  const [categories, recurrings] = businessId
    ? await Promise.all([
        prisma.category.findMany({
          where: { businessId, isActive: true },
          orderBy: [{ turi: "asc" }, { nomi: "asc" }],
          select: { id: true, nomi: true, turi: true },
        }),
        prisma.recurringTransaction.findMany({
          where: { businessId },
          include: { category: { select: { nomi: true } } },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], []];

  const initial = recurrings.map((r) => ({
    id: r.id, turi: r.turi, summa: r.summa, kun: r.kun, izoh: r.izoh,
    isActive: r.isActive, categoryNomi: r.category.nomi, lastGenerated: r.lastGenerated,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Takroriy tranzaksiyalar</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Har oy avtomatik
          yaratiladigan yozuvlar (ijara, oylik va h.k.)
        </p>
      </div>
      <TakroriyClient categories={categories} initial={initial} />
    </div>
  );
}
