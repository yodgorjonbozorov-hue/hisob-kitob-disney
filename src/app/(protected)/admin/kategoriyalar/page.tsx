import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getActiveBusiness } from "@/lib/business";
import { CategoriesClient } from "./CategoriesClient";

export default async function KategoriyalarPage() {
  const session = await requireUser();
  if (session.rol !== "admin") {
    redirect("/");
  }

  const activeBusiness = await getActiveBusiness(session);
  if (!activeBusiness) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-fg">Kategoriyalar</h1>
        <p className="text-muted">Hali biznes yaratilmagan. Bizneslar bo'limidan qo'shing.</p>
      </div>
    );
  }

  const categories = await prisma.category.findMany({
    where: { businessId: activeBusiness.id },
    orderBy: [{ turi: "asc" }, { tartib: "asc" }, { nomi: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Kategoriyalar</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{activeBusiness.nomi}</span>
        </p>
      </div>
      <CategoriesClient initialCategories={categories} />
    </div>
  );
}
