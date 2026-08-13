"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import type { KunlikReportDTO } from "@/lib/queries/kunlik";
import type { KunlikRuxsat } from "@/lib/services/kunlik";
import { TopshirishModal } from "./TopshirishModal";
import { QaytaOchishModal } from "./QaytaOchishModal";
import { vaqtUzToshkent } from "./vaqt";

/**
 * KUN YAKUNI KARTASI: jami summa, holat (ochiq / topshirilgan / tasdiqlangan),
 * kassa topshiruvi solishtiruvi (tizim vs sanalgan naqd, FARQ) va amallar.
 */
export function YakunCard({
  report,
  ruxsat,
  bugungi,
}: {
  report: KunlikReportDTO;
  ruxsat: KunlikRuxsat;
  bugungi: boolean;
}) {
  const router = useRouter();
  const [topshirishModal, setTopshirishModal] = useState(false);
  const [qaytaOchishModal, setQaytaOchishModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const ochiq = report.holat === "OPEN";
  const topshirilgan = report.holat === "SUBMITTED";
  const qulflangan = report.holat === "LOCKED";

  async function amal(url: string) {
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sana: report.sana }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  const badge = ochiq ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 text-fg border border-line">
      🟡 Tasdiqlanmagan
    </span>
  ) : topshirilgan ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 text-fg border border-line">
      📤 Topshirilgan — direktor tasdig&apos;ini kutmoqda
    </span>
  ) : qulflangan ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 text-muted border border-line">
      🔒 Yopilgan — davr qulflangan
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-wash text-brand border border-line">
      🟢 Tasdiqlangan
    </span>
  );

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">💰 Jami tushum · kunlik yakun</p>
          <Money value={report.jamiSumma} size="display" tone="brand" />
        </div>
        <div className="text-right space-y-2">
          <p className="text-sm">{badge}</p>
          {topshirilgan && (
            <p className="text-2xs text-muted">
              Topshirdi: <span className="text-fg">{report.submittedByIsm ?? "—"}</span>
              {report.submittedAt && (
                <span className="text-faint"> · {vaqtUzToshkent(report.submittedAt)}</span>
              )}
            </p>
          )}
          {(report.holat === "CONFIRMED" || qulflangan) && (
            <div className="text-2xs text-muted space-y-0.5">
              <p>
                Tasdiqlagan: <span className="text-fg">{report.confirmedByIsm ?? "—"}</span>
              </p>
              {report.confirmedAt && <p className="text-faint">{vaqtUzToshkent(report.confirmedAt)}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Kassa topshiruvi solishtiruvi — pul nazoratining yuragi */}
      {report.sanalganNaqd !== null && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4 space-y-1 text-sm tnum">
          <div className="flex justify-between gap-3">
            <span className="text-muted">💵 Naqd (tizim hisobi)</span>
            <Money value={report.naqdSumma} size="sm" tone="neutral" />
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">💵 Naqd (xodim sanadi)</span>
            <Money value={report.sanalganNaqd} size="sm" tone="neutral" />
          </div>
          <div className="flex justify-between gap-3 pt-1 border-t border-line">
            <span className="font-medium text-fg">Farq</span>
            {report.naqdFarq === 0 ? (
              <span className="text-brand font-medium">✅ Yo&apos;q — mos</span>
            ) : (
              <span className="text-expense font-semibold">
                {report.naqdFarq! < 0
                  ? `⚠️ KAM: −${Math.abs(report.naqdFarq!).toLocaleString("uz-UZ")} so'm`
                  : `⚠️ Ortiqcha: +${report.naqdFarq!.toLocaleString("uz-UZ")} so'm`}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 justify-end">
        {ochiq && bugungi && (
          <Button variant="secondary" onClick={() => setTopshirishModal(true)}>
            📤 Kunni direktorga topshirish
          </Button>
        )}
        {(ochiq || topshirilgan) && ruxsat.tasdiqlaydi && (
          <Button onClick={() => amal("/api/kunlik/tasdiqlash")} loading={loading}>
            ✅ Kun yakunini tasdiqlash
          </Button>
        )}
        {!ochiq && !qulflangan && ruxsat.tahrirlaydi && (
          <Button variant="secondary" onClick={() => setQaytaOchishModal(true)}>
            Qayta ochish (tuzatish uchun)
          </Button>
        )}
      </div>

      {xato && <p className="text-sm text-expense mt-3">{xato}</p>}
      {(ochiq || topshirilgan) && ruxsat.boshqaruvchimi && !ruxsat.direktorTayinlangan && (
        // M-7 (A variant): direktor tayinlanmaguncha tasdiqlash yopiq.
        <p className="text-sm text-muted mt-3">
          ⚠️ Kun yakunini tasdiqlash uchun avval direktor tayinlang — yuqoridagi
          &quot;Direktor&quot; tugmasidan tayinlanadi.
        </p>
      )}
      {ochiq && report.qaytaOchishSabab && (
        <p className="text-2xs text-faint mt-3">
          Qayta ochilgan. Sabab: <span className="text-muted">{report.qaytaOchishSabab}</span>
        </p>
      )}
      {qulflangan && (
        <p className="text-2xs text-faint mt-3">
          Davr yopilgan — bu kunni endi o&apos;zgartirib ham, qayta ochib ham bo&apos;lmaydi.
        </p>
      )}
      {ochiq && !ruxsat.tasdiqlaydi && (
        <p className="text-2xs text-faint mt-3">
          Kun oxirida kassani sanab &quot;Direktorga topshirish&quot;ni bosing — kun yakunini
          faqat tayinlangan direktor tasdiqlaydi.
        </p>
      )}

      {topshirishModal && (
        <TopshirishModal
          sana={report.sana}
          onClose={() => setTopshirishModal(false)}
          onDone={() => {
            setTopshirishModal(false);
            router.refresh();
          }}
        />
      )}
      {qaytaOchishModal && (
        <QaytaOchishModal
          sana={report.sana}
          onClose={() => setQaytaOchishModal(false)}
          onDone={() => {
            setQaytaOchishModal(false);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}
