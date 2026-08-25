import { Card } from "@/components/ui/Card";
import { formatMoneyCompact, formatSom, formatSomLabel } from "@/lib/format";
import type { ProBugun } from "@/lib/queries/proDashboard";

/**
 * "BUGUN (kg savdosi)" paneli — MIJOZGA XOS (Fortex Selos, lib/mijozXos.ts).
 *
 * Kg ko'rsatkichlari umumiy "Bugungi holat" blokiga ATAYLAB kirmaydi:
 * og'irlik bilan savdo qilmaydigan bizneste ular ma'nosiz bo'lardi.
 * Boshqa mijozlarda bu blok umuman chizilmaydi.
 */
export function ProBugunKartasi({ bugun }: { bugun: ProBugun }) {
  return (
    <Card>
      <h2 className="font-semibold text-fg mb-3">Bugun (kg savdosi)</h2>
      {/* Kirim/chiqim va kg — BUGUNGI kun; kassa va qarz — JORIY holat. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
        <div>
          <p className="text-2xs text-muted">Kirim</p>
          <p className="font-semibold tnum text-income">{formatMoneyCompact(bugun.kirim)}</p>
        </div>
        <div>
          <p className="text-2xs text-muted">Chiqim</p>
          <p className="font-semibold tnum text-expense">{formatMoneyCompact(bugun.chiqim)}</p>
        </div>
        <div>
          <p className="text-2xs text-muted">Sotilgan</p>
          <p className="font-semibold tnum text-fg">{formatSom(bugun.sotilganKg)} kg</p>
        </div>
        <div>
          <p className="text-2xs text-muted">Sotib olingan</p>
          <p className="font-semibold tnum text-fg">{formatSom(bugun.olinganKg)} kg</p>
        </div>
        <div>
          <p className="text-2xs text-muted">Qarz (sof)</p>
          <p className="font-semibold tnum text-fg" title={formatSomLabel(bugun.qarzSof)}>
            {formatMoneyCompact(bugun.qarzSof)}
          </p>
          {bugun.qarzBeriladigan > 0 && (
            <p className="text-2xs text-muted tnum">
              beriladigan: {formatMoneyCompact(bugun.qarzBeriladigan)}
            </p>
          )}
        </div>
        <div>
          <p className="text-2xs text-muted">Kassalar jami</p>
          <p className="font-semibold tnum text-fg" title={formatSomLabel(bugun.kassaJami)}>
            {formatMoneyCompact(bugun.kassaJami)}
          </p>
        </div>
        <div>
          <p className="text-2xs text-muted">Foydalanuvchilar</p>
          <p className="font-semibold tnum text-fg">{bugun.faolUserlar}</p>
          <p className="text-2xs text-muted tnum">ta&apos;minotchi: {bugun.taminotchilar}</p>
        </div>
      </div>
    </Card>
  );
}
