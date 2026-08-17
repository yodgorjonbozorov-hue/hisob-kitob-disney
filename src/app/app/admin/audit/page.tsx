import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listAuditLogs } from "@/lib/queries/audit";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuditFilters } from "./AuditFilters";
import { formatMoney } from "@/lib/format";

const ACTION_LABEL: Record<string, string> = {
  create: "Yaratildi",
  update: "O'zgartirildi",
  delete: "O'chirildi",
  restore: "Tiklandi",
  skip: "O'tkazib yuborildi",
};
const ENTITY_LABEL: Record<string, string> = {
  transaction: "Tranzaksiya",
  user: "Foydalanuvchi",
  category: "Kategoriya",
  sale: "Sotuv",
  debt: "Qarz",
  business: "Biznes",
  budget: "Budjet",
  recurringTransaction: "Takroriy yozuv",
};
const ACTION_TONE: Record<string, "kirim" | "chiqim" | "warning" | "neutral"> = {
  create: "kirim",
  update: "warning",
  delete: "chiqim",
  restore: "neutral",
  skip: "warning",
};

function summarize(before: string | null, after: string | null): string {
  try {
    const b = before ? JSON.parse(before) : null;
    const a = after ? JSON.parse(after) : null;
    if (a?.summa != null && b?.summa != null && a.summa !== b.summa) {
      return `${formatMoney(b.summa)} → ${formatMoney(a.summa)}`;
    }
    if (a?.summa != null) return formatMoney(a.summa);
    if (b?.summa != null) return formatMoney(b.summa);
    return "";
  } catch {
    return "";
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { entity?: string; action?: string; page?: string };
}) {
  const { session, tenantId } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  if (!isManager(session.rol)) {
    redirect("/app/tranzaksiyalar");
  }
  const businessId = await resolveActiveBusinessId(session);
  const business = await getActiveBusiness(session);
  // Aktiv biznes bo'lmasa audit ko'rsatilmaydi (businessId'siz o'qish taqiqlangan).
  if (!businessId) {
    redirect("/app");
  }

  const { items, total, page, pageSize } = await listAuditLogs({
    businessId,
    entity: searchParams.entity,
    action: searchParams.action,
    page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Audit jurnali</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Kim, nima, qachon
          o'zgartirgani
        </p>
      </div>

      <AuditFilters initial={{ entity: searchParams.entity ?? "", action: searchParams.action ?? "" }} />

      {items.length === 0 ? (
        <Card>
          <EmptyState title="Yozuv yo'q" description="Tanlangan filtr bo'yicha audit yozuvi topilmadi." icon="🗒" />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-line">
            {items.map((log) => (
              <div key={log.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={ACTION_TONE[log.action] ?? "neutral"}>{ACTION_LABEL[log.action] ?? log.action}</Badge>
                    <span className="text-sm font-medium text-fg">{ENTITY_LABEL[log.entity] ?? log.entity}</span>
                    <span className="text-sm text-muted tnum">{summarize(log.before, log.after)}</span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {log.userIsm ?? "—"} · {new Date(log.createdAt).toLocaleString("ru-RU")}
                    {log.ip ? ` · ${log.ip}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-line text-sm text-muted">
              <span>{page}-sahifa / {totalPages}</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
  });
}
