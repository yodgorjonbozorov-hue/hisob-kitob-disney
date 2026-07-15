import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { CategoriesClient } from "./CategoriesClient";

export default async function KategoriyalarPage() {
  const session = await requireUser();
  if (session.rol !== "admin") {
    redirect("/");
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ turi: "asc" }, { tartib: "asc" }, { nomi: "asc" }],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Kategoriyalar</h1>
      <CategoriesClient initialCategories={categories} />
    </div>
  );
}
