"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UserDTO {
  id: string;
  ism: string;
}
interface TaskDTO {
  id: string;
  nomi: string;
  izoh: string | null;
  holat: string;
  masulId: string;
  masulIsm: string;
  muddat: string | null;
  deal: { id: string; nomi: string } | null;
}

const USTUNLAR: { holat: string; nomi: string; rang: string }[] = [
  { holat: "OCHIQ", nomi: "Ochiq", rang: "border-line" },
  { holat: "JARAYONDA", nomi: "Jarayonda", rang: "border-brand/40" },
  { holat: "BAJARILDI", nomi: "Bajarildi", rang: "border-income/50" },
];

function muddatKorinishi(iso: string | null, holat: string): { matn: string; otgan: boolean } | null {
  if (!iso) return null;
  const sana = new Date(iso);
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  return {
    matn: sana.toLocaleDateString("ru-RU"),
    otgan: holat !== "BAJARILDI" && sana.getTime() < bugun.getTime(),
  };
}

/** Vazifalar kanbani: 3 sobit ustun, drag&drop, "Menikilar" filtri. */
export function VazifalarClient({ meId, users, tasks }: { meId: string; users: UserDTO[]; tasks: TaskDTO[] }) {
  const router = useRouter();
  const [faqatMeniki, setFaqatMeniki] = useState(false);
  const [yangiOchiq, setYangiOchiq] = useState(false);
  const [tanlangan, setTanlangan] = useState<TaskDTO | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  const korinadigan = faqatMeniki ? tasks.filter((t) => t.masulId === meId) : tasks;

  async function kochirish(taskId: string, holat: string) {
    setXato(null);
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holat }),
    });
    if (!res.ok) {
      setXato((await res.json()).error ?? "Xatolik yuz berdi");
      return;
    }
    setTanlangan(null);
    router.refresh();
  }

  async function ochirish(taskId: string) {
    if (!confirm("Vazifa o'chirilsinmi?")) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      setTanlangan(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setYangiOchiq(true)}
          className="bg-income text-white font-medium rounded-lg px-4 py-2 text-sm hover:brightness-110 transition"
        >
          + Vazifa
        </button>
        <button
          onClick={() => setFaqatMeniki(!faqatMeniki)}
          className={`px-3 py-2 rounded-lg text-sm border transition ${
            faqatMeniki ? "bg-brand text-white border-transparent" : "border-line text-muted hover:text-fg"
          }`}
        >
          Menikilar
        </button>
        {xato && <p className="text-expense text-sm">{xato}</p>}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
        {USTUNLAR.map((u) => {
          const ustun = korinadigan.filter((t) => t.holat === u.holat);
          return (
            <div
              key={u.holat}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId && kochirish(dragId, u.holat)}
              className={`shrink-0 w-72 sm:w-80 bg-surface-2/60 rounded-2xl border ${u.rang} p-2.5`}
            >
              <div className="flex items-center justify-between px-1.5 pb-2">
                <p className="text-sm font-semibold text-fg">{u.nomi}</p>
                <p className="text-2xs text-faint tnum">{ustun.length} ta</p>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {ustun.map((t) => {
                  const m = muddatKorinishi(t.muddat, t.holat);
                  return (
                    <button
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setTanlangan(t)}
                      className="w-full text-left bg-surface rounded-xl border border-line p-3 hover:border-brand/50 transition cursor-grab active:cursor-grabbing"
                    >
                      <p className={`text-sm font-medium truncate ${t.holat === "BAJARILDI" ? "text-muted line-through" : "text-fg"}`}>
                        {t.nomi}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-2xs flex-wrap">
                        <span className="text-muted">{t.masulIsm}</span>
                        {m && (
                          <span className={m.otgan ? "text-expense-fg font-medium" : "text-faint"}>
                            {m.otgan ? "⚠ " : ""}{m.matn}
                          </span>
                        )}
                        {t.deal && <span className="text-brand truncate">🤝 {t.deal.nomi}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {yangiOchiq && <YangiVazifaModal users={users} meId={meId} onClose={() => setYangiOchiq(false)} />}
      {tanlangan && (
        <VazifaSheet
          task={tanlangan}
          onKochirish={(h) => kochirish(tanlangan.id, h)}
          onOchirish={() => ochirish(tanlangan.id)}
          onClose={() => setTanlangan(null)}
        />
      )}
    </div>
  );
}

/** Yangi vazifa: nomi + mas'ul + muddat — 3 klik. */
function YangiVazifaModal({ users, meId, onClose }: { users: UserDTO[]; meId: string; onClose: () => void }) {
  const router = useRouter();
  const [nomi, setNomi] = useState("");
  const [masulId, setMasulId] = useState(meId);
  const [muddat, setMuddat] = useState("");
  const [izoh, setIzoh] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saqlash(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomi, masulId, muddat: muddat || null, izoh: izoh || null }),
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
        <h2 className="font-semibold text-fg text-lg">Yangi vazifa</h2>
        <input autoFocus value={nomi} onChange={(e) => setNomi(e.target.value)} placeholder="Nima qilish kerak?" className={input} required />
        <div className="grid grid-cols-2 gap-2">
          <select value={masulId} onChange={(e) => setMasulId(e.target.value)} className={input}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === meId ? `${u.ism} (men)` : u.ism}
              </option>
            ))}
          </select>
          <input type="date" value={muddat} onChange={(e) => setMuddat(e.target.value)} className={input} />
        </div>
        <input value={izoh} onChange={(e) => setIzoh(e.target.value)} placeholder="Izoh (ixtiyoriy)" className={input} />
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

/** Vazifa tafsiloti: holat tugmalari + o'chirish (mobil drag muqobili). */
function VazifaSheet({
  task,
  onKochirish,
  onOchirish,
  onClose,
}: {
  task: TaskDTO;
  onKochirish: (holat: string) => void;
  onOchirish: () => void;
  onClose: () => void;
}) {
  const m = muddatKorinishi(task.muddat, task.holat);
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-line p-5 space-y-4"
      >
        <div>
          <h2 className="font-semibold text-fg text-lg">{task.nomi}</h2>
          <p className="text-sm text-muted mt-0.5">
            {task.masulIsm}
            {m ? ` · ${m.otgan ? "⚠ " : ""}${m.matn}` : ""}
            {task.deal ? ` · 🤝 ${task.deal.nomi}` : ""}
          </p>
          {task.izoh && <p className="text-sm text-fg mt-2">{task.izoh}</p>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {USTUNLAR.map((u) => (
            <button
              key={u.holat}
              onClick={() => onKochirish(u.holat)}
              disabled={u.holat === task.holat}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                u.holat === task.holat ? "bg-brand text-white border-transparent" : "border-line text-muted hover:border-brand/50"
              }`}
            >
              {u.nomi}
            </button>
          ))}
        </div>
        <button onClick={onOchirish} className="text-expense text-sm font-medium">
          O'chirish
        </button>
      </div>
    </div>
  );
}
