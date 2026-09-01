"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { TOLOV_HOLATLARI, TOLOV_HOLAT_NOMI } from "@/lib/crm/pipeline";
import type { KategoriyaDTO, XodimDTO } from "./turlar";

/** Tez sana tanlovlari (12-talab). "Custom" — ikkita sana maydoni. */
type SanaTanlov = "hammasi" | "bugun" | "ertaga" | "hafta" | "oy" | "oraliq";

const SANA_NOMI: Record<SanaTanlov, string> = {
  hammasi: "Barchasi",
  bugun: "Bugun",
  ertaga: "Ertaga",
  hafta: "Shu hafta",
  oy: "Shu oy",
  oraliq: "Oraliq",
};

const KUN_MS = 24 * 60 * 60 * 1000;
const kun = (bugun: string, delta: number) =>
  new Date(Date.parse(`${bugun}T00:00:00.000Z`) + delta * KUN_MS).toISOString().slice(0, 10);

/**
 * Tanlovdan sana oralig'i. Hisob TOSHKENT kuni ustida yuritiladi (`bugun`
 * serverdan keladi) — brauzer vaqt mintaqasi natijani surib yubormaydi.
 * Hafta DUSHANBADAN boshlanadi.
 */
function oraliqHisobla(tanlov: SanaTanlov, bugun: string): { from: string; to: string } | null {
  if (tanlov === "bugun") return { from: bugun, to: bugun };
  if (tanlov === "ertaga") return { from: kun(bugun, 1), to: kun(bugun, 1) };
  if (tanlov === "hafta") {
    // getUTCDay: 0 — yakshanba; dushanbagacha necha kun orqaga.
    const orqaga = (new Date(`${bugun}T00:00:00.000Z`).getUTCDay() + 6) % 7;
    return { from: kun(bugun, -orqaga), to: kun(bugun, 6 - orqaga) };
  }
  if (tanlov === "oy") {
    const [y, m] = bugun.split("-").map(Number);
    const oxirgi = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${bugun.slice(0, 7)}-01`, to: `${bugun.slice(0, 7)}-${String(oxirgi).padStart(2, "0")}` };
  }
  return null;
}

const INPUT =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * DOSKA FILTRI (12-talab): sana, sotuvchi, kategoriya, to'lov holati.
 *
 * Filtr URL'da saqlanadi — sahifa server tomonda ayni shu shart bilan
 * o'qiladi, ya'ni ustun sarlavhalaridagi soni/summa filtr bilan mos keladi
 * va havola ulashsa boshqasida ham o'sha kesim ochiladi.
 */
export function DoskaFiltr({
  filtr,
  kategoriyalar,
  xodimlar,
  bugun,
}: {
  filtr: { from: string; to: string; masulId: string; categoryId: string; tolov: string };
  kategoriyalar: KategoriyaDTO[];
  xodimlar: XodimDTO[];
  bugun: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function yangila(ozgarish: Record<string, string | null>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(ozgarish)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.push(`/app/crm${p.toString() ? `?${p.toString()}` : ""}`);
  }

  // Joriy sana tanlovini URL'dagi oraliqdan qayta aniqlaymiz (holat URL'da).
  const joriySana: SanaTanlov = !filtr.from && !filtr.to
    ? "hammasi"
    : (["bugun", "ertaga", "hafta", "oy"] as SanaTanlov[]).find((t) => {
        const o = oraliqHisobla(t, bugun);
        return o && o.from === filtr.from && o.to === filtr.to;
      }) ?? "oraliq";

  const filtrBor = Boolean(filtr.from || filtr.to || filtr.masulId || filtr.categoryId || filtr.tolov);

  return (
    <div className="bg-surface rounded-2xl border border-line p-3 space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(SANA_NOMI) as SanaTanlov[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              if (t === "hammasi") return yangila({ from: null, to: null });
              if (t === "oraliq") return yangila({ from: filtr.from || bugun, to: filtr.to || bugun });
              const o = oraliqHisobla(t, bugun);
              yangila({ from: o?.from ?? null, to: o?.to ?? null });
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              joriySana === t
                ? "bg-brand text-white border-transparent"
                : "border-line text-muted hover:border-brand/50"
            }`}
          >
            {SANA_NOMI[t]}
          </button>
        ))}
      </div>

      {joriySana === "oraliq" && (
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="date"
            aria-label="Boshlanish sanasi"
            value={filtr.from}
            onChange={(e) => yangila({ from: e.target.value || null })}
            className={INPUT}
          />
          <span className="text-xs text-faint">—</span>
          <input
            type="date"
            aria-label="Tugash sanasi"
            value={filtr.to}
            onChange={(e) => yangila({ to: e.target.value || null })}
            className={INPUT}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="block text-2xs text-faint" htmlFor="df-sotuvchi">Sotuvchi</label>
          <Select
            id="df-sotuvchi"
            value={filtr.masulId}
            onChange={(v) => yangila({ masulId: v || null })}
            searchable={xodimlar.length > 7}
            options={[{ value: "", label: "Barchasi" }, ...xodimlar.map((x) => ({ value: x.id, label: x.ism }))]}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-2xs text-faint" htmlFor="df-kategoriya">Kategoriya</label>
          <Select
            id="df-kategoriya"
            value={filtr.categoryId}
            onChange={(v) => yangila({ categoryId: v || null })}
            searchable={kategoriyalar.length > 7}
            options={[
              { value: "", label: "Barchasi" },
              ...kategoriyalar.map((k) => ({ value: k.id, label: k.nomi })),
            ]}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-2xs text-faint" htmlFor="df-tolov">To&apos;lov holati</label>
          <Select
            id="df-tolov"
            value={filtr.tolov}
            onChange={(v) => yangila({ tolov: v || null })}
            options={[
              { value: "", label: "Barchasi" },
              ...TOLOV_HOLATLARI.map((t) => ({ value: t, label: TOLOV_HOLAT_NOMI[t] })),
            ]}
          />
        </div>
      </div>

      {filtrBor && (
        <button
          onClick={() => yangila({ from: null, to: null, masulId: null, categoryId: null, tolov: null })}
          className="text-xs text-brand font-medium"
        >
          Filtrni tozalash
        </button>
      )}
    </div>
  );
}
