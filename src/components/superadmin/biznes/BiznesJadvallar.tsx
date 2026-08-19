import { formatSom, formatDate, formatToshkentVaqt } from "@/lib/format";
import { Jadval, type Ustun } from "../Jadval";
import { Belgi, TolovStatus } from "../belgilar";
import { BoshHolat } from "../Holatlar";
import { Bolim } from "../Bolim";
import type { TabKalit } from "./BiznesTablar";

interface ObunaDto {
  id: string;
  plan: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  amount: number;
}
interface TolovDto {
  id: string;
  amount: number;
  provider: string;
  status: string;
  plan: string | null;
  createdAt: Date;
  paidAt: Date | null;
}
interface AuditDto {
  id: string;
  kim: string | null;
  amalLabel: string;
  entity: string;
  sabab: string | null;
  createdAt: Date;
}

/**
 * Kompaniya kartochkasidagi uch jadval: obuna davrlari, to'lovlar va
 * faoliyat jurnali. Server komponent — interaktiv amal yo'q, faqat o'qish.
 */
export function BiznesJadvallar({
  tab,
  obunalar,
  tolovlar,
  auditlar,
}: {
  tab: TabKalit;
  obunalar: ObunaDto[];
  tolovlar: TolovDto[];
  auditlar: AuditDto[];
}) {
  if (tab === "obuna") {
    const ustunlar: Ustun<ObunaDto>[] = [
      { kalit: "plan", sarlavha: "Tarif", katak: (q) => q.plan },
      {
        kalit: "status",
        sarlavha: "Holat",
        katak: (q) => (
          <Belgi ton={q.status === "ACTIVE" ? "muvaffaqiyat" : "neytral"}>{q.status}</Belgi>
        ),
      },
      { kalit: "boshi", sarlavha: "Boshlanish", katak: (q) => formatDate(new Date(q.periodStart)) },
      { kalit: "oxiri", sarlavha: "Tugash", katak: (q) => formatDate(new Date(q.periodEnd)) },
      { kalit: "summa", sarlavha: "Summa", raqam: true, katak: (q) => formatSom(q.amount) },
    ];
    return (
      <Bolim sarlavha="Obuna davrlari" izoh="Har tasdiqlangan to'lov bitta davr yozuvini yaratadi">
        <Jadval
          ustunlar={ustunlar}
          qatorlar={obunalar}
          kalit={(q) => q.id}
          bosh={<BoshHolat sarlavha="Hali to'langan davr yo'q" izoh="Mijoz sinov muddatida bo'lishi mumkin." />}
        />
      </Bolim>
    );
  }

  if (tab === "billing") {
    const ustunlar: Ustun<TolovDto>[] = [
      { kalit: "sana", sarlavha: "Sana", katak: (q) => formatDate(new Date(q.createdAt)) },
      { kalit: "summa", sarlavha: "Summa", raqam: true, katak: (q) => formatSom(q.amount) },
      { kalit: "provider", sarlavha: "Provayder", katak: (q) => q.provider },
      { kalit: "status", sarlavha: "Holat", katak: (q) => <TolovStatus status={q.status} /> },
      { kalit: "tarif", sarlavha: "Tarif", katak: (q) => q.plan ?? "—", ikkinchiDarajali: true },
      {
        kalit: "tolangan",
        sarlavha: "To'langan",
        katak: (q) => (q.paidAt ? formatDate(new Date(q.paidAt)) : "—"),
        ikkinchiDarajali: true,
      },
    ];
    return (
      <Bolim sarlavha="To'lovlar">
        <Jadval
          ustunlar={ustunlar}
          qatorlar={tolovlar}
          kalit={(q) => q.id}
          bosh={<BoshHolat sarlavha="To'lov yozuvi yo'q" />}
        />
      </Bolim>
    );
  }

  const ustunlar: Ustun<AuditDto>[] = [
    { kalit: "vaqt", sarlavha: "Vaqt", katak: (q) => formatToshkentVaqt(new Date(q.createdAt)) },
    { kalit: "kim", sarlavha: "Kim", katak: (q) => q.kim ?? "—" },
    { kalit: "amal", sarlavha: "Amal", katak: (q) => q.amalLabel },
    { kalit: "obyekt", sarlavha: "Obyekt", katak: (q) => q.entity },
    { kalit: "sabab", sarlavha: "Sabab", katak: (q) => q.sabab ?? "—", ikkinchiDarajali: true },
  ];
  return (
    <Bolim sarlavha="Faoliyat jurnali" izoh="O'zgarmas audit yozuvlari (oxirgi 50 ta)">
      <Jadval
        ustunlar={ustunlar}
        qatorlar={auditlar}
        kalit={(q) => q.id}
        bosh={<BoshHolat sarlavha="Jurnalda yozuv yo'q" />}
      />
    </Bolim>
  );
}
