"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatSom } from "@/lib/format";
import { PulModal } from "./PulModal";
import { AmalRoyxati } from "./AmalRoyxati";
import { boshFormasi } from "./usePulFormasi";
import { pulFormasiga } from "./tahrirHolati";
import type {
  KassaOption,
  KategoriyaOption,
  PulFormasi,
  PulHarakatiDTO,
} from "./turlar";

type Tab = "hammasi" | "kirim" | "chiqim";

const TAB_NOMI: Record<Tab, string> = {
  hammasi: "Hammasi",
  kirim: "Kirim",
  chiqim: "Chiqim",
};

/**
 * MOLIYA BO'LIMI — ikkita asosiy amal va bitta ro'yxat.
 *
 * Sahifada faqat IKKI tugma bor: "+ Pul oldim" va "− Pul berdim". Qolgan
 * hamma narsa (kategoriya, kassa, qarz) shu ikkitasining ichida hal bo'ladi —
 * direktor pul harakatini eng qisqa yo'ldan kiritishi kerak (14-talab).
 */
export function MoliyaClient({
  boshlangichItems,
  boshlangichTotals,
  kassalar,
  kategoriyalar,
  boshqaruvchi,
}: {
  boshlangichItems: PulHarakatiDTO[];
  boshlangichTotals: { jamiKirim: number; jamiChiqim: number; sof: number } | null;
  kassalar: KassaOption[];
  kategoriyalar: KategoriyaOption[];
  boshqaruvchi: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("hammasi");
  const [items, setItems] = useState(boshlangichItems);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [forma, setForma] = useState<PulFormasi | null>(null);
  const [tahrirAmalId, setTahrirAmalId] = useState<string | null>(null);
  const [bandAmalId, setBandAmalId] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  const yukla = useCallback(async (t: Tab) => {
    setYuklanmoqda(true);
    try {
      const sp = new URLSearchParams({ pageSize: "30" });
      if (t !== "hammasi") sp.set("turi", t);
      const res = await fetch(`/api/moliya?${sp.toString()}`);
      if (res.ok) setItems((await res.json()).items);
    } finally {
      setYuklanmoqda(false);
    }
  }, []);

  // Birinchi ko'rinish SERVERDAN keldi (page.tsx), shuning uchun birinchi
  // renderda qayta so'ralmaydi — keyingi tab almashishlarida esa har doim
  // so'raladi, aks holda "Kirim" dan "Hammasi" ga qaytganda ro'yxat
  // filtrlangan holida qolib ketardi.
  const birinchiRender = useRef(true);
  useEffect(() => {
    if (birinchiRender.current) {
      birinchiRender.current = false;
      return;
    }
    void yukla(tab);
  }, [tab, yukla]);

  function och(yonalish: "kirim" | "chiqim") {
    setXato(null);
    setTahrirAmalId(null);
    setForma(boshFormasi(yonalish, ""));
  }

  function tahrirniOch(amal: PulHarakatiDTO) {
    setXato(null);
    setTahrirAmalId(amal.amalId);
    setForma(pulFormasiga(amal, kategoriyalar));
  }

  async function bekorQil(amal: PulHarakatiDTO) {
    if (!amal.amalId) return;
    const savol = amal.qarzBogliq
      ? "Bu amal bekor qilinsin? Kassa qoldig'i qaytariladi va qarz oldingi holatiga tiklanadi."
      : "Bu amal bekor qilinsin? Kassa qoldig'i qaytariladi.";
    if (!window.confirm(savol)) return;

    setBandAmalId(amal.amalId);
    setXato(null);
    try {
      const res = await fetch(`/api/moliya/${amal.amalId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sabab: "Moliya bo'limidan bekor qilindi" }),
      });
      if (!res.ok) {
        setXato((await res.json()).error ?? "Bekor qilib bo'lmadi");
        return;
      }
      await yangila();
    } catch {
      setXato("Tarmoq xatosi — qayta urinib ko'ring");
    } finally {
      setBandAmalId(null);
    }
  }

  const yangila = useCallback(async () => {
    await yukla(tab);
    // Kassa qoldig'i va bosh sahifa kartalari server komponentda —
    // ular yangi ma'lumot bilan qayta chizilishi kerak.
    router.refresh();
  }, [router, tab, yukla]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Moliya</h1>
      </div>

      {/* IKKI ASOSIY AMAL — eng katta va eng yuqorida. */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => och("kirim")}
          className="min-h-[64px] rounded-2xl bg-income text-white text-base font-semibold shadow-sm hover:brightness-110 transition"
        >
          + PUL OLDIM
        </button>
        <button
          type="button"
          onClick={() => och("chiqim")}
          className="min-h-[64px] rounded-2xl bg-expense text-white text-base font-semibold shadow-sm hover:brightness-110 transition"
        >
          − PUL BERDIM
        </button>
      </div>

      {boshlangichTotals && (
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-surface p-3 text-center">
          <div>
            <p className="text-2xs text-faint">Kirim</p>
            <p className="text-sm font-semibold text-income tnum">
              {formatSom(boshlangichTotals.jamiKirim)}
            </p>
          </div>
          <div>
            <p className="text-2xs text-faint">Chiqim</p>
            <p className="text-sm font-semibold text-expense tnum">
              {formatSom(boshlangichTotals.jamiChiqim)}
            </p>
          </div>
          <div>
            <p className="text-2xs text-faint">Sof</p>
            <p className="text-sm font-semibold text-fg tnum">
              {formatSom(boshlangichTotals.sof)}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
        {(["hammasi", "kirim", "chiqim"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 min-h-[40px] rounded-lg text-sm transition ${
              tab === t ? "bg-brand-wash text-brand font-medium" : "text-muted hover:text-fg"
            }`}
          >
            {TAB_NOMI[t]}
          </button>
        ))}
      </div>

      {xato && <p className="text-sm text-expense">{xato}</p>}

      {yuklanmoqda ? (
        <p className="text-sm text-faint py-6 text-center">Yuklanmoqda...</p>
      ) : (
        <AmalRoyxati
          items={items}
          boshqaruvchi={boshqaruvchi}
          onTahrir={tahrirniOch}
          onBekor={bekorQil}
          bandAmalId={bandAmalId}
        />
      )}

      {forma && (
        <PulModal
          // Kalit bilan qayta yaratiladi: har ochilishda yangi `amalId` va
          // toza forma holati bo'lishi shart (takror bosish himoyasi).
          key={`${forma.yonalish}:${tahrirAmalId ?? "yangi"}`}
          ochiq
          onClose={() => setForma(null)}
          boshlangich={forma}
          kassalar={kassalar}
          kategoriyalar={kategoriyalar}
          tahrirAmalId={tahrirAmalId}
          onSaqlandi={yangila}
        />
      )}
    </div>
  );
}
