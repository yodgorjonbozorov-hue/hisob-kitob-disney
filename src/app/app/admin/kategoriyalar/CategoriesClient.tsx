"use client";

import { useState, useMemo, FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Jadval, type Ustun } from "@/components/ui/Jadval";

interface CategoryDTO {
  id: string;
  nomi: string;
  turi: string;
  tartib: number;
  isActive: boolean;
  /** KG SAVDOSI kategoriyasi (mijozga xos — Fortex Selos). */
  kgAsosli: boolean;
}

export function CategoriesClient({
  initialCategories,
  kgSavdo = false,
}: {
  initialCategories: CategoryDTO[];
  /** Kg savdosi shu mijozga ochiqmi (lib/mijozXos.ts) — ustun shunda ko'rinadi. */
  kgSavdo?: boolean;
}) {
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

  /**
   * KG SAVDOSI bayrog'i. Yoqilgan kategoriya bosilganda "Pul kirdi" ekranida
   * summa emas, miqdor (kg) va 1 kg narxi so'raladi. Bayroq faqat kirim
   * kategoriyasida ma'noga ega, shuning uchun tugma faqat kirim tabida.
   */
  async function toggleKg(cat: CategoryDTO) {
    const res = await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kgAsosli: !cat.kgAsosli }),
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

  // Ustun ta'rifi BITTA — desktop jadval ham, mobil kartochka ham shundan.
  const ustunlar: Ustun<CategoryDTO>[] = [
    { kalit: "nomi", sarlavha: "Nomi", katak: (c) => c.nomi },
    {
      kalit: "holati",
      sarlavha: "Holati",
      katak: (c) => <Badge tone={c.isActive ? "kirim" : "neutral"}>{c.isActive ? "Faol" : "Nofaol"}</Badge>,
    },
    ...(kgSavdo && tab === "kirim"
      ? [
          {
            kalit: "kg",
            sarlavha: "Kg savdosi",
            katak: (c: CategoryDTO) => (
              <Badge tone={c.kgAsosli ? "kirim" : "neutral"}>
                {c.kgAsosli ? "Kg bo'yicha" : "Summa bo'yicha"}
              </Badge>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("kirim")}
            className={`px-4 min-h-[44px] rounded-lg text-sm font-medium ${tab === "kirim" ? "bg-income text-white" : "bg-income-soft text-income-fg"}`}
          >
            Kirim
          </button>
          <button
            onClick={() => setTab("chiqim")}
            className={`px-4 min-h-[44px] rounded-lg text-sm font-medium ${tab === "chiqim" ? "bg-expense text-white" : "bg-expense-soft text-expense-fg"}`}
          >
            Chiqim
          </button>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Yangi kategoriya</Button>
      </div>

      <Card>
        <Jadval
          ustunlar={ustunlar}
          qatorlar={visible}
          kalit={(c) => c.id}
          amallar={(cat) => [
            {
              label: cat.isActive ? "Nofaollashtirish" : "Faollashtirish",
              onClick: () => void toggleActive(cat),
              tur: "ijobiy",
            },
            ...(kgSavdo && tab === "kirim"
              ? [
                  {
                    label: cat.kgAsosli ? "Summa bo'yicha qilish" : "Kg bo'yicha qilish",
                    onClick: () => void toggleKg(cat),
                    tur: "asosiy" as const,
                  },
                ]
              : []),
          ]}
          bosh={<p className="text-sm text-faint py-6 text-center">Bu turda kategoriya yo&apos;q</p>}
        />
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
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          autoFocus
          required
        />
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
