"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SmenaDTO, SmenaHolatDTO } from "@/lib/queries/smena";
import type { KunlikRuxsat } from "@/lib/services/kunlik";
import { SmenaYopishModal } from "./SmenaYopishModal";
import { soatToshkent } from "./vaqt";

/** Farq satri — nazoratning yuragi: kam chiqqan pul darhol ko'rinadi. */
function Farq({ farq }: { farq: number }) {
  if (farq === 0) return <span className="text-brand font-medium">✅ Mos</span>;
  return (
    <span className="text-expense font-semibold">
      {farq < 0
        ? `⚠️ KAM: −${Math.abs(farq).toLocaleString("uz-UZ")} so'm`
        : `⚠️ Ortiqcha: +${farq.toLocaleString("uz-UZ")} so'm`}
    </span>
  );
}

function YopilganSmena({
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
  return (
    <li className="py-3 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-fg">
          {s.raqam}-smena
          <span className="text-muted font-normal">
            {" "}
            · {soatToshkent(s.boshlanishAt)}–{soatToshkent(s.tugashAt)} ·{" "}
            {s.yopganIsm ?? "—"}
          </span>
        </p>
        <Farq farq={s.farq} />
      </div>
      <div className="text-2xs text-muted tnum flex flex-wrap gap-x-3 gap-y-0.5">
        <span>
          Tizim hisobi: <span className="text-fg">{s.kutilganNaqd.toLocaleString("uz-UZ")}</span>
        </span>
        <span>
          Sanaldi: <span className="text-fg">{s.sanalganNaqd.toLocaleString("uz-UZ")}</span>
        </span>
        <span>💵 {s.naqd.toLocaleString("uz-UZ")}</span>
        <span>💳 {s.click.toLocaleString("uz-UZ")}</span>
        <span>📋 {s.qarz.toLocaleString("uz-UZ")}</span>
        {s.naqdChiqim > 0 && <span>📉 {s.naqdChiqim.toLocaleString("uz-UZ")}</span>}
        {s.boshlangichQoldiq > 0 && (
          <span>Boshida: {s.boshlangichQoldiq.toLocaleString("uz-UZ")}</span>
        )}
        <span>
          Kassada qoldi:{" "}
          <span className="text-fg">{s.qoldirilganNaqd.toLocaleString("uz-UZ")}</span>
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

/**
 * SMENA KARTASI — ikki smenali savdo uchun kassa nazorati.
 *
 * Joriy smena oxirgi yopilgan smenadan boshlanadi: 1-smena yopilib pul
 * topshirilgach, 2-smena 0 dan boshlanadi va o'z puli bilan yuradi.
 * Kunning JAMI kirim/chiqim raqamlariga tegilmaydi — smena kun ichidagi kesim.
 *
 * Tizim hisobi (kutilgan naqd) joriy smena uchun faqat direktor/boshqaruvchiga
 * ko'rsatiladi: xodim uni oldindan ko'rsa sanashning ma'nosi qolmaydi.
 */
export function SmenaCard({
  holat,
  ruxsat,
  bugungi,
}: {
  holat: SmenaHolatDTO;
  ruxsat: KunlikRuxsat;
  bugungi: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const joriy = holat.joriy;
  const oxirgiId = holat.yopilganlar[holat.yopilganlar.length - 1]?.id;

  async function qaytaOch(smenaId: string) {
    if (!confirm("Bu smena qayta ochilsinmi? Yozuvi o'chadi, raqamlari joriy smenaga qaytadi.")) {
      return;
    }
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kunlik/smena/qayta-ochish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smenaId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Qayta ochib bo'lmadi");
        return;
      }
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">🔁 Smena nazorati</p>
          {joriy ? (
            <>
              <p className="text-lg font-semibold text-fg mt-1">
                {joriy.raqam}-smena · ochiq
                <span className="text-sm text-muted font-normal">
                  {" "}
                  {soatToshkent(joriy.boshlanishAt)} dan beri
                </span>
              </p>
              {ruxsat.tarixniKoradi ? (
                <p className="text-sm text-muted mt-1 tnum">
                  Kassada bo&apos;lishi kerak:{" "}
                  <span className="text-fg font-medium">
                    {joriy.kutilganNaqd.toLocaleString("uz-UZ")} so&apos;m
                  </span>
                  {joriy.boshlangichQoldiq > 0 && (
                    <span className="text-faint">
                      {" "}
                      (boshida {joriy.boshlangichQoldiq.toLocaleString("uz-UZ")})
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted mt-1">
                  Smena oxirida kassadagi naqdni sanab kiriting.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted mt-1">
              O&apos;tgan kun — shu kunda yopilgan smenalar quyida.
            </p>
          )}
        </div>
        {joriy && bugungi && (
          <div className="text-right">
            <Button onClick={() => setModal(true)}>🔒 Smenani yopish</Button>
            <p className="text-2xs text-faint mt-1">Pul topshiriladi, keyingisi 0 dan boshlanadi</p>
          </div>
        )}
      </div>

      {holat.yopilganlar.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {holat.yopilganlar.map((s) => (
            <YopilganSmena
              key={s.id}
              s={s}
              oxirgimi={s.id === oxirgiId && bugungi}
              ruxsat={ruxsat}
              onQaytaOch={qaytaOch}
              loading={loading}
            />
          ))}
        </ul>
      )}

      {holat.yopilganlar.length === 0 && joriy && (
        <p className="text-2xs text-faint mt-3">
          Bugun hali smena yopilmagan. Birinchi smena tugaganda kassani sanab yoping — ikkinchi
          smena o&apos;z puli bilan alohida hisoblanadi.
        </p>
      )}

      {xato && <p className="text-sm text-expense mt-3">{xato}</p>}

      {modal && joriy && (
        <SmenaYopishModal
          raqam={joriy.raqam}
          onClose={() => setModal(false)}
          onDone={() => {
            setModal(false);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}
