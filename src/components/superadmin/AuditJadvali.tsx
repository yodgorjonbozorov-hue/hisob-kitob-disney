"use client";

import { useState } from "react";
import { Jadval, type Ustun } from "./Jadval";
import { FiltrBoshHolat } from "./Holatlar";
import { Modal } from "@/components/ui/Modal";

export interface AuditQatorDto {
  id: string;
  vaqt: string;
  kim: string | null;
  amalLabel: string;
  entity: string;
  entityId: string;
  tenantNomi: string | null;
  ip: string | null;
  userAgent: string | null;
  sabab: string | null;
  before: string | null;
  after: string | null;
}

/** JSON matnini o'qish uchun chiroyli ko'rinishga keltiradi. */
function chiroyli(xom: string | null): string {
  if (!xom) return "—";
  try {
    return JSON.stringify(JSON.parse(xom), null, 2);
  } catch {
    return xom;
  }
}

/**
 * Audit jadvali va yozuv kartochkasi.
 *
 * Har yozuvda BEFORE/AFTER to'liq ko'rinadi — "nima o'zgardi?" degan savol
 * bitta bosishda javob topadi. Yozuvni o'chirish yoki o'zgartirish
 * imkoniyati ATAYLAB yo'q.
 */
export function AuditJadvali({ qatorlar }: { qatorlar: AuditQatorDto[] }) {
  const [tanlangan, setTanlangan] = useState<AuditQatorDto | null>(null);

  const ustunlar: Ustun<AuditQatorDto>[] = [
    { kalit: "vaqt", sarlavha: "Vaqt", katak: (q) => q.vaqt },
    { kalit: "kim", sarlavha: "Kim", katak: (q) => q.kim ?? "—" },
    { kalit: "amal", sarlavha: "Amal", katak: (q) => q.amalLabel },
    {
      kalit: "obyekt",
      sarlavha: "Obyekt",
      katak: (q) => (
        <span className="text-2xs">
          {q.entity} · <span className="font-mono">{q.entityId.slice(0, 12)}</span>
        </span>
      ),
    },
    { kalit: "tenant", sarlavha: "Kompaniya", katak: (q) => q.tenantNomi ?? "—", ikkinchiDarajali: true },
    {
      kalit: "ip",
      sarlavha: "IP",
      katak: (q) => <span className="font-mono text-2xs">{q.ip ?? "—"}</span>,
      ikkinchiDarajali: true,
    },
    { kalit: "sabab", sarlavha: "Sabab", katak: (q) => q.sabab ?? "—" },
    {
      kalit: "ochish",
      sarlavha: "",
      katak: (q) => (
        <button
          type="button"
          onClick={() => setTanlangan(q)}
          className="text-2xs text-brand hover:underline"
        >
          Batafsil
        </button>
      ),
    },
  ];

  return (
    <>
      <Jadval
        ustunlar={ustunlar}
        qatorlar={qatorlar}
        kalit={(q) => q.id}
        bosh={<FiltrBoshHolat tozalaHref="/superadmin/audit" />}
      />

      <Modal open={!!tanlangan} onClose={() => setTanlangan(null)} title="Audit yozuvi" size="lg">
        {tanlangan && (
          <dl className="space-y-2 text-sm">
            {[
              ["Vaqt", tanlangan.vaqt],
              ["Kim", tanlangan.kim ?? "—"],
              ["Amal", tanlangan.amalLabel],
              ["Obyekt", `${tanlangan.entity} · ${tanlangan.entityId}`],
              ["Kompaniya", tanlangan.tenantNomi ?? "—"],
              ["IP", tanlangan.ip ?? "—"],
              ["Qurilma", tanlangan.userAgent ?? "—"],
              ["Sabab", tanlangan.sabab ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-2">
                <dt className="text-2xs text-faint">{k}</dt>
                <dd className="col-span-2 text-fg break-words">{v}</dd>
              </div>
            ))}
            <div>
              <dt className="text-2xs text-faint mb-1">Oldingi holat</dt>
              <dd>
                <pre className="text-2xs bg-surface-2 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                  {chiroyli(tanlangan.before)}
                </pre>
              </dd>
            </div>
            <div>
              <dt className="text-2xs text-faint mb-1">Keyingi holat</dt>
              <dd>
                <pre className="text-2xs bg-surface-2 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                  {chiroyli(tanlangan.after)}
                </pre>
              </dd>
            </div>
          </dl>
        )}
      </Modal>
    </>
  );
}
