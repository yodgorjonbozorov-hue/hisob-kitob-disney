import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getActiveBusiness } from "@/lib/business";
import { listProducts, listRecentSales, type ProductKassirDTO } from "@/lib/queries/inventory";
import { SotuvClient } from "./SotuvClient";

export default async function SotuvPage() {
  const session = await requireUser();
  const business = await getActiveBusiness(session);
  if (!business || !business.omborli) {
    redirect("/");
  }

  // Kassir uchun ham, admin uchun ham sotuv formasi bir xil (miqdorsiz — faqat mavjudlik).
  const [products, sales] = await Promise.all([
    listProducts(business.id, { forKassir: true }) as Promise<ProductKassirDTO[]>,
    listRecentSales(business.id, 15),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Sotuv</h1>
        <p className="text-sm text-slate-500 mt-1">
          Biznes: <span className="font-medium text-slate-700">{business.nomi}</span>
        </p>
      </div>
      <SotuvClient products={products} initialSales={sales} />
    </div>
  );
}
