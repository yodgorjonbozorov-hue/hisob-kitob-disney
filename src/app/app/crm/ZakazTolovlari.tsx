"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { formatMoney, parseSomInput } from "@/lib/format";
import { TOLOV_KANALLARI, TOLOV_KANAL_NOMI } from "@/lib/crm/tolovlar";
import { TOLOV_HOLAT_NOMI, type TolovHolat } from "@/lib/crm/pipeline";
import { TOLOV_BELGISI } from "./BuyurtmaKarta";
import type { ZakazTolovHisobiDTO } from "./turlar";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * ZAKAZ TO'LOVLARI — JAMI / TO'LANGAN / QOLDIQ va to'lovlar tarixi.
 *
 * ═══ NEGA QO'SHIMCHA RO'YXAT ═══
 * Ilgari to'lov faqat tahrir formasida, BUTUN ro'yxatni almashtirib
 * yozilardi — forma eskirgan snapshot bilan yuborilsa oldingi to'lovlar
 * jimgina o'chib ketardi. Bu yerda esa har "Saqlash" ayni BITTA to'lovni
 * QO'SHADI (`POST /api/crm/deals/[id]/tolov`), qolganlariga tegmaydi.
 * Har qo'shishdan keyin serverdan YANGI hisob keladi, ya'ni ekrandagi
 * raqam har doim bazadagi raqam.
 *
 * ═══ QOLDIQ ≠ QARZ ═══
 * "Qoldiq" — hali kelmagan pul, QARZ EMAS. Zakaz jarayonda turganda
 * hech qanday qarzdorlik yozuvi ochilmaydi; qarz faqat yakunlash
 * oynasidagi aniq tanlov bilan paydo bo'ladi.
 */
export function ZakazTolovlari({
  dealId,
  hisob,
  /** To'lov qo'shish mumkinmi (yakunlanmagan, qarzga yopilmagan zakaz). */
  qoshaOladi,
  /** OWNER/ADMIN mi — xato yozilgan to'lovni olib tashlash uchun. */
  boshqaruvchi,
  onYangilandi,
}: {
  dealId: string;
  /** null — hali yuklanmagan. */
  hisob: ZakazTolovHisobiDTO | null;
  qoshaOladi: boolean;
  boshqaruvchi: boolean;
  onYangilandi: (yangi: ZakazTolovHisobiDTO) => void;
}) {
  const [ochiq, setOchiq] = useState(false);
  const [kanal, setKanal] = useState<string>("naqd");
  const [summa, setSumma] = useState("");
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function soraT(yol: string, init: RequestInit): Promise<boolean> {
    setBand(true);
    setXato(null);
    try {
      const res = await fetch(yol, init);
      const javob = await res.json();
      if (!res.ok) {
        setXato(javob.error ?? "Amal bajarilmadi");
        return false;
      }
      onYangilandi(javob as ZakazTolovHisobiDTO);
      return true;
    } finally {
      setBand(false);
    }
  }

  async function qoshish() {
    const qiymat = summa ? parseSomInput(summa) : 0;
    if (qiymat <= 0) {
      setXato("To'lov summasi kiritilsin");
      return;
    }
    // Tekshiruv qulaylik uchun — server ham AYNI qoidani majburlaydi.
    if (hisob && qiymat > hisob.qoldiq) {
      setXato(`To'lov qoldiqdan ko'p. Qoldiq: ${formatMoney(hisob.qoldiq)}`);
      return;
    }
    const ok = await soraT(`/api/crm/deals/${dealId}/tolov`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kanal, summa: qiymat }),
    });
    if (ok) {
      setSumma("");
      setOchiq(false);
    }
  }

  async function ochirish(tolovId: string) {
    if (!confirm("To'lov olib tashlansinmi? Kirim yozuvi savatga o'tadi.")) return;
    await soraT(`/api/crm/deals/${dealId}/tolov/${tolovId}`, { method: "DELETE" });
  }

  if (!hisob) {
    return (
      <div className="rounded-xl border border-line bg-surface-2/30 p-3">
        <p className="text-2xs uppercase tracking-wide text-faint">To&apos;lovlar</p>
        <p className="text-xs text-faint pt-1">Yuklanmoqda...</p>
      </div>
    );
  }

  const holat = hisob.holati as TolovHolat;
  const belgi = TOLOV_BELGISI[holat] ?? TOLOV_BELGISI.TANLANMAGAN;

  return (
    <div className="rounded-xl border border-line bg-surface-2/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs uppercase tracking-wide text-faint">To&apos;lovlar</p>
        <Badge tone={belgi.tone}>{TOLOV_HOLAT_NOMI[holat] ?? holat}</Badge>
      </div>

      {/* HISOB — uch qator, chalkashsiz: qoldiq qarz EMAS. */}
      <dl className="text-sm tnum space-y-0.5">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Jami</dt>
          <dd className="text-fg font-medium">{formatMoney(hisob.summa)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">To&apos;langan</dt>
          <dd className="text-income font-medium">{formatMoney(hisob.tolangan)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Qoldiq</dt>
          <dd className={hisob.qoldiq > 0 ? "text-debt-fg font-medium" : "text-muted"}>
            {formatMoney(hisob.qoldiq)}
          </dd>
        </div>
      </dl>
      {hisob.ortiqcha > 0 && (
        <p className="text-2xs text-expense">
          Diqqat: zakaz summasidan {formatMoney(hisob.ortiqcha)} ortiqcha to&apos;lov yozilgan.
        </p>
      )}

      {/* TO'LOVLAR TARIXI — har biri alohida qator, hech biri yo'qolmaydi. */}
      {hisob.tolovlar.length > 0 ? (
        <ul className="space-y-1 pt-1">
          {hisob.tolovlar.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-fg">
                {TOLOV_KANAL_NOMI[t.kanal as keyof typeof TOLOV_KANAL_NOMI] ?? t.kanal}
                {t.kirimSana ? <span className="text-faint"> · {t.kirimSana}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                <span className="tnum font-medium text-fg">{formatMoney(t.summa)}</span>
                {boshqaruvchi && (
                  <button
                    type="button"
                    onClick={() => void ochirish(t.id)}
                    disabled={band}
                    aria-label="To'lovni olib tashlash"
                    className="text-muted hover:text-expense disabled:opacity-40"
                  >
                    ✕
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-2xs text-faint">To&apos;lov hali kiritilmagan.</p>
      )}

      {/* QO'SHISH — bitta to'lov, oldingilariga tegmaydi. */}
      {qoshaOladi && hisob.qoldiq > 0 && (
        <div className="pt-1">
          {ochiq ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-32 shrink-0">
                  <Select
                    value={kanal}
                    onChange={setKanal}
                    aria-label="To'lov turi"
                    options={TOLOV_KANALLARI.map((k) => ({ value: k, label: TOLOV_KANAL_NOMI[k] }))}
                  />
                </div>
                <input
                  value={summa}
                  onChange={(e) => setSumma(e.target.value)}
                  placeholder={String(hisob.qoldiq)}
                  inputMode="numeric"
                  aria-label="To'lov summasi"
                  className={INPUT}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void qoshish()}
                  disabled={band}
                  className="flex-1 rounded-lg bg-income text-white text-sm font-medium py-2 disabled:opacity-60"
                >
                  {band ? "Saqlanmoqda..." : "Saqlash"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOchiq(false);
                    setXato(null);
                  }}
                  className="rounded-lg border border-line px-4 py-2 text-sm text-muted"
                >
                  Bekor
                </button>
              </div>
              <p className="text-2xs text-faint">
                To&apos;lov saqlansa pul o&apos;sha zahoti Kirimga tushadi. Zakaz holati
                o&apos;zgarmaydi va qolgan summa qarzga yozilmaydi.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOchiq(true)}
              className="text-brand text-sm font-medium"
            >
              + To&apos;lov qo&apos;shish
            </button>
          )}
        </div>
      )}

      {xato && <p className="text-expense text-sm">{xato}</p>}
    </div>
  );
}
