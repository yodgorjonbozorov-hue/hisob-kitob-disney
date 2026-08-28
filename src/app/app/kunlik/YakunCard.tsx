"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import type { KunlikKassaDTO, KunlikReportDTO } from "@/lib/queries/kunlik";
import type { KunlikRuxsat } from "@/lib/services/kunlik";
import { farqKorinishi } from "./holat";
import { vaqtUzToshkent } from "./vaqt";

/**
 * KUN YAKUNI — kassa topshiruvi va uning holati.
 *
 * ═══ NIMA KO'RSATILADI ═══
 *  - kun OCHIQ bo'lsa: hozir kassangizda qancha pul bor va uni topshirish;
 *  - TOPSHIRILGAN bo'lsa: tizim / real / farq uchligi va kim topshirgani —
 *    direktor aynan shu uchlikka qarab qaror qiladi;
 *  - TASDIQLANGAN bo'lsa: o'sha uchlik + kim va qachon tasdiqlagani.
 *
 * ═══ NEGA "JAMI KIRIM" BU YERDA YO'Q ═══
 * Kirim/chiqim yuqoridagi xulosa kartalarida. Bu karta faqat PUL HARAKATI
 * haqida: kassa topshirish kirim ham, chiqim ham emas.
 */
export function YakunCard({
  report,
  kassa,
  ruxsat,
  bugungi,
  loading,
  onTopshirish,
  onQaror,
  onQaytaOch,
}: {
  report: KunlikReportDTO;
  kassa: KunlikKassaDTO;
  ruxsat: KunlikRuxsat;
  bugungi: boolean;
  loading: boolean;
  onTopshirish: () => void;
  onQaror: (amal: "qabul" | "rad") => void;
  onQaytaOch: () => void;
}) {
  const ochiq = report.holat === "OPEN";
  const topshirilgan = report.holat === "SUBMITTED";
  const farq = farqKorinishi(report.naqdFarq);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted">🔐 Kun yakuni · kassa topshirish</p>
        {report.transferId && (
          <span className="text-2xs text-faint">
            {topshirilgan ? "Pul hali kassirda" : "Pul markaziy kassada"}
          </span>
        )}
      </div>

      {/* OCHIQ KUN — hozir kassada qancha bor. */}
      {ochiq && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-2xs text-faint">
            {kassa.shaxsiy ? kassa.kassaNomi ?? "Sizning kassangiz" : "Biznes naqd kassasi"} —
            tizim bo&apos;yicha
          </p>
          <div className="mt-0.5">
            <Money
              value={kassa.qoldiq}
              size="display"
              tone={kassa.qoldiq < 0 ? "expense" : "brand"}
              signed={kassa.qoldiq < 0}
            />
          </div>
          {kassa.kutilayotgan > 0 && (
            <p className="text-2xs text-debt-fg mt-1">
              ⏳ {kassa.kutilayotgan.toLocaleString("uz-UZ")} so&apos;m tasdiq kutmoqda — u hali
              shu qoldiq ichida.
            </p>
          )}
          {kassa.qoldiq < 0 && (
            <p className="text-2xs text-expense-fg mt-1">
              ⚠ Qoldiq manfiy: kassadan chiqim kirimdan ko&apos;p yozilgan. Topshirishdan oldin
              yozuvlarni tekshiring.
            </p>
          )}
        </div>
      )}

      {/* TOPSHIRILGAN / TASDIQLANGAN — muzlatilgan solishtiruv. */}
      {report.sanalganNaqd !== null && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 space-y-1 text-sm tnum">
          <div className="flex justify-between gap-3">
            <span className="text-muted">Tizim bo&apos;yicha kassada</span>
            {report.kutilganNaqd === null ? (
              <span className="text-faint">—</span>
            ) : (
              <Money value={report.kutilganNaqd} size="sm" tone="neutral" />
            )}
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">Real topshirilgan</span>
            <Money value={report.sanalganNaqd} size="sm" tone="neutral" />
          </div>
          <div className="flex justify-between gap-3 pt-1 border-t border-line">
            <span className="font-medium text-fg">Farq</span>
            <span className={farq ? farq.klass : "text-faint"}>{farq ? farq.matn : "—"}</span>
          </div>
          {report.izoh && (
            <p className="text-2xs text-muted pt-1">Kassir izohi: {report.izoh}</p>
          )}
          {report.qarorIzoh && (
            <p className="text-2xs text-muted">Direktor izohi: {report.qarorIzoh}</p>
          )}
        </div>
      )}

      <div className="mt-3 space-y-1 text-2xs text-muted">
        {report.submittedByIsm && (
          <p>
            Topshirdi: <span className="text-fg">{report.submittedByIsm}</span>
            {report.submittedAt && (
              <span className="text-faint"> · {vaqtUzToshkent(report.submittedAt)}</span>
            )}
          </p>
        )}
        {report.confirmedByIsm && (
          <p>
            Tasdiqladi: <span className="text-fg">{report.confirmedByIsm}</span>
            {report.confirmedAt && (
              <span className="text-faint"> · {vaqtUzToshkent(report.confirmedAt)}</span>
            )}
          </p>
        )}
      </div>

      {/* AMALLAR — desktop uchun; mobil'da sticky panelda takrorlanadi. */}
      <div className="mt-4 hidden sm:flex flex-wrap gap-2 justify-end">
        {ochiq && bugungi && (
          <Button onClick={onTopshirish}>📤 Kunni direktorga topshirish</Button>
        )}
        {topshirilgan && ruxsat.tasdiqlaydi && (
          <>
            <Button variant="secondary" onClick={() => onQaror("rad")} loading={loading}>
              Rad etish
            </Button>
            <Button onClick={() => onQaror("qabul")} loading={loading}>
              ✅ Qabul qilish
            </Button>
          </>
        )}
        {ochiq && !bugungi && ruxsat.tasdiqlaydi && (
          <Button onClick={() => onQaror("qabul")} loading={loading}>
            ✅ Kun yakunini tasdiqlash
          </Button>
        )}
        {!ochiq && ruxsat.tahrirlaydi && (
          <Button variant="secondary" onClick={onQaytaOch} loading={loading}>
            Qayta ochish (tuzatish uchun)
          </Button>
        )}
      </div>

      {ochiq && !ruxsat.tasdiqlaydi && (
        <p className="text-2xs text-faint mt-3">
          Kun oxirida kassani sanab &quot;Direktorga topshirish&quot;ni bosing — kun yakunini
          faqat direktor tasdiqlaydi.
        </p>
      )}
      {topshirilgan && !ruxsat.tasdiqlaydi && (
        <p className="text-2xs text-faint mt-3">
          Direktor tasdiqlaguncha pul sizning kassangizda turadi. Tasdiqlangach kassangiz{" "}
          <span className="text-fg">0</span> ga tushadi.
        </p>
      )}
      {!ochiq && ruxsat.tahrirlaydi && (
        <p className="text-2xs text-faint mt-2">
          Qayta ochilsa pul harakati ham orqaga qaytariladi (storno) — kassir qaytadan topshiradi.
        </p>
      )}
    </Card>
  );
}
