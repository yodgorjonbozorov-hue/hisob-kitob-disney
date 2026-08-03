"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { BIZNES_TURLARI, isAvto } from "@/lib/biznesTuri";

interface BusinessDTO {
  id: string;
  nomi: string;
  isActive: boolean;
  turi: string;
  kategoriyalar: number;
  tranzaksiyalar: number;
}

export function BusinessesClient({ initialBusinesses }: { initialBusinesses: BusinessDTO[] }) {
  const router = useRouter();
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [modalOpen, setModalOpen] = useState(false);

  async function toggleActive(b: BusinessDTO) {
    const res = await fetch(`/api/businesses/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !b.isActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBusinesses((prev) => prev.map((x) => (x.id === updated.id ? { ...x, isActive: updated.isActive } : x)));
      router.refresh();
    }
  }

  /** Biznes rejimi: umumiy ombor ↔ avto (olib-sotar). */
  async function toggleTuri(b: BusinessDTO) {
    const turi = isAvto(b.turi) ? "umumiy" : "avto";
    const res = await fetch(`/api/businesses/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turi }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBusinesses((prev) => prev.map((x) => (x.id === updated.id ? { ...x, turi: updated.turi } : x)));
      router.refresh();
    }
  }

  async function deleteBusiness(b: BusinessDTO) {
    if (!confirm(`"${b.nomi}" biznesini butunlay o'chirasizmi?\n\nFaqat BO'SH biznes o'chiriladi (yozuv/mahsulot/foydalanuvchi yo'q). Ma'lumot bor bo'lsa — o'chmaydi.`)) return;
    const res = await fetch(`/api/businesses/${b.id}`, { method: "DELETE" });
    if (res.ok) {
      setBusinesses((prev) => prev.filter((x) => x.id !== b.id));
      router.refresh();
    } else {
      alert((await res.json()).error ?? "O'chirib bo'lmadi");
    }
  }

  function handleCreated(b: { id: string; nomi: string; isActive: boolean; turi: string }) {
    setBusinesses((prev) => [
      ...prev,
      { ...b, kategoriyalar: 0, tranzaksiyalar: 0 },
    ]);
    setModalOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModalOpen(true)}>+ Yangi biznes</Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-xs uppercase">
              <th className="pb-2">Nomi</th>
              <th className="pb-2">Rejim</th>
              <th className="pb-2 text-right">Kategoriyalar</th>
              <th className="pb-2 text-right">Tranzaksiyalar</th>
              <th className="pb-2">Holati</th>
              <th className="pb-2 text-right">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {businesses.map((b) => (
              <tr key={b.id}>
                <td className="py-2.5 font-medium">{b.nomi}</td>
                <td className="py-2.5">
                  <Badge tone={isAvto(b.turi) ? "kirim" : "neutral"}>
                    {isAvto(b.turi) ? "Avto" : "Umumiy"}
                  </Badge>
                </td>
                <td className="py-2.5 text-right text-muted">{b.kategoriyalar}</td>
                <td className="py-2.5 text-right text-muted">{b.tranzaksiyalar}</td>
                <td className="py-2.5">
                  <Badge tone={b.isActive ? "kirim" : "neutral"}>{b.isActive ? "Faol" : "Nofaol"}</Badge>
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => toggleTuri(b)}
                    className="text-xs font-medium text-muted hover:text-brand mr-3"
                  >
                    {isAvto(b.turi) ? "Umumiy rejim" : "Avto rejim"}
                  </button>
                  <button
                    onClick={() => toggleActive(b)}
                    className="text-xs font-medium text-muted hover:text-income mr-3"
                  >
                    {b.isActive ? "Nofaollashtirish" : "Faollashtirish"}
                  </button>
                  <button
                    onClick={() => deleteBusiness(b)}
                    className="text-xs font-medium text-muted hover:text-expense"
                  >
                    O'chirish
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {modalOpen && <NewBusinessModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </div>
  );
}

function NewBusinessModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (b: { id: string; nomi: string; isActive: boolean; turi: string }) => void;
}) {
  const [nomi, setNomi] = useState("");
  const [turi, setTuri] = useState<"umumiy" | "avto">("umumiy");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomi, turi }),
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
        <p className="text-xs text-faint">
          Yangi biznes bo'sh boshlanadi — kategoriyalarni "Kategoriyalar" bo'limida qo'shasiz.
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
