"use client";

import { useState, FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import type { Tur } from "./turlar";

/**
 * YANGI KATEGORIYA — ixcham forma: nom + tur.
 *
 * Boshlang'ich tur joriy tabdan olinadi (Kirim tabida turib "+ Yangi
 * kategoriya" bosilsa — Kirim), lekin maydon KO'RINIB turadi: taxmin
 * qilingan qiymat yashirin bo'lsa, foydalanuvchi kategoriyani noto'g'ri
 * yo'nalishga yaratib qo'yardi va uni keyin tuzatib ham bo'lmasdi
 * (yozuv paydo bo'lgach tur qotib qoladi).
 */
export function YangiKategoriya({
  boshlangichTur,
  onYaratildi,
  onClose,
}: {
  boshlangichTur: Tur;
  /** Serverdan kelgan xom `Category` — sahifa satriga chaqiruvchi aylantiradi. */
  onYaratildi: (xom: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [nomi, setNomi] = useState("");
  const [turi, setTuri] = useState<Tur>(boshlangichTur);
  const [xato, setXato] = useState<string | null>(null);
  const [band, setBand] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    // IKKI MARTA YUBORISHDAN HIMOYA: `band` bo'lsa so'rov umuman ketmaydi.
    // Tugmani `disabled` qilishning o'zi yetarli emas — Enter bilan forma
    // javob kelguncha bir necha marta yuborilishi mumkin edi.
    if (band) return;
    setBand(true);
    setXato(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomi, turi }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onYaratildi(data);
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBand(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Yangi kategoriya">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="yangi-kat-nomi" className="block text-2xs text-muted mb-1">
            Kategoriya nomi
          </label>
          <input
            id="yangi-kat-nomi"
            type="text"
            value={nomi}
            maxLength={60}
            onChange={(e) => setNomi(e.target.value)}
            placeholder="Masalan: Hovli bezaklari"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm min-h-[44px]"
            autoFocus
            required
          />
        </div>
        <div>
          <p className="text-2xs text-muted mb-1">Turi</p>
          <Segmented
            options={[
              { value: "kirim" as Tur, label: "Kirim" },
              { value: "chiqim" as Tur, label: "Chiqim" },
            ]}
            value={turi}
            onChange={setTuri}
          />
        </div>
        {xato && <p className="text-sm text-expense">{xato}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={band}>
            {band ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
