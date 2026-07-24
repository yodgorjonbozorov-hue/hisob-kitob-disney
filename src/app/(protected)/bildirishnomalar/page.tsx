import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getNotifications } from "@/lib/queries/notifications";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

const DOT: Record<string, string> = {
  danger: "bg-expense",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

export default async function BildirishnomalarPage() {
  const session = await requireUser();
  const businessId = await resolveActiveBusinessId(session);
  const business = await getActiveBusiness(session);

  const notifs = businessId
    ? await getNotifications(businessId, { rol: session.rol, omborli: business?.omborli ?? false })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Bildirishnomalar</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span>
        </p>
      </div>

      {notifs.length === 0 ? (
        <Card>
          <EmptyState title="Hammasi joyida ✓" description="Diqqat talab qiladigan narsa yo'q." icon="🔔" />
        </Card>
      ) : (
        <div className="space-y-3">
          {notifs.map((n, i) => (
            <Link key={i} href={n.href}>
              <Card className="hover:border-brand/40 transition">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${DOT[n.severity]}`} />
                  <div>
                    <p className="font-medium text-fg">{n.title}</p>
                    <p className="text-sm text-muted mt-0.5">{n.message}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
