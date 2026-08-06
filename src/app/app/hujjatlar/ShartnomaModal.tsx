"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { todayDateOnlyString } from "@/lib/date";
import {
  SHARTNOMA_TURLARI,
  SHARTNOMA_TURI_NOMI,
  SHARTNOMA_HOLATLARI,
  SHARTNOMA_HOLAT_NOMI,
  type ShartnomaTuri,
  type ShartnomaHolat,
} from "@/lib/validation/hujjat";
import type { ShartnomaDTO } from "@/lib/queries/hujjat";

export function ShartnomaModal({
  shartnoma,
  mijozlar,
  taminotchilar,
  onClose,
  onDone,
}: {
  shartnoma: ShartnomaDTO | null;
  mijozlar: { id: string; ism: string }[];
  taminotchilar: { id: string; nomi: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const tahrir = shartnoma !== null;
  const [raqam, setRaqam] = useState(shartnoma?.raqam ?? "");
  const [nomi, setNomi] = useState(shartnoma?.nomi ?? "");
  const [turi, setTuri] = useState<ShartnomaTuri>((shartnoma?.turi as ShartnomaTuri) ?? "mijoz");
  const [kontragentId, setKontragentId] = useState("");
  const [kontragent, setKontragent] = useState(tahrir ? shartnoma!.kontragentNomi ?? "" : "");
  const [summa, setSumma] = useState(shartnoma ? String(shartnoma.summa) : "");
  const [boshlanish, setBoshlanish] = useState(
    shartnoma ? shartnoma.boshlanish.slice(0, 10) : todayDateOnlyString()
  );
  const [tugash, setTugash] = useState(shartnoma?.tugash ? shartnoma.tugash.slice(0, 10) : "");
  const [eslatmaKun, setEslatmaKun] = useState(String(shartnoma?.eslatmaKun ?? 30));
  const [holat, setHolat] = useState<ShartnomaHolat>((shartnoma?.holat as ShartnomaHolat) ?? "faol");
  const [izoh, setIzoh] = useState(shartnoma?.izoh ?? "");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const son = Number(summa || 0);
    const kun = Number(eslatmaKun || 0);
    if (!Number.isInteger(son) || son < 0) {
      setXato("Summa manfiy bo'lmagan butun son bo'lishi kerak");
      return;
    }
    if (!Number.isInteger(kun) || kun < 0 || kun > 365) {
      setXato("Eslatma kuni 0 dan 365 gacha bo'lishi kerak");
      return;
    }

    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(
        tahrir ? `/api/hujjatlar/shartnomalar/${shartnoma!.id}` : "/api/hujjatlar/shartnomalar",
        {
          method: tahrir ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            raqam,
            nomi,
            turi,
            contactId: turi === "mijoz" && kontragentId ? kontragentId : null,
            supplierId: turi === "taminotchi" && kontragentId ? kontragentId : null,
            kontragent: kontragentId ? null : kontragent || null,
            summa: son,
            boshlanish,
            tugash: tugash || null,
            eslatmaKun: kun,
            ...(tahrir ? { holat } : {}),
            izoh: izoh || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  async function ochirish() {
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/hujjatlar/shartnomalar/${shartnoma!.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "O'chirib bo'lmadi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";
  const royxat =
    turi === "mijoz"
      ? mijozlar.map((m) => ({ id: m.id, nomi: m.ism }))
      : turi === "taminotchi"
        ? taminotchilar.map((t) => ({ id: t.id, nomi: t.nomi }))
        : [];

  return (
    <Modal open onClose={onClose} title={tahrir ? "Shartnomani tahrirlash" : "Yangi shartnoma"}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="s-raqam">
              Raqami
            </label>
            <input id="s-raqam" value={raqam} onChange={(e) => setRaqam(e.target.value)} required maxLength={60} className={input} />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="s-turi">
              Turi
            </label>
            <select
              id="s-turi"
              value={turi}
              onChange={(e) => {
                setTuri(e.target.value as ShartnomaTuri);
                setKontragentId("");
              }}
              className={input}
            >
              {SHARTNOMA_TURLARI.map((t) => (
                <option key={t} value={t}>
                  {SHARTNOMA_TURI_NOMI[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="s-nomi">
            Nomi / mavzusi
          </label>
          <input id="s-nomi" value={nomi} onChange={(e) => setNomi(e.target.value)} required maxLength={200} className={input} />
        </div>

        {royxat.length > 0 && (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="s-kontragent">
              Kontragent kartochkasi
            </label>
            <select
              id="s-kontragent"
              value={kontragentId}
              onChange={(e) => setKontragentId(e.target.value)}
              className={input}
            >
              <option value="">Kartochkasiz (nomini qo&apos;lda yozish)</option>
              {royxat.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nomi}
                </option>
              ))}
            </select>
          </div>
        )}

        {!kontragentId && (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="s-kont-nom">
              Kontragent nomi
            </label>
            <input id="s-kont-nom" value={kontragent} onChange={(e) => setKontragent(e.target.value)} maxLength={150} className={input} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="s-summa">
              Summa (so&apos;m)
            </label>
            <input id="s-summa" type="number" min={0} step={1} inputMode="numeric" value={summa} onChange={(e) => setSumma(e.target.value)} className={input} />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="s-eslatma">
              Eslatma (kun oldin)
            </label>
            <input id="s-eslatma" type="number" min={0} max={365} step={1} inputMode="numeric" value={eslatmaKun} onChange={(e) => setEslatmaKun(e.target.value)} className={input} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="s-bosh">
              Boshlanish
            </label>
            <input id="s-bosh" type="date" value={boshlanish} onChange={(e) => setBoshlanish(e.target.value)} required className={input} />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="s-tug">
              Tugash
            </label>
            <input id="s-tug" type="date" value={tugash} onChange={(e) => setTugash(e.target.value)} className={input} />
          </div>
        </div>

        {tahrir && (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="s-holat">
              Holat
            </label>
            <select id="s-holat" value={holat} onChange={(e) => setHolat(e.target.value as ShartnomaHolat)} className={input}>
              {SHARTNOMA_HOLATLARI.map((h) => (
                <option key={h} value={h}>
                  {SHARTNOMA_HOLAT_NOMI[h]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="s-izoh">
            Izoh
          </label>
          <input id="s-izoh" value={izoh} onChange={(e) => setIzoh(e.target.value)} maxLength={1000} className={input} />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            {tahrir ? "Saqlash" : "Qo'shish"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          {tahrir && (
            <Button variant="ghost" onClick={ochirish} disabled={loading}>
              O&apos;chirish
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
