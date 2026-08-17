"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { BIZNES_TURLARI } from "@/lib/biznesTuri";
import type { YangiBiznes } from "./turlar";

export function YangiBiznesModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (b: YangiBiznes) => void;
}) {
  const [nomi, setNomi] = useState("");
  const [turi, setTuri] = useState<"umumiy" | "avto">("umumiy");
  const [omborli, setOmborli] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Avto rejimi ombor tizimisiz ishlamaydi — tanlov ko'rsatilmaydi.
  const avtoTanlangan = turi === "avto";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomi, turi, omborli: avtoTanlangan ? true : omborli }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Xatolik yuz berdi");
      setLoading(false);
      return;
    }
    onCreated(data);
  }

  return (
    <Modal open onClose={onClose} title="Yangi biznes">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={nomi}
          onChange={(e) => setNomi(e.target.value)}
          placeholder="Biznes nomi (masalan: Salyut)"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          autoFocus
          required
        />
        <div>
          <label className="block text-xs text-muted mb-1">Rejim</label>
          <select
            value={turi}
            onChange={(e) => setTuri(e.target.value as "umumiy" | "avto")}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
          >
            {BIZNES_TURLARI.map((t) => (
              <option key={t.code} value={t.code}>
                {t.nomi}
              </option>
            ))}
          </select>
          <p className="text-xs text-faint mt-1">
            {BIZNES_TURLARI.find((t) => t.code === turi)?.tavsif}
          </p>
        </div>
        {!avtoTanlangan && (
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={omborli}
              onChange={(e) => setOmborli(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Ombor va sotuv yuritiladi
              <span className="block text-xs text-faint">
                Mahsulot qoldig&apos;i (kg/dona), sotuv va ombor kirimi bo&apos;limlari ochiladi.
              </span>
            </span>
          </label>
        )}
        <p className="text-xs text-faint">
          Yangi biznes bo&apos;sh boshlanadi — kategoriyalarni &quot;Kategoriyalar&quot; bo&apos;limida qo&apos;shasiz.
        </p>
        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saqlanmoqda..." : "Qo'shish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
