import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { hasPermission } from "@/lib/permissions/tekshir";
import { resolveActiveBusinessId } from "@/lib/business";
import { getKassaHisobot } from "@/lib/queries/kassaHisobot";
import { toshkentBugunBoshi } from "@/lib/services/kassirKassa";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { formatToshkentVaqt } from "@/lib/format";

/** Tayyor davrlar — direktor eng ko'p so'raydigan kesimlar (§ davr filtri). */
const DAVRLAR = [
  { kod: "bugun", nomi: "Bugun", kun: 0 },
  { kod: "kecha", nomi: "Kecha", kun: 1 },
  { kod: "7kun", nomi: "Oxirgi 7 kun", kun: 7 },
  { kod: "30kun", nomi: "Oxirgi 30 kun", kun: 30 },
] as const;

const KUN_MS = 86_400_000;

/** Tanlangan davrning [boshlanish, tugash) chegaralari (Toshkent kunlari). */
function davrChegarasi(kod: string): { boshlanish: Date; tugash: Date; nomi: string } {
  const bugun = toshkentBugunBoshi();
  const ertaga = new Date(bugun.getTime() + KUN_MS);
  const davr = DAVRLAR.find((d) => d.kod === kod) ?? DAVRLAR[0];

  if (davr.kod === "kecha") {
    return { boshlanish: new Date(bugun.getTime() - KUN_MS), tugash: bugun, nomi: davr.nomi };
  }
  return {
    boshlanish: new Date(bugun.getTime() - davr.kun * KUN_MS),
    tugash: ertaga,
    nomi: davr.nomi,
  };
}

/**
 * KASSALAR HISOBOTI — davr bo'yicha savdo, xarajat, qoldiq va o'tkazmalar.
 *
 * O'tkazmalar savdo va xarajat ustunlariga QO'SHILMAYDI — ular alohida
 * ro'yxatda (lib/queries/kassaHisobot.ts).
 */
export default async function KassaHisobotPage({
  searchParams,
}: {
  searchParams: { davr?: string };
}) {
  const { session, tenantId } = await requireTenantPage();

  return runWithTenant(tenantId, async () => {
    if (!(await hasPermission(session.userId, "hisobot.korish"))) {
      redirect("/app/kassa");
    }
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) redirect("/app");

    const tanlangan = searchParams.davr ?? "bugun";
    const { boshlanish, tugash, nomi } = davrChegarasi(tanlangan);
    const hisobot = await getKassaHisobot(businessId, boshlanish, tugash);

    return (
      <div className="space-y-6">
        <div>
          <Link href="/app/kassa" className="text-2xs text-muted hover:text-brand">
            ← Kassalar
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-fg mt-1">Kassalar hisoboti</h1>
          <p className="text-sm text-muted mt-1">{nomi}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {DAVRLAR.map((d) => (
            <Link
              key={d.kod}
              href={`/app/kassa/hisobot?davr=${d.kod}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                d.kod === tanlangan
                  ? "bg-brand text-white"
                  : "bg-surface-2 text-muted hover:text-fg"
              }`}
            >
              {d.nomi}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-muted">Jami savdo</p>
            <Money value={hisobot.jamiSavdo} size="xl" tone="income" />
          </Card>
          <Card>
            <p className="text-sm text-muted">Jami xarajat</p>
            <Money value={hisobot.jamiXarajat} size="xl" tone="expense" />
          </Card>
          <Card>
            <p className="text-sm text-muted">Jami kassalar (hozir)</p>
            <Money value={hisobot.jamiBalans} size="xl" tone="brand" />
          </Card>
        </div>

        <Card>
          <h2 className="font-semibold text-fg mb-3">Kassalar bo&apos;yicha</h2>
          <div className="jadval-siljish">
            <table className="w-full text-sm min-w-[28rem]">
              <thead>
                <tr className="text-left text-faint text-xs uppercase">
                  <th className="pb-2">Kassa</th>
                  <th className="pb-2 text-right">Savdo</th>
                  <th className="pb-2 text-right">Xarajat</th>
                  <th className="pb-2 text-right">Balans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {hisobot.qatorlar.map((q) => (
                  <tr key={q.accountId}>
                    <td className="py-2.5">
                      <Link href={`/app/kassa/${q.accountId}`} className="hover:text-brand">
                        {q.egaIsm ?? q.nomi}
                      </Link>
                    </td>
                    <td className="py-2.5 text-right tnum text-income">
                      {q.savdo.toLocaleString("ru-RU")}
                    </td>
                    <td className="py-2.5 text-right tnum text-expense">
                      {q.xarajat.toLocaleString("ru-RU")}
                    </td>
                    <td className="py-2.5 text-right tnum font-medium">
                      {q.balans.toLocaleString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-semibold">
                  <td className="py-2.5">Jami</td>
                  <td className="py-2.5 text-right tnum">
                    {hisobot.jamiSavdo.toLocaleString("ru-RU")}
                  </td>
                  <td className="py-2.5 text-right tnum">
                    {hisobot.jamiXarajat.toLocaleString("ru-RU")}
                  </td>
                  <td className="py-2.5 text-right tnum">
                    {hisobot.jamiBalans.toLocaleString("ru-RU")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-fg mb-1">O&apos;tkazmalar</h2>
          <p className="text-2xs text-faint mb-3">
            Kassalararo o&apos;tkazma daromad emas — yuqoridagi savdo raqamiga kirmaydi.
          </p>
          {hisobot.transferlar.length === 0 ? (
            <p className="text-sm text-faint">Bu davrda o&apos;tkazma bo&apos;lmagan.</p>
          ) : (
            <ul className="divide-y divide-line">
              {hisobot.transferlar.map((t) => (
                <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-fg truncate">
                      {t.fromUserIsm ?? t.fromNomi} → {t.toUserIsm ?? t.toNomi}
                    </p>
                    <p className="text-2xs text-faint">
                      {formatToshkentVaqt(new Date(t.createdAt))}
                      {t.turi === "smena" ? " · Smena topshirish" : ""}
                    </p>
                  </div>
                  <Money value={t.summa} size="md" tone="neutral" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  });
}
