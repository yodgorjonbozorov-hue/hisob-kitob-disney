"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";
import type { KanalKesimDTO } from "@/lib/queries/topshirishKanali";
import type { TopshirishNishoni } from "./SmenaTopshirishModal";

/**
 * KASSA TOPSHIRISHNING TASDIQ OYNASI.
 *
 * Alohida fayl: forma va tasdiq bitta komponentda 250 satrdan oshib
 * ketardi (loyiha qoidasi). Bu yerda hech qanday mantiq yo'q — faqat
 * formada hisoblangan raqamlarni takrorlab ko'rsatadi, chunki pul
 * yozadigan amal oldidan odam nimani tasdiqlayotganini ko'rishi kerak.
 */
export function SmenaTopshirishTasdiq({
  sarlavha,
  nishon,
  naqd,
  naqdQoldiq,
  farq,
  online,
  jami,
  loading,
  xato,
  onOrqaga,
  onTasdiq,
}: {
  sarlavha: string;
  nishon: TopshirishNishoni | undefined;
  /** Topshirilayotgan naqd summa. */
  naqd: number;
  /** Tizim hisoblagan naqd kassa qoldig'i. */
  naqdQoldiq: number;
  /** `naqd − naqdQoldiq`: manfiy — kamomad, musbat — ortiqcha. */
  farq: number;
  /** Tanlangan online kanallar (summalari server hisobidan). */
  online: KanalKesimDTO[];
  /** Naqd + tanlangan online kanallar yig'indisi. */
  jami: number;
  loading: boolean;
  xato: string | null;
  onOrqaga: () => void;
  onTasdiq: () => void;
}) {
  return (
    <Modal open onClose={onOrqaga} title={`${sarlavha}ni tasdiqlaysizmi?`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 border border-line p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Kimga</span>
            <span className="text-fg font-medium">{nishon?.egaIsm ?? nishon?.nomi}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Naqd</span>
            <span className="text-fg font-semibold tnum">{formatMoney(naqd)}</span>
          </div>
          {online.map((k) => (
            <div key={k.kanal} className="flex justify-between">
              <span className="text-muted">{k.nomi}</span>
              <span className="text-fg font-semibold tnum">{formatMoney(k.summa)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-line pt-2">
            <span className="text-fg font-medium">Jami topshirish</span>
            <span className="text-fg font-bold tnum">{formatMoney(jami)}</span>
          </div>
          {naqd > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">Naqd kassadagi hisob</span>
              <span className="text-fg tnum">{formatMoney(naqdQoldiq)}</span>
            </div>
          )}
          {farq !== 0 && (
            <div className="flex justify-between border-t border-line pt-2">
              <span className={farq < 0 ? "text-expense" : "text-debt"}>
                {farq < 0 ? "Kamomad" : "Ortiqcha"}
              </span>
              <span className={`tnum font-semibold ${farq < 0 ? "text-expense" : "text-debt"}`}>
                {farq > 0 ? "+" : "−"}
                {Math.abs(farq).toLocaleString("ru-RU")}
              </span>
            </div>
          )}
        </div>
        <p className="text-2xs text-muted">
          {nishon?.egaIsm ?? "Qabul qiluvchi"} tasdiqlamaguncha naqd pul sizning kassangizda
          qoladi. Online summalar kassa qoldig&apos;ini o&apos;zgartirmaydi — ular hisobot
          sifatida topshiriladi.
        </p>
        {xato && <p className="text-sm text-expense">{xato}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onOrqaga} disabled={loading}>
            Orqaga
          </Button>
          <Button type="button" loading={loading} disabled={loading} onClick={onTasdiq}>
            Topshirish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
