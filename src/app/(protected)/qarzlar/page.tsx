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
        <h1 className="text-2xl font-bold text-slate-800">Qarzdorlik</h1>
        <p className="text-sm text-slate-500 mt-1">
          Biznes: <span className="font-medium text-slate-700">{business.nomi}</span>
        </p>
      </div>
      <QarzlarClient initialDebts={debts} />
    </div>
  );
}
