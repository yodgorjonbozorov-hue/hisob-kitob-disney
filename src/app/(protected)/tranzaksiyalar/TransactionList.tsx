"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatSom, formatSomLabel, parseSomInput, formatDateUZ } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { TransactionDTO } from "@/lib/queries/transactions";

interface CategoryOption {
  id: string;
  nomi: string;
  turi: string;
}

interface Props {
  items: TransactionDTO[];
  total: number;
  page: number;
  pageSize: number;
  categories: CategoryOption[];
  currentUserId: string;
  currentUserRol: "admin" | "kassir";
  onUpdated: (t: TransactionDTO) => void;
  onDeleted: (id: string) => void;
}

export function TransactionList({
  items,
  total,
  page,
  pageSize,
  categories,
  currentUserId,
  currentUserRol,
  onUpdated,
  onDeleted,
}: Props) {
  const [editing, setEditing] = useState<TransactionDTO | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function canModify(t: TransactionDTO) {
    return currentUserRol === "admin" || t.userId === currentUserId;
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu tranzaksiyani o'chirmoqchimisiz?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) onDeleted(id);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Sana</th>
              <th className="text-left px-4 py-3">Turi</th>
              <th className="text-left px-4 py-3">Kategoriya</th>
              <th className="text-right px-4 py-3">Summa</th>
              <th className="text-left px-4 py-3">Izoh</th>
              <th className="text-left px-4 py-3">Kim kiritdi</th>
              <th className="text-right px-4 py-3">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 py-8">
                  Tranzaksiyalar topilmadi
                </td>
              </tr>
            )}
            {items.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap">{formatDateUZ(new Date(t.sana))}</td>
                <td className="px-4 py-3">
                  <Badge tone={t.turi === "kirim" ? "kirim" : "chiqim"}>
                    {t.turi === "kirim" ? "Kirim" : "Chiqim"}
                  </Badge>
                </td>
                <td className="px-4 py-3">{t.category.nomi}</td>
                <td
                  className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                    t.turi === "kirim" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatSomLabel(t.summa)}
                </td>
                <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{t.izoh ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{t.user.ism}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canModify(t) && (
                    <>
                      <button
                        onClick={() => setEditing(t)}
                        className="text-slate-500 hover:text-emerald-600 text-xs font-medium mr-3"
                      >
                        Tahrirlash
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-slate-500 hover:text-rose-600 text-xs font-medium"
                      >
                        O'chirish
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
          <span>
            {page}-sahifa / {totalPages} tadan
          </span>
          <div className="flex gap-2">
            <PageLink page={page - 1} disabled={page <= 1}>
              Oldingi
            </PageLink>
            <PageLink page={page + 1} disabled={page >= totalPages}>
              Keyingi
            </PageLink>
          </div>
        </div>
      )}

      {editing && (
        <EditModal
          transaction={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            onUpdated(t);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PageLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();

  if (disabled) {
    return <span className="px-3 py-1 rounded-lg bg-slate-50 text-slate-300">{children}</span>;
  }
  const params = new URLSearchParams(searchParams.toString());
  params.set("page", String(page));
  return (
    <a href={`?${params.toString()}`} className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200">
      {children}
    </a>
  );
}

function EditModal({
  transaction,
  categories,
  onClose,
  onSaved,
}: {
  transaction: TransactionDTO;
  categories: CategoryOption[];
  onClose: () => void;
  onSaved: (t: TransactionDTO) => void;
}) {
  const [turi, setTuri] = useState<"kirim" | "chiqim">(transaction.turi as "kirim" | "chiqim");
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [summaText, setSummaText] = useState(formatSom(transaction.summa));
  const [sana, setSana] = useState(new Date(transaction.sana).toISOString().slice(0, 10));
  const [izoh, setIzoh] = useState(transaction.izoh ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = categories.filter((c) => c.turi === turi);

  async function handleSave() {
    setError(null);
    const summa = parseSomInput(summaText);
    if (summa <= 0) {
      setError("Summani kiriting");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turi, categoryId, summa, sana, izoh: izoh || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        setLoading(false);
        return;
      }
      onSaved(data);
    } catch {
      setError("Serverga ulanib bo'lmadi");
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tranzaksiyani tahrirlash">
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setTuri("kirim");
              setCategoryId("");
            }}
            className={`flex-1 py-1.5 rounded-lg text-sm ${turi === "kirim" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"}`}
          >
            Kirim
          </button>
          <button
            onClick={() => {
              setTuri("chiqim");
              setCategoryId("");
            }}
            className={`flex-1 py-1.5 rounded-lg text-sm ${turi === "chiqim" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700"}`}
          >
            Chiqim
          </button>
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nomi}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          value={summaText}
          onChange={(e) => setSummaText(formatSom(parseSomInput(e.target.value)))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={sana}
          onChange={(e) => setSana(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          placeholder="Izoh"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {error && <p className="text-rose-600 text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onClose} type="button">
            Bekor qilish
          </Button>
          <Button onClick={handleSave} disabled={loading} type="button">
            {loading ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
