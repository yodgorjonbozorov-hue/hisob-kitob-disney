"use client";

import { Card } from "@/components/ui/Card";
import { Jadval, type Ustun } from "@/components/ui/Jadval";
import { formatSom, formatSomLabel, formatDateUZ } from "@/lib/format";
import { telKorinish } from "@/lib/validation/qarz";
import type { QarzDTO } from "@/lib/queries/qarz";
import { QarzHolatBadge } from "./QarzHolatBadge";
import { QarzMuddatBadge } from "./QarzMuddatBadge";
import { muddatHolati } from "@/lib/qarzMuddat";
import { todayDateOnlyString } from "@/lib/date";

/**
 * QARZLAR JADVALI — QARZ YOZUVI kesimi (qarzdorlar kesimidan farqli).
 * Ustunlar: mijoz, muddat holati, kategoriya, telefon, qarz, to'langan,
 * qolgan, berilgan sana, oxirgi to'lov, status, mas'ul, amallar.
 *
 * Muddat ustuni RANG bilan cheklanmaydi — "7 kun kechikdi" matni ham
 * yoziladi (12-talab).
 *
 * Mobil ekranda 10 ta ustun sig'maydi — jadval o'rniga har qarz KARTOChKA
 * bo'ladi (Jadval komponenti). "Qolgan" va "oxirgi to'lov" ikkalasi ham
 * kassir uchun muhim, shu bois ikkalasi ham kartochkada qoladi.
 */
export function QarzJadval({
  qarzlar,
  onOch,
  onEslatma,
}: {
  qarzlar: QarzDTO[];
  onOch: (d: QarzDTO) => void;
  onEslatma: (d: QarzDTO) => void;
}) {
  const bugun = todayDateOnlyString();
  const ustunlar: Ustun<QarzDTO>[] = [
    {
      kalit: "mijoz",
      sarlavha: "Mijoz",
      className: "font-medium",
      katak: (d) => (
        <span className={d.isYopilgan ? "opacity-60" : ""}>
          <button
            type="button"
            onClick={() => onOch(d)}
            className="text-left hover:text-brand hover:underline"
          >
            {d.mijozNomi}
          </button>
        </span>
      ),
    },
    {
      kalit: "muddat",
      sarlavha: "Muddat",
      katak: (d) => {
        const { holat, kun } = muddatHolati(d.muddat, d.isYopilgan, bugun);
        return <QarzMuddatBadge holat={holat} kun={kun} kichik />;
      },
    },
    {
      kalit: "kategoriya",
      sarlavha: "Kategoriya",
      className: "text-muted whitespace-nowrap",
      katak: (d) => d.kategoriyaNomi ?? "—",
    },
    {
      kalit: "tel",
      sarlavha: "Telefon",
      className: "text-muted whitespace-nowrap",
      katak: (d) => (d.mijozTel ? telKorinish(d.mijozTel) : "—"),
    },
    { kalit: "qarz", sarlavha: "Qarz", raqam: true, katak: (d) => formatSomLabel(d.jamiSumma) },
    {
      kalit: "tolangan",
      sarlavha: "To'langan",
      raqam: true,
      className: "text-income",
      katak: (d) => formatSom(d.tolangan),
    },
    {
      kalit: "qolgan",
      sarlavha: "Qolgan",
      raqam: true,
      className: "font-medium text-debt",
      katak: (d) => formatSom(d.qolgan),
    },
    {
      kalit: "sana",
      sarlavha: "Berilgan",
      className: "text-muted whitespace-nowrap",
      katak: (d) => formatDateUZ(new Date(d.sana)),
    },
    {
      kalit: "oxirgi",
      sarlavha: "Oxirgi to'lov",
      className: "text-muted whitespace-nowrap",
      katak: (d) => (d.oxirgiTolov ? formatDateUZ(new Date(d.oxirgiTolov)) : "—"),
    },
    { kalit: "status", sarlavha: "Status", katak: (d) => <QarzHolatBadge status={d.status} /> },
    {
      kalit: "masul",
      sarlavha: "Mas'ul",
      className: "text-muted whitespace-nowrap",
      katak: (d) => d.masulIsm ?? "—",
    },
  ];

  return (
    <Card>
      <Jadval
        ustunlar={ustunlar}
        qatorlar={qarzlar}
        kalit={(d) => d.id}
        minKenglik="min-w-[72rem]"
        amallar={(d) => [
          ...(!d.isYopilgan && d.turi === "olinadigan"
            ? [{ label: "Eslatma", onClick: () => onEslatma(d), tur: "oddiy" as const }]
            : []),
          { label: "Ochish", onClick: () => onOch(d), tur: "asosiy" as const },
        ]}
        bosh={<p className="text-center text-faint py-6 text-sm">Bu filtrga mos qarz yo&apos;q</p>}
      />
    </Card>
  );
}
