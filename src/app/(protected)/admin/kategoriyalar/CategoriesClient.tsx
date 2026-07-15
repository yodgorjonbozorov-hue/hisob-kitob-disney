"use client";

import { useState, useMemo, FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface CategoryDTO {
  id: string;
  nomi: string;
  turi: string;
  tartib: number;
  isActive: boolean;
}

export function CategoriesClient({ initialCategories }: { initialCategories: CategoryDTO[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [tab, setTab] = useState<"kirim" | "chiqim">("kirim");
  const [modalOpen, setModalOpen] = useState(false);

  const visible = useMemo(() => categories.filter((c) => c.turi === tab), [categories, tab]);

  async function toggleActive(cat: CategoryDTO) {
    const res = await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    }
  }

  function handleCreated(cat: CategoryDTO) {
    setCategories((prev) => [...prev, cat]);
    setModalOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("kirim")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "kirim" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"}`}
          >
            Kirim
          </button>
          <button
            onClick={() => setTab("chiqim")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "chiqim" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700"}`}
          >
            Chiqim
          </button>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Yangi kategoriya</Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 text-xs uppercase">
              <th className="pb-2">Nomi</th>
              <th className="pb-2">Holati</th>
              <th className="pb-2 text-right">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((cat) => (
              <tr key={cat.id}>
                <td className="py-2.5">{cat.nomi}</td>
                <td className="py-2.5">
                  <Badge tone={cat.isActive ? "kirim" : "neutral"}>{cat.isActive ? "Faol" : "Nofaol"}</Badge>
                </td>
                <td className="py-2.5 text-right">
                  <button
                    onClick={() => toggleActive(cat)}
                    className="text-xs font-medium text-slate-500 hover:text-emerald-600"
                  >
                    {cat.isActive ? "Nofaollashtirish" : "Faollashtirish"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {modalOpen && (
        <NewCategoryModal turi={tab} onClose={() => setModalOpen(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}

function NewCategoryModal({
  turi,
  onClose,
  onCreated,
}: {
  turi: "kirim" | "chiqim";
  onClose: () => void;
  onCreated: (c: CategoryDTO) => void;
}) {
  const [nomi, setNomi] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/categories", {
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
    <Modal open onClose={onClose} title={`Yangi ${turi === "kirim" ? "kirim" : "chiqim"} kategoriyasi`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={nomi}
          onChange={(e) => setNomi(e.target.value)}
          placeholder="Kategoriya nomi"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          autoFocus
          required
        />
        {error && <p className="text-rose-600 text-sm">{error}</p>}
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
