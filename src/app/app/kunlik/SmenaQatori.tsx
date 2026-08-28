"use client";

import { Money } from "@/components/ui/Money";
import type { SmenaDTO } from "@/lib/queries/smena";
import type { KunlikRuxsat } from "@/lib/services/kunlik";
import { farqKorinishi } from "./holat";
import { soatToshkent } from "./vaqt";

/** Yopilgan smena qatori — muzlatilgan raqamlar va farq. */
export function SmenaQatori({
  s,
  oxirgimi,
  ruxsat,
  onQaytaOch,
  loading,
}: {
  s: SmenaDTO;
  oxirgimi: boolean;
  ruxsat: KunlikRuxsat;
  onQaytaOch: (id: string) => void;
  loading: boolean;
}) {
  const farq = farqKorinishi(s.farq);

  return (
    <li className="py-3 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-fg">
          {s.raqam}-smena
          <span className="text-muted font-normal">
            {" "}
            · {soatToshkent(s.boshlanishAt)}–{soatToshkent(s.tugashAt)} · {s.yopganIsm ?? "—"}
          </span>
        </p>
        {farq && <span className={`text-2xs ${farq.klass}`}>{farq.matn}</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-2xs">
        <div>
          <span className="text-faint">Tizim</span>
          <div className="text-fg tnum">{s.kutilganNaqd.toLocaleString("uz-UZ")}</div>
        </div>
        <div>
          <span className="text-faint">Sanaldi</span>
          <div className="text-fg tnum">{s.sanalganNaqd.toLocaleString("uz-UZ")}</div>
        </div>
        <div>
          <span className="text-faint">Naqd kirim</span>
          <div className="text-fg tnum">{s.naqd.toLocaleString("uz-UZ")}</div>
        </div>
        <div>
          <span className="text-faint">Naqd chiqim</span>
          <div className="text-fg tnum">{s.naqdChiqim.toLocaleString("uz-UZ")}</div>
        </div>
      </div>

      <div className="text-2xs text-faint flex flex-wrap gap-x-3">
        <span>💳 Click: {s.click.toLocaleString("uz-UZ")}</span>
        <span>📋 Qarz: {s.qarz.toLocaleString("uz-UZ")}</span>
        {s.boshlangichQoldiq > 0 && (
          <span>Boshida: {s.boshlangichQoldiq.toLocaleString("uz-UZ")}</span>
        )}
        <span>
          Kassada qoldi: <span className="text-muted">{s.qoldirilganNaqd.toLocaleString("uz-UZ")}</span>
        </span>
      </div>

      {s.izoh && <p className="text-2xs text-faint">Izoh: {s.izoh}</p>}

      {oxirgimi && ruxsat.tahrirlaydi && (
        <button
          onClick={() => onQaytaOch(s.id)}
          disabled={loading}
          className="text-2xs text-muted hover:underline disabled:opacity-50"
        >
          Qayta ochish (xato yopilgan bo&apos;lsa)
        </button>
      )}
    </li>
  );
}

/** Bir qatorli "sarlavha → summa" satri — solishtiruv bloklarida ishlatiladi. */
export function Qator({
  belgi,
  nomi,
  summa,
  tone = "neutral",
  signed = false,
  kuchli = false,
}: {
  belgi?: string;
  nomi: string;
  summa: number;
  tone?: "income" | "expense" | "brand" | "neutral";
  signed?: boolean;
  kuchli?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className={kuchli ? "text-sm font-medium text-fg" : "text-sm text-muted"}>
        {belgi ? `${belgi} ` : ""}
        {nomi}
      </span>
      <Money value={summa} size={kuchli ? "md" : "sm"} tone={tone} signed={signed} />
    </div>
  );
}
