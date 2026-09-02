"use client";

import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { KUNLIK_TOLOV_BELGI, KUNLIK_TOLOV_NOMI } from "@/lib/validation/kunlik";
import type { KunlikReportDTO } from "@/lib/queries/kunlik";

/**
 * KUN XULOSASI — uchta katta raqam va to'lov turlari kesimi.
 *
 * Ierarxiya ataylab ikki qavatli:
 *   1-qavat (katta): Jami kirim · Chiqim · SOF NATIJA — kun qanday o'tgani;
 *   2-qavat (kichik): Naqd / Click / Qarz — o'sha kirim NIMADAN iborat.
 * Ilgari to'rt karta bir tekisda turardi va "qaysi biri asosiy" degan savol
 * ochiq qolardi.
 *
 * To'lov turlari `KUNLIK_TOLOV_*` lug'atidan olinadi — bu yerda yangi
 * "accounting method" o'ylab topilmaydi.
 */
export function XulosaKartalar({ report }: { report: KunlikReportDTO }) {
  // MOLIYAVIY KESIM `hisobot.korish` huquqiga bog'liq: huquq bo'lmasa server
  // `null` yuboradi (lib/queries/kunlik.ts) va bu ikki karta UMUMAN
  // chizilmaydi. Xodimga qoladigan raqam — o'z tushumi, ya'ni kassa
  // topshirig'ining predmeti.
  const sof = report.sofSumma;
  const moliyaKorinadi = report.chiqimSumma !== null && sof !== null;

  const kesim = [
    { turi: "CASH" as const, summa: report.naqdSumma },
    { turi: "CLICK" as const, summa: report.clickSumma },
    { turi: "DEBT" as const, summa: report.qarzSumma },
  ];

  return (
    <div className="space-y-3">
      <div
        className={
          moliyaKorinadi ? "grid grid-cols-2 lg:grid-cols-3 gap-3" : "grid grid-cols-1 gap-3"
        }
      >
        <Card className="p-4">
          <p className="text-2xs sm:text-sm text-muted">📈 Jami kirim</p>
          <div className="mt-1.5">
            <Money value={report.jamiSumma} size="xl" tone="income" />
          </div>
        </Card>

        {moliyaKorinadi && (
          <>
            <Card className="p-4">
              <p className="text-2xs sm:text-sm text-muted">📉 Jami chiqim</p>
              <div className="mt-1.5">
                <Money value={report.chiqimSumma ?? 0} size="xl" tone="expense" />
              </div>
            </Card>

            <Card className="p-4 col-span-2 lg:col-span-1">
              <p className="text-2xs sm:text-sm text-muted">💰 Sof natija</p>
              <div className="mt-1.5">
                <Money
                  value={sof ?? 0}
                  size="display"
                  tone={(sof ?? 0) >= 0 ? "brand" : "expense"}
                  signed={(sof ?? 0) < 0}
                />
              </div>
              <p className="text-2xs text-faint mt-1">Kirim − chiqim</p>
            </Card>
          </>
        )}
      </div>

      <Card className="p-4">
        <p className="text-2xs text-faint mb-2">Kirim to&apos;lov turi bo&apos;yicha</p>
        <div className="grid grid-cols-3 gap-2">
          {kesim.map((k) => (
            <div key={k.turi} className="min-w-0">
              <p className="text-2xs text-muted truncate">
                {KUNLIK_TOLOV_BELGI[k.turi]} {KUNLIK_TOLOV_NOMI[k.turi]}
              </p>
              <div className="mt-0.5">
                <Money value={k.summa} size="md" tone="neutral" suffix={false} />
              </div>
            </div>
          ))}
        </div>
        {report.qarzSumma > 0 && (
          <p className="text-2xs text-faint mt-2">
            📋 Qarz — pul hali kassaga tushmagan, shuning uchun kassa hisobiga kirmaydi.
          </p>
        )}
      </Card>
    </div>
  );
}
