"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { formatMoney, parseSomInput } from "@/lib/format";
import { TOLOV_HOLAT_NOMI } from "@/lib/crm/pipeline";
import { TOLOV_KANALLARI, TOLOV_KANAL_NOMI, tolovKanalimi } from "@/lib/crm/tolovlar";
import { TOLOV_BELGISI } from "./BuyurtmaKarta";
import type { ZakazTolovHisobiDTO } from "@/lib/crm/tolovOqish";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/** Kanal nomi — noma'lum kanal (eski yozuv) o'z matni bilan ko'rinadi. */
function kanalNomi(kanal: string): string {
  return tolovKanalimi(kanal) ? TOLOV_KANAL_NOMI[kanal] : kanal;
}

/**
 * ZAKAZ TO'LOVLARI BLOKI — pul qayerda turganining YAGONA ko'rinishi.
 *
 * ═══ NIMA O'ZGARDI ═══
 * Ilgari to'lov zakaz formasining bir qismi edi va SAQLASH qatorlarni
 * TO'LIQ ALMASHTIRARDI: "50 000 naqd + 250 000 click" kiritilgandan keyin
 * navbatdagi saqlash oldingi to'lovlarni yuvib yuborardi. Endi har to'lov
 * QO'SHILADI (`POST /api/crm/deals/[id]/tolovlar`) va tarix shu yerda
 * to'liq ko'rinadi.
 *
 * ═══ QOLDIQ ≠ QARZ ═══
 * To'lanmagan qism "Qoldiq" bo'lib turadi va qarzdorlik YARATMAYDI. Qarz
 * faqat pastdagi belgi qo'yilganda — savdo ataylab qarzga yopilganda —
 * ochiladi (yakunlash paytida).
 */
export function ZakazTolovlari({
  dealId,
  hisob,
  /** Moliya yakunlangan (qarz ochilgan) — to'lov bu yerdan qabul qilinmaydi. */
  qulf,
  onYangilandi,
}: {
  dealId: string;
  hisob: ZakazTolovHisobiDTO | null;
  qulf: boolean;
  onYangilandi: (h: ZakazTolovHisobiDTO) => void;
}) {
  const [kanal, setKanal] = useState<string>("naqd");
  const [summa, setSumma] = useState("");
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  if (!hisob) {
    return (
      <div className="rounded-xl border border-line bg-surface-2/30 p-3">
        <p className="text-2xs uppercase tracking-wide text-faint">To&apos;lovlar</p>
        <p className="text-xs text-faint pt-1">Yuklanmoqda…</p>
      </div>
    );
  }

  async function sorov(url: string, init: RequestInit) {
    setBand(true);
    setXato(null);
    try {
      const res = await fetch(url, init);
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
      setXato("To'lov summasini kiriting");
      return;
    }
    const ok = await sorov(`/api/crm/deals/${dealId}/tolovlar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kanal, summa: qiymat }),
    });
    if (ok) setSumma("");
  }

  async function bekor(tolovId: string, matn: string) {
    if (!confirm(`${matn} to'lovi bekor qilinsinmi? Bog'langan kirim savatga tushadi.`)) return;
    await sorov(`/api/crm/deals/${dealId}/tolovlar/${tolovId}`, { method: "DELETE" });
  }

  async function qarzgaBelgila(qarzga: boolean) {
    setBand(true);
    setXato(null);
    try {
      const res = await fetch(`/api/crm/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qarzga }),
      });
      const javob = await res.json();
      if (!res.ok) {
        setXato(javob.error ?? "Saqlanmadi");
        return;
      }
      if (javob.tolov) onYangilandi(javob.tolov as ZakazTolovHisobiDTO);
    } finally {
      setBand(false);
    }
  }

  const belgi = TOLOV_BELGISI[hisob.holati];

  return (
    <div className="rounded-xl border border-line bg-surface-2/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs uppercase tracking-wide text-faint">To&apos;lovlar</span>
        <Badge tone={belgi.tone}>{TOLOV_HOLAT_NOMI[hisob.holati]}</Badge>
      </div>

      {/* JAMI / TO'LANGAN / QOLDIQ — uch raqam, ikkilanishsiz. */}
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-surface px-2 py-1.5">
          <dt className="text-2xs text-faint">Jami</dt>
          <dd className="text-xs font-semibold text-fg tnum">{formatMoney(hisob.summa)}</dd>
        </div>
        <div className="rounded-lg bg-surface px-2 py-1.5">
          <dt className="text-2xs text-faint">To&apos;langan</dt>
          <dd className="text-xs font-semibold text-income tnum">{formatMoney(hisob.tolangan)}</dd>
        </div>
        <div className="rounded-lg bg-surface px-2 py-1.5">
          <dt className="text-2xs text-faint">Qoldiq</dt>
          <dd className={`text-xs font-semibold tnum ${hisob.qoldiq > 0 ? "text-debt-fg" : "text-muted"}`}>
            {formatMoney(hisob.qoldiq)}
          </dd>
        </div>
      </dl>

      {/* TO'LOV TARIXI — har qator alohida yozuv, biri ikkinchisini bosmaydi. */}
      {hisob.tolovlar.length > 0 ? (
        <ul className="space-y-1">
          {hisob.tolovlar.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-xs">
              <span className="font-medium text-fg">{kanalNomi(t.kanal)}</span>
              <span className="tnum text-fg">{formatMoney(t.summa)}</span>
              {t.sana && <span className="text-2xs text-faint tnum">{t.sana}</span>}
              {t.kirimOchirilgan && <span className="text-2xs text-expense">kirim o&apos;chirilgan</span>}
              {!qulf && (
                <button
                  type="button"
                  onClick={() => void bekor(t.id, `${kanalNomi(t.kanal)} — ${formatMoney(t.summa)}`)}
                  disabled={band}
                  aria-label="To'lovni bekor qilish"
                  className="ml-auto shrink-0 px-2 py-1 text-muted hover:text-expense disabled:opacity-40"
                >
                  🗑
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-2xs text-faint">To&apos;lov qabul qilinmagan.</p>
      )}

      {/* KANAL KESIMI — "Naqd 200 000 · Click 550 000" (bir nechta kanal bo'lsa). */}
      {hisob.kanallar.length > 1 && (
        <p className="text-2xs text-muted tnum">
          {hisob.kanallar.map((k) => `${kanalNomi(k.kanal)} ${formatMoney(k.summa)}`).join(" · ")}
        </p>
      )}

      {/* YANGI TO'LOV — QO'SHADI, almashtirmaydi. */}
      {!qulf && hisob.qoldiq > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-28 shrink-0">
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
          <button
            type="button"
            onClick={() => void qoshish()}
            disabled={band}
            className="shrink-0 rounded-lg bg-brand text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
          >
            Saqlash
          </button>
        </div>
      )}

      {/* QARZGA — QOLDIQDAN FARQLI, ATAYLAB qilinadigan tanlov. */}
      {!qulf && hisob.qoldiq > 0 && (
        <label className="flex items-start gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={hisob.qarzga}
            disabled={band}
            onChange={(e) => void qarzgaBelgila(e.target.checked)}
            className="w-5 h-5 mt-0.5"
          />
          <span>
            Qolgan {formatMoney(hisob.qoldiq)} qarzdorlikka yozilsin — savdo qarzga yopiladi.
            Belgilanmasa zakaz to&apos;liq to&apos;langunga qadar &quot;Yutildi&quot; ga o&apos;tmaydi.
          </span>
        </label>
      )}

      {qulf && (
        <p className="text-2xs text-faint">
          Qarz ochilgan — keyingi to&apos;lovlar Qarzdorlik bo&apos;limi orqali qabul qilinadi.
        </p>
      )}
      {xato && <p className="text-expense text-sm">{xato}</p>}
    </div>
  );
}
