"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";

interface StageDTO {
  id: string;
  nomi: string;
  turi: string; // OPEN | WON | LOST
}
interface DealDTO {
  id: string;
  nomi: string;
  summa: number;
  stageId: string;
  kontakt: string | null;
  tel: string | null;
}
interface ActivityDTO {
  id: string;
  turi: string;
  matn: string;
  createdAt: string;
}

const STAGE_RANG: Record<string, string> = {
  OPEN: "border-line",
  WON: "border-income/50",
  LOST: "border-expense/40",
};

/** CRM kanban doskasi: drag&drop + karta tafsiloti + yangi bitim (3 klik). */
export function CrmClient({ stages, deals }: { stages: StageDTO[]; deals: DealDTO[] }) {
  const router = useRouter();
  const [yangiOchiq, setYangiOchiq] = useState(false);
  const [tanlangan, setTanlangan] = useState<DealDTO | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  async function kochirish(dealId: string, stage: StageDTO) {
    setXato(null);
    // Yutildi bosqichi: 1 klik bilan MOLIYA'ga kirim yozish taklifi.
    let kirimYoz = false;
    const deal = deals.find((d) => d.id === dealId);
    if (stage.turi === "WON" && deal && deal.summa > 0) {
      kirimYoz = confirm(`"${deal.nomi}" yutildi! ${formatMoney(deal.summa)} kirim sifatida yozilsinmi?`);
    }
    const res = await fetch(`/api/crm/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: stage.id, kirimYoz }),
    });
    if (!res.ok) {
      setXato((await res.json()).error ?? "Xatolik yuz berdi");
      return;
    }
    setTanlangan(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => setYangiOchiq(true)}
          className="bg-income text-white font-medium rounded-lg px-4 py-2 text-sm hover:brightness-110 transition"
        >
          + Yangi bitim
        </button>
        {xato && <p className="text-expense text-sm">{xato}</p>}
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
        {stages.map((s) => {
          const ustunBitimlar = deals.filter((d) => d.stageId === s.id);
          const jami = ustunBitimlar.reduce((a, d) => a + d.summa, 0);
          return (
            <div
              key={s.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId && kochirish(dragId, s)}
              className={`shrink-0 w-64 bg-surface-2/60 rounded-2xl border ${STAGE_RANG[s.turi] ?? "border-line"} p-2.5`}
            >
              <div className="flex items-center justify-between px-1.5 pb-2">
                <p className="text-sm font-semibold text-fg">{s.nomi}</p>
                <p className="text-2xs text-faint tnum">
                  {ustunBitimlar.length} ta{jami > 0 ? ` · ${formatMoney(jami)}` : ""}
                </p>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {ustunBitimlar.map((d) => (
                  <button
                    key={d.id}
                    draggable
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setTanlangan(d)}
                    className="w-full text-left bg-surface rounded-xl border border-line p-3 hover:border-brand/50 transition cursor-grab active:cursor-grabbing"
                  >
                    <p className="text-sm font-medium text-fg truncate">{d.nomi}</p>
                    {d.kontakt && <p className="text-xs text-muted truncate mt-0.5">{d.kontakt}</p>}
                    {d.summa > 0 && <p className="text-xs text-fg tnum mt-1">{formatMoney(d.summa)}</p>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {yangiOchiq && <YangiBitimModal onClose={() => setYangiOchiq(false)} />}
      {tanlangan && (
        <BitimSheet
          deal={tanlangan}
          stages={stages}
          onKochirish={(s) => kochirish(tanlangan.id, s)}
          onClose={() => setTanlangan(null)}
        />
      )}
    </div>
  );
}

/** Yangi bitim modali: nomi + summa + kontakt — 3 klik. */
function YangiBitimModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [nomi, setNomi] = useState("");
  const [summa, setSumma] = useState("");
  const [kontaktIsm, setKontaktIsm] = useState("");
  const [kontaktTel, setKontaktTel] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saqlash(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    const res = await fetch("/api/crm/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomi,
        summa: summa ? parseInt(summa.replace(/\D/g, ""), 10) : 0,
        kontaktIsm: kontaktIsm || null,
        kontaktTel: kontaktTel || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Xatolik yuz berdi");
      return;
    }
    onClose();
    router.refresh();
  }

  const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <form
        onSubmit={saqlash}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-line p-5 space-y-3"
      >
        <h2 className="font-semibold text-fg text-lg">Yangi bitim</h2>
        <input autoFocus value={nomi} onChange={(e) => setNomi(e.target.value)} placeholder="Bitim nomi (masalan: 50 ta stol buyurtmasi)" className={input} required />
        <input value={summa} onChange={(e) => setSumma(e.target.value)} placeholder="Summa (so'm, ixtiyoriy)" inputMode="numeric" className={input} />
        <div className="grid grid-cols-2 gap-2">
          <input value={kontaktIsm} onChange={(e) => setKontaktIsm(e.target.value)} placeholder="Mijoz ismi" className={input} />
          <input value={kontaktTel} onChange={(e) => setKontaktTel(e.target.value)} placeholder="Telefon" className={input} />
        </div>
        {xato && <p className="text-expense text-sm">{xato}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-line text-sm text-muted">
            Bekor
          </button>
          <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg bg-income text-white text-sm font-medium disabled:opacity-60">
            {loading ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Bitim tafsiloti: timeline + tez izoh + bosqich ko'chirish (mobil fallback). */
function BitimSheet({
  deal,
  stages,
  onKochirish,
  onClose,
}: {
  deal: DealDTO;
  stages: StageDTO[];
  onKochirish: (s: StageDTO) => void;
  onClose: () => void;
}) {
  const [activities, setActivities] = useState<ActivityDTO[] | null>(null);
  const [izoh, setIzoh] = useState("");

  const yuklash = useCallback(async () => {
    const res = await fetch(`/api/crm/deals/${deal.id}`);
    if (res.ok) {
      const d = await res.json();
      setActivities(d.activities ?? []);
    }
  }, [deal.id]);

  useEffect(() => {
    void yuklash();
  }, [yuklash]);

  async function vazifaYaratish() {
    const nomi = prompt("Vazifa nomi:", `${deal.nomi} — keyingi qadam`);
    if (!nomi?.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomi: nomi.trim(), dealId: deal.id }),
    });
    if (res.ok) {
      alert("Vazifa yaratildi — Vazifalar bo'limida ko'rasiz.");
    } else {
      alert((await res.json()).error ?? "Vazifa yaratilmadi (Vazifalar moduli yoqiqmi?)");
    }
  }

  async function izohYuborish(e: React.FormEvent) {
    e.preventDefault();
    if (!izoh.trim()) return;
    const res = await fetch(`/api/crm/deals/${deal.id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turi: "izoh", matn: izoh }),
    });
    if (res.ok) {
      setIzoh("");
      await yuklash();
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-line p-5 space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <div>
          <h2 className="font-semibold text-fg text-lg">{deal.nomi}</h2>
          <p className="text-sm text-muted">
            {deal.kontakt ?? "Kontaktsiz"}
            {deal.tel ? ` · ${deal.tel}` : ""}
            {deal.summa > 0 ? ` · ${formatMoney(deal.summa)}` : ""}
          </p>
        </div>

        {/* Bosqich ko'chirish (drag'ga mobil muqobil) */}
        <div className="flex gap-1.5 flex-wrap">
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => onKochirish(s)}
              disabled={s.id === deal.stageId}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                s.id === deal.stageId
                  ? "bg-brand text-white border-transparent"
                  : "border-line text-muted hover:border-brand/50"
              }`}
            >
              {s.nomi}
            </button>
          ))}
        </div>

        {/* Bitimga bog'liq vazifa (Vazifalar moduli bilan integratsiya) */}
        <button onClick={vazifaYaratish} className="text-brand text-sm font-medium">
          + Vazifa yaratish
        </button>

        {/* Tez izoh */}
        <form onSubmit={izohYuborish} className="flex gap-2">
          <input
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            placeholder="Izoh yozing va Enter bosing..."
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button type="submit" className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium">
            +
          </button>
        </form>

        {/* Timeline */}
        <div className="space-y-2">
          {activities === null ? (
            <p className="text-sm text-faint">Yuklanmoqda...</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-faint">Hali faoliyat yo'q.</p>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="text-sm border-l-2 border-line pl-3 py-0.5">
                <p className={a.turi === "tizim" ? "text-faint" : "text-fg"}>{a.matn}</p>
                <p className="text-2xs text-faint">{new Date(a.createdAt).toLocaleString("ru-RU")}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
