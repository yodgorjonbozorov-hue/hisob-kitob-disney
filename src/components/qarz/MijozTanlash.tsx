"use client";

import { useEffect, useRef, useState } from "react";
import { formatSomLabel } from "@/lib/format";
import { telKorinish } from "@/lib/validation/qarz";
import { YangiMijozForm } from "./YangiMijozForm";
import { QarzOldinKorish } from "./QarzOldinKorish";

export interface MijozTaklif {
  contactId: string | null;
  ism: string;
  tel: string | null;
  ochiqQarz: number;
}

export interface MijozTanlov {
  contactId: string | null;
  ism: string;
  tel: string;
  /** Tanlangan mijozning JORIY ochiq qarzi (serverdan). Noma'lum — `undefined`. */
  ochiqQarz?: number;
}

/**
 * MIJOZ TANLASH — qidiruv, mavjud mijozni tanlash va yangi mijoz yaratish.
 *
 * NEGA MUHIM: qarz bir MIJOZGA tegishli, bitta hodisaga emas. Kassir ismni
 * har safar qo'lda yozsa "Ali", "Ali " va "Ali Valiyev" uchta qarzdor bo'lib
 * ko'rinardi. Shuning uchun bu yerda mavjud mijozni topish — asosiy yo'l,
 * qo'lda yozish esa zaxira.
 *
 * Qidiruv ISM va TELEFON bo'yicha, natijada har mijozning JORIY QARZI
 * ko'rinadi (serverda hisoblangan). Topilmasa — "+ Yangi mijoz" paneli.
 */
export function MijozTanlash({
  qiymat,
  onChange,
  disabled,
  /** Kiritilayotgan yangi qarz summasi — "Yangi jami" ni ko'rsatish uchun. */
  yangiSumma = 0,
}: {
  qiymat: MijozTanlov;
  onChange: (v: MijozTanlov) => void;
  disabled?: boolean;
  yangiSumma?: number;
}) {
  const [takliflar, setTakliflar] = useState<MijozTaklif[]>([]);
  const [ochiq, setOchiq] = useState(false);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [yangiPanel, setYangiPanel] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const tanlangan = qiymat.contactId !== null;

  // Qidiruv "debounce" bilan — har harfda so'rov ketmasin.
  useEffect(() => {
    if (!ochiq) return;
    const t = setTimeout(async () => {
      setYuklanmoqda(true);
      try {
        const res = await fetch(`/api/debts/mijozlar?q=${encodeURIComponent(qiymat.ism)}`);
        if (res.ok) setTakliflar(await res.json());
      } catch {
        setTakliflar([]);
      } finally {
        setYuklanmoqda(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [qiymat.ism, ochiq]);

  // Tanlangan mijozning joriy qarzi noma'lum bo'lsa (masalan qarzdor
  // kartochkasidan oldindan to'ldirilgan) — serverdan so'raladi.
  useEffect(() => {
    const id = qiymat.contactId;
    if (!id || qiymat.ochiqQarz !== undefined) return;
    let bekor = false;
    (async () => {
      try {
        const res = await fetch(`/api/debts/mijozlar?contactId=${encodeURIComponent(id)}`);
        if (!res.ok || bekor) return;
        const javob = await res.json();
        if (!bekor) onChange({ ...qiymat, ochiqQarz: javob.ochiqQarz ?? 0 });
      } catch {
        /* qarz paneli ko'rsatilmaydi — sotuvga to'sqinlik qilmasin */
      }
    })();
    return () => {
      bekor = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qiymat.contactId, qiymat.ochiqQarz]);

  // Tashqariga bosilganda ro'yxat yopiladi.
  useEffect(() => {
    function tashqari(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOchiq(false);
    }
    document.addEventListener("mousedown", tashqari);
    return () => document.removeEventListener("mousedown", tashqari);
  }, []);

  function yanginiOch() {
    setOchiq(false);
    setYangiPanel(true);
  }

  if (yangiPanel) {
    return (
      <YangiMijozForm
        boshlangichIsm={qiymat.ism}
        onYaratildi={(m) => {
          onChange(m);
          setYangiPanel(false);
        }}
        onBekor={() => setYangiPanel(false)}
      />
    );
  }

  const bosh = !yuklanmoqda && takliflar.length === 0;

  return (
    <div className="space-y-3">
      <div ref={wrapRef} className="relative">
        <label className="block text-xs font-medium text-muted mb-1" htmlFor="qarz-mijoz">
          Mijoz <span className="text-expense">*</span>
        </label>
        <div className="relative">
          <input
            id="qarz-mijoz"
            type="text"
            value={qiymat.ism}
            disabled={disabled}
            onChange={(e) => {
              // Ism qo'lda o'zgartirilsa kartochka bog'lanishi uziladi —
              // aks holda boshqa mijozning kartochkasiga qarz yozilardi.
              onChange({
                contactId: null,
                ism: e.target.value,
                tel: tanlangan ? "" : qiymat.tel,
                ochiqQarz: undefined,
              });
              setOchiq(true);
            }}
            onFocus={() => setOchiq(true)}
            placeholder="Mijozni qidiring (ism yoki telefon)"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm pr-8"
            autoComplete="off"
          />
          {tanlangan && (
            <button
              type="button"
              onClick={() =>
                onChange({ contactId: null, ism: "", tel: "", ochiqQarz: undefined })
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-fg text-sm"
              aria-label="Mijozni tozalash"
            >
              ×
            </button>
          )}
        </div>

        {ochiq && (
          <div className="absolute z-40 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-line bg-surface shadow-card">
            {yuklanmoqda && takliflar.length === 0 && (
              <p className="px-3 py-2 text-xs text-faint">Qidirilmoqda...</p>
            )}
            {bosh && <p className="px-3 py-2 text-xs text-faint">Mijoz topilmadi</p>}
            {takliflar.map((m) => (
              <button
                key={m.contactId ?? `ism:${m.ism}`}
                type="button"
                onClick={() => {
                  onChange({
                    contactId: m.contactId,
                    ism: m.ism,
                    tel: m.tel ?? "",
                    ochiqQarz: m.ochiqQarz,
                  });
                  setOchiq(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-surface-2 border-b border-line last:border-0"
              >
                <span className="block text-sm text-fg">{m.ism}</span>
                <span className="flex justify-between gap-2 text-2xs text-muted">
                  <span>{m.tel ? telKorinish(m.tel) : "telefonsiz"}</span>
                  <span className={m.ochiqQarz > 0 ? "text-debt" : "text-faint"}>
                    Qarz: {formatSomLabel(m.ochiqQarz)}
                  </span>
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={yanginiOch}
              className="w-full text-left px-3 py-2 text-xs font-medium text-brand hover:bg-brand/5 border-t border-line"
            >
              + Yangi mijoz{qiymat.ism.trim() ? ` — "${qiymat.ism.trim()}"` : ""}
            </button>
          </div>
        )}
      </div>

      {tanlangan ? (
        <QarzOldinKorish
          ism={qiymat.ism}
          hozirgi={qiymat.ochiqQarz ?? null}
          yangi={yangiSumma}
          yuklanmoqda={qiymat.ochiqQarz === undefined}
        />
      ) : (
        <div>
          <label className="block text-xs font-medium text-muted mb-1" htmlFor="qarz-tel">
            Telefon <span className="text-expense">*</span>
          </label>
          <input
            id="qarz-tel"
            type="tel"
            inputMode="tel"
            value={qiymat.tel}
            disabled={disabled}
            onChange={(e) => onChange({ ...qiymat, tel: e.target.value })}
            placeholder="+998 __ ___ __ __"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <p className="text-2xs text-faint mt-1">
            Kartochkasiz yozilsa qarzlar ism bo&apos;yicha jamlanadi — mijozni
            ro&apos;yxatdan tanlagan ma&apos;qul.
          </p>
        </div>
      )}
    </div>
  );
}
