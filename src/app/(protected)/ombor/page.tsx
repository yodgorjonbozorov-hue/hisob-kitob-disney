import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getActiveBusiness } from "@/lib/business";
import { listProducts, getOmborStats, type ProductAdminDTO } from "@/lib/queries/inventory";
import { OmborClient } from "./OmborClient";

export default async function OmborPage() {
  const session = await requireUser();
  if (session.rol !== "admin") {
    redirect("/");
  }
  const business = await getActiveBusiness(session);
  if (!business || !business.omborli) {
    redirect("/");
  }

  const [products, stats] = await Promise.all([
    listProducts(business.id, { forKassir: false }) as Promise<ProductAdminDTO[]>,
    getOmborStats(business.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ombor</h1>
        <p className="text-sm text-slate-500 mt-1">
          Biznes: <span className="font-medium text-slate-700">{business.nomi}</span>
        </p>
      </div>
      <OmborClient initialProducts={products} stats={stats} />
    </div>
  );
}
