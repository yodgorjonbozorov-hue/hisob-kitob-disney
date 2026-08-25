import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { getActiveBusiness } from "@/lib/business";
import { listPosMahsulotlar, listMahsulotKategoriyalar } from "@/lib/queries/pos";
import { listAccounts } from "@/lib/queries/accounts";
import { PosClient } from "./PosClient";

export const metadata = { title: "Kassa (POS) — Balansa" };

/**
 * KASSA (POS) sahifasi.
 *
 * IKKI QAVATLI HIMOYA (frontend'da yashirish xavfsizlik emas):
 *   1. `requireModulePage` — MAGAZIN moduli tenantda yoqilganmi va rol
 *      shu modulga kira oladimi (yo'q bo'lsa /app ga qaytariladi);
 *   2. `business.magazin` — aynan SHU bizneste kassa yuritiladimi.
 * Uchinchi qavat API'da: har route `{ module: "MAGAZIN" }` + `requireMagazin`.
 */
export default async function PosPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    // Sotuvchi kassaga kirmaydi (OMBOR bilan bir xil qoida).
    if (session.rol === "SELLER") {
      redirect("/app");
    }

    const [, business] = await Promise.all([
      requireModulePage(ctx, "MAGAZIN"),
      getActiveBusiness(session),
    ]);
    if (!business || !business.magazin || !business.omborli) {
      redirect("/app");
    }

    // Mijozlar ro'yxati BU YERDA YUKLANMAYDI: qarzga sotuvda mijoz
    // `/api/debts/mijozlar` orqali qidiriladi (ism va telefon bo'yicha,
    // joriy qarzi bilan). Butun ro'yxatni har kassa ochilishida yuklash
    // mijozlar soni o'sgan sari sahifani sekinlashtirardi.
    const [mahsulotlar, kategoriyalar, kassalar] = await Promise.all([
      listPosMahsulotlar(business.id),
      listMahsulotKategoriyalar(business.id),
      listAccounts(business.id, true),
    ]);

    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Kassa</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business.nomi}</span> · skanerni ulang
            yoki mahsulotni tanlang
          </p>
        </div>
        <PosClient
          mahsulotlar={mahsulotlar}
          kategoriyalar={kategoriyalar}
          kassalar={kassalar}
        />
      </div>
    );
  });
}
