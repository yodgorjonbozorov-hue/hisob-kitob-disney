"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface BusinessDTO {
  id: string;
  nomi: string;
  isActive: boolean;
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

  function handleCreated(b: { id: string; nomi: string; isActive: boolean }) {
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
                <td className="py-2.5 text-right text-muted">{b.kategoriyalar}</td>
                <td className="py-2.5 text-right text-muted">{b.tranzaksiyalar}</td>
                <td className="py-2.5">
                  <Badge tone={b.isActive ? "kirim" : "neutral"}>{b.isActive ? "Faol" : "Nofaol"}</Badge>
                </td>
                <td className="py-2.5 text-right">
                  <button
                    onClick={() => toggleActive(b)}
                    className="text-xs font-medium text-muted hover:text-income"
                  >
                    {b.isActive ? "Nofaollashtirish" : "Faollashtirish"}
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
  onCreated: (b: { id: string; nomi: string; isActive: boolean }) => void;
}) {
  const [nomi, setNomi] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomi }),
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
