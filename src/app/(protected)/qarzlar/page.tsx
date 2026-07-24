import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getActiveBusiness } from "@/lib/business";
import { listDebts } from "@/lib/queries/inventory";
import { QarzlarClient } from "./QarzlarClient";

export default async function QarzlarPage() {
  const session = await requireUser();
  const business = await getActiveBusiness(session);
  if (!business || !business.omborli) {
    redirect("/");
  }

  const debts = await listDebts(business.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Qarzdorlik</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{business.nomi}</span>
        </p>
      </div>
      <QarzlarClient initialDebts={debts} />
    </div>
  );
}
