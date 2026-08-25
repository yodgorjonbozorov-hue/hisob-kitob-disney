"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { tizimKategoriyasi } from "@/lib/kategoriyaNom";
import { KategoriyaRoyxat } from "./KategoriyaRoyxat";
import { KategoriyaSheet } from "./KategoriyaSheet";
import { YangiKategoriya } from "./YangiKategoriya";
import { filtrla, HOLAT_VARIANTLARI, type HolatFiltr, type Kategoriya, type Tur } from "./turlar";

/** Serverdan kelgan xom `Category` qatorini sahifa satriga aylantiradi. */
function satrga(xom: Record<string, unknown>, oldingi?: Kategoriya): Kategoriya {
  const nomi = String(xom.nomi);
  const turi = String(xom.turi);
  return {
    id: String(xom.id),
    nomi,
    turi,
    tartib: Number(xom.tartib ?? 0),
    isActive: Boolean(xom.isActive),
    kgAsosli: Boolean(xom.kgAsosli),
    createdAt: String(xom.createdAt),
    tizim: tizimKategoriyasi(nomi, turi),
    // Sanoq va summa serverda hisoblanadi; bitta yozuvni saqlash ularni
    // o'zgartirmaydi, shuning uchun oldingi qiymat saqlanadi (yangi
    // kategoriyada esa nol).
    yozuvSoni: oldingi?.yozuvSoni ?? 0,
    davrSummasi: oldingi?.davrSummasi ?? 0,
  };
}

export function CategoriesClient({
  initialCategories,
  kgSavdo = false,
  oyNomi,
}: {
  initialCategories: Kategoriya[];
  /** Kg savdosi shu mijozga ochiqmi (lib/mijozXos.ts) — ustun shunda ko'rinadi. */
  kgSavdo?: boolean;
  /** "Avgust 2026" — davr summasi ustunining sarlavhasi. */
  oyNomi: string;
}) {
  const { toast } = useToast();
  const [categories, setCategories] = useState(initialCategories);
  const [tab, setTab] = useState<Tur>("kirim");
  const [q, setQ] = useState("");
  // Boshlang'ich holat — "Faol": kundalik ish faol kategoriyalar ustida
  // boradi. Nofaollari yo'qolib ketmaydi, "Nofaol"/"Barchasi" bilan qaytadi.
  const [holat, setHolat] = useState<HolatFiltr>("faol");
  const [tanlangan, setTanlangan] = useState<Kategoriya | null>(null);
  const [yangiOchiq, setYangiOchiq] = useState(false);

  const korinadigan = useMemo(
    () => filtrla(categories, tab, q, holat),
    [categories, tab, q, holat]
  );

  const jamiTabda = useMemo(
    () => categories.filter((c) => c.turi === tab).length,
    [categories, tab]
  );

  /** Bitta maydonni yangilaydi. Xato matnini qaytaradi (muvaffaqiyatda `null`). */
  async function saqla(id: string, ozgarish: Record<string, unknown>, xabar: string) {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ozgarish),
      });
      const data = await res.json();
      if (!res.ok) return String(data.error ?? "Xatolik yuz berdi");

      // RENAME XAVFSIZ: server MAVJUD qatorni yangiladi, ID o'zgarmadi —
      // shuning uchun bu yerda ham qator ALMASHTIRILADI, qo'shilmaydi.
      setCategories((prev) => prev.map((c) => (c.id === id ? satrga(data, c) : c)));
      setTanlangan(null);
      toast({ message: `✓ ${xabar}`, tone: "success" });
      return null;
    } catch {
      return "Serverga ulanib bo'lmadi";
    }
  }

  function yaratildi(xom: Record<string, unknown>) {
    const yangi = satrga(xom);
    setCategories((prev) => [...prev, yangi]);
    setYangiOchiq(false);
    // Yangi kategoriya ko'rinib turishi uchun tab va holat filtri moslashadi:
    // aks holda "yaratildi" degan xabardan keyin ro'yxatda hech nima
    // o'zgarmagandek tuyulardi.
    setTab(yangi.turi === "chiqim" ? "chiqim" : "kirim");
    if (holat === "nofaol") setHolat("barcha");
    toast({ message: `✓ "${yangi.nomi}" kategoriyasi yaratildi`, tone: "success" });
  }

  return (
    <div className="space-y-4">
      {/* ── Kirim / Chiqim ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2" role="tablist">
          <TabTugma faol={tab === "kirim"} tur="kirim" onClick={() => setTab("kirim")} />
          <TabTugma faol={tab === "chiqim"} tur="chiqim" onClick={() => setTab("chiqim")} />
        </div>
        <Button onClick={() => setYangiOchiq(true)}>+ Yangi kategoriya</Button>
      </div>

      {/* ── Qidiruv + holat filtri ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kategoriya qidirish..."
          aria-label="Kategoriya qidirish"
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm min-h-[44px]"
        />
        <Segmented
          options={HOLAT_VARIANTLARI}
          value={holat}
          onChange={setHolat}
          className="self-start sm:self-auto"
        />
      </div>

      <Card>
        {korinadigan.length === 0 ? (
          <Bosh jamiTabda={jamiTabda} qidiruv={q.trim()} holat={holat} />
        ) : (
          <KategoriyaRoyxat qatorlar={korinadigan} oyNomi={oyNomi} onTanla={setTanlangan} />
        )}
      </Card>

      {tanlangan && (
        <KategoriyaSheet
          kategoriya={tanlangan}
          oyNomi={oyNomi}
          kgSavdo={kgSavdo}
          onSaqla={saqla}
          onClose={() => setTanlangan(null)}
        />
      )}

      {yangiOchiq && (
        <YangiKategoriya
          boshlangichTur={tab}
          onYaratildi={yaratildi}
          onClose={() => setYangiOchiq(false)}
        />
      )}
    </div>
  );
}

function TabTugma({ faol, tur, onClick }: { faol: boolean; tur: Tur; onClick: () => void }) {
  const kirim = tur === "kirim";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={faol}
      onClick={onClick}
      className={`px-4 min-h-[44px] rounded-lg text-sm font-medium transition ${
        faol
          ? kirim
            ? "bg-income text-white"
            : "bg-expense text-white"
          : "bg-surface-2 text-muted hover:text-fg"
      }`}
    >
      {kirim ? "Kirim" : "Chiqim"}
    </button>
  );
}

/** Bo'sh holat — sabab bo'yicha uch xil matn (hech narsa yo'q / filtr / qidiruv). */
function Bosh({ jamiTabda, qidiruv, holat }: { jamiTabda: number; qidiruv: string; holat: HolatFiltr }) {
  const matn = qidiruv
    ? `"${qidiruv}" bo'yicha kategoriya topilmadi`
    : jamiTabda === 0
      ? "Bu turda hali kategoriya yo'q"
      : holat === "nofaol"
        ? "Nofaol kategoriya yo'q"
        : "Bu filtrga mos kategoriya yo'q";
  return <p className="text-sm text-faint py-8 text-center">{matn}</p>;
}
