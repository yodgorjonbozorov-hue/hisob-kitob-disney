import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { getActiveBusiness } from "@/lib/business";
import { listProducts, listRecentSales, type ProductKassirDTO } from "@/lib/queries/inventory";
import { SotuvClient } from "./SotuvClient";
import { isAvto } from "@/lib/biznesTuri";
import { isManager } from "@/lib/auth/roles";

export default async function SotuvPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  // Sotuvchi faqat kirim/chiqim kiritadi — bu sahifa unga yopiq.
  if (session.rol === "SELLER") {
    redirect("/app");
  }
  const { getEnabledModules } = await import("@/lib/modules/guard");
  // Guard, biznes va modullar parallel — har biri alohida kutilsa Turso'da
  // ketma-ket round-trip yig'ilib sahifani sekinlashtiradi.
  const [, business, yoqilgan] = await Promise.all([
    // OMBOR moduli yoqilmagan bo'lsa — asosiy sahifaga.
    requireModulePage(ctx, "OMBOR"),
    getActiveBusiness(session),
    getEnabledModules(ctx),
  ]);
  if (!business || !business.omborli) {
    redirect("/app");
  }

  // Kassir uchun ham, admin uchun ham sotuv formasi bir xil (miqdorsiz — faqat mavjudlik).
  // MIJOZLAR moduli yoqiq bo'lsa — qarzga sotuvda mijoz kartochkasini tanlash
  // mumkin (shunda qarz limiti ishlaydi). Yoqilmagan bo'lsa ro'yxat bo'sh.
  const [products, sales, mijozlar, kassalar] = await Promise.all([
    listProducts(business.id, { forKassir: true }) as Promise<ProductKassirDTO[]>,
    listRecentSales(business.id, 15),
    yoqilgan.has("MIJOZLAR")
      ? (await import("@/lib/queries/mijoz")).listMijozlar(business.id)
      : Promise.resolve([]),
    // Naqd sotuvda pul qaysi kassaga tushishini tanlash uchun (Naqd / Click / terminal).
    (await import("@/lib/queries/accounts")).listAccounts(business.id, true),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-fg">{isAvto(business.turi) ? "Mashina sotish" : "Sotuv"}</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{business.nomi}</span>
        </p>
      </div>
      <SotuvClient
        products={products}
        initialSales={sales}
        biznesTuri={business.turi}
        bekorQilaOladi={isManager(session.rol)}
        mijozlar={mijozlar}
        kassalar={kassalar}
      />
    </div>
  );
  });
}
