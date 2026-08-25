import Link from "next/link";
import { AlertTriangle, CircleAlert, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { DiqqatAlert } from "@/lib/queries/dashboardPanel";

/**
 * "DIQQAT TALAB QILADI" — faqat REAL, ma'lumotdan aniq hisoblanadigan
 * holatlar (`getDiqqatAlertlari`). Taxminiy ogohlantirish yaratilmaydi.
 *
 * Har qator bosiladi va tegishli sahifaga olib boradi.
 */
export function DiqqatBloki({ alertlar }: { alertlar: DiqqatAlert[] }) {
  return (
    <Card>
      <h2 className="font-semibold text-fg mb-4">Diqqat talab qiladi</h2>

      {alertlar.length === 0 ? (
        <div className="flex items-center gap-3 py-2">
          <CheckCircle2 className="w-5 h-5 text-income shrink-0" aria-hidden />
          <p className="text-sm text-muted">
            Hozircha e&apos;tibor talab qiladigan holat yo&apos;q.
          </p>
        </div>
      ) : (
        <ul className="space-y-1">
          {alertlar.map((a) => {
            const Icon = a.daraja === "danger" ? CircleAlert : AlertTriangle;
            return (
              <li key={a.kod}>
                <Link
                  href={a.href}
                  className="flex items-start gap-3 rounded-xl -mx-2 px-2 py-2.5 transition hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      a.daraja === "danger" ? "text-expense" : "text-debt"
                    }`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-fg">{a.matn}</span>
                    {a.qoshimcha && (
                      <span className="block text-2xs text-muted tnum truncate">{a.qoshimcha}</span>
                    )}
                  </span>
                  <span className="text-2xs text-faint shrink-0 mt-0.5 hidden sm:inline">
                    {a.havolaMatni} ›
                  </span>
                  <span aria-hidden className="text-faint sm:hidden">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
