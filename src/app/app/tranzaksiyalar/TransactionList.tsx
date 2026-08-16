"use client";

import { isManager } from "@/lib/auth/roles";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatSom, formatSomLabel, parseSomInput, formatDateUZ } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TOLOV_TURLARI, TOLOV_NOMI, TOLOV_BELGI, type TolovTuri } from "@/lib/validation/transaction";
import type { TransactionDTO } from "@/lib/queries/transactions";
import type { Rol } from "@/lib/auth/session";
import { ReceiptList } from "@/components/ui/ReceiptList";

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
  currentUserRol: Rol;
  onUpdated: (t: TransactionDTO) => void;
  onDelete: (t: TransactionDTO) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
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
  onDelete,
  selected,
  onToggleSelect,
  onToggleAll,
}: Props) {
  const [editing, setEditing] = useState<TransactionDTO | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = items.length > 0 && selected.size === items.length;

  function canModify(t: TransactionDTO) {
    return isManager(currentUserRol) || t.userId === currentUserId;
  }

  // Yozuvdagi ANIQ to'lov turi ustun; null (eski yozuvlar) — kassa turidan
  // (kassasiz eski yozuv — naqd).
  function tolovBelgi(t: TransactionDTO): string {
    if (t.tolovTuri === "naqd") return "💵 Naqd";
    if (t.tolovTuri === "click") return "💳 Click";
    if (t.tolovTuri === "qarz") return "📋 Qarz";
    const turi = t.account?.turi ?? "naqd";
    return turi === "naqd" ? "💵 Naqd" : turi === "plastik" ? "💳 Click" : "🏦 Bank";
  }

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
      {/* Desktop: jadval */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-xs uppercase">
            <tr>
              <th className="px-4 py-3 w-8">
                <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Hammasini tanlash" />
              </th>
              <th className="text-left px-4 py-3">Sana</th>
              <th className="text-left px-4 py-3">Turi</th>
              <th className="text-left px-4 py-3">To&apos;lov</th>
              <th className="text-left px-4 py-3">Kategoriya</th>
              <th className="text-right px-4 py-3">Summa</th>
              <th className="text-left px-4 py-3">Izoh</th>
              <th className="text-left px-4 py-3">Kim kiritdi</th>
              <th className="text-right px-4 py-3">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-faint py-8">
                  Tranzaksiyalar topilmadi
                </td>
              </tr>
            )}
            {items.map((t) => (
              <tr key={t.id} className={`hover:bg-surface-2 ${selected.has(t.id) ? "bg-brand/5" : ""}`}>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(t.id)} onChange={() => onToggleSelect(t.id)} aria-label="Tanlash" />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDateUZ(new Date(t.sana))}</td>
                <td className="px-4 py-3">
                  <Badge tone={t.turi === "kirim" ? "kirim" : "chiqim"}>
                    {t.turi === "kirim" ? "Kirim" : "Chiqim"}
                  </Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{tolovBelgi(t)}</td>
                <td className="px-4 py-3">{t.category.nomi}</td>
                <td
                  className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                    t.turi === "kirim" ? "text-income" : "text-expense"
                  }`}
                >
                  {formatSomLabel(t.summa)}
                </td>
                <td className="px-4 py-3 text-muted max-w-[200px] truncate">{t.izoh ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{t.user.ism}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canModify(t) && (
                    <>
                      <button
                        onClick={() => setEditing(t)}
                        className="text-muted hover:text-income text-xs font-medium mr-3"
                      >
                        Tahrirlash
                      </button>
                      <button
                        onClick={() => onDelete(t)}
                        className="text-muted hover:text-expense text-xs font-medium"
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

      {/* Mobil: kassa lentasi (signature) — qatorga bosilganda tahrirlash */}
      <div className="lg:hidden">
        {items.length === 0 ? (
          <p className="text-center text-faint py-8 text-sm">Yozuvlar topilmadi</p>
        ) : (
          <ReceiptList
            items={items.map((t) => ({
              id: t.id,
              sana: typeof t.sana === "string" ? t.sana : new Date(t.sana).toISOString(),
              turi: t.turi,
              summa: t.summa,
              // Mobil lentada to'lov bo'limi kategoriya yonida ko'rinadi.
              categoryNomi: `${tolovBelgi(t)} · ${t.category.nomi}`,
              izoh: t.izoh,
              userIsm: t.user.ism,
            }))}
            onRowClick={(id) => {
              const t = items.find((x) => x.id === id);
              if (t && canModify(t)) setEditing(t);
            }}
          />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-line text-sm text-muted">
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
          canDelete={canModify(editing)}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            onUpdated(t);
            setEditing(null);
          }}
          onDelete={() => {
            const t = editing;
            setEditing(null);
            onDelete(t);
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
    return <span className="px-3 py-1 rounded-lg bg-surface-2 text-faint">{children}</span>;
  }
  const params = new URLSearchParams(searchParams.toString());
  params.set("page", String(page));
  return (
    <a href={`?${params.toString()}`} className="px-3 py-1 rounded-lg bg-surface-2 hover:bg-line">
      {children}
    </a>
  );
}

function EditModal({
  transaction,
  categories,
  canDelete,
  onClose,
  onSaved,
  onDelete,
}: {
  transaction: TransactionDTO;
  categories: CategoryOption[];
  canDelete: boolean;
  onClose: () => void;
  onSaved: (t: TransactionDTO) => void;
  onDelete: () => void;
}) {
  const [turi, setTuri] = useState<"kirim" | "chiqim">(transaction.turi as "kirim" | "chiqim");
  // Eski yozuvda tolovTuri null — kassa turidan boshlang'ich qiymat chiqariladi.
  const [tolovTuri, setTolovTuri] = useState<TolovTuri>(
    (transaction.tolovTuri as TolovTuri | null) ??
      (transaction.account?.turi === "plastik" || transaction.account?.turi === "bank"
        ? "click"
        : "naqd")
  );
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
        body: JSON.stringify({ turi, tolovTuri, categoryId, summa, sana, izoh: izoh || undefined }),
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
            className={`flex-1 py-1.5 rounded-lg text-sm ${turi === "kirim" ? "bg-income text-white" : "bg-income-soft text-income-fg"}`}
          >
            Kirim
          </button>
          <button
            onClick={() => {
              setTuri("chiqim");
              setCategoryId("");
              // Qarz faqat kirim uchun — chiqimga o'tilganda naqdga qaytariladi.
              if (tolovTuri === "qarz") setTolovTuri("naqd");
            }}
            className={`flex-1 py-1.5 rounded-lg text-sm ${turi === "chiqim" ? "bg-expense text-white" : "bg-expense-soft text-expense-fg"}`}
          >
            Chiqim
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TOLOV_TURLARI.filter((t) => t !== "qarz" || turi === "kirim").map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTolovTuri(t)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                tolovTuri === t
                  ? "border-brand bg-brand-wash text-brand font-medium"
                  : "border-line bg-surface-2 text-fg hover:border-brand"
              }`}
            >
              {TOLOV_BELGI[t]} {TOLOV_NOMI[t]}
            </button>
          ))}
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
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
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={sana}
          onChange={(e) => setSana(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          placeholder="Izoh"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 items-center pt-2">
          {canDelete && (
            <Button variant="danger" onClick={onDelete} type="button">
              O'chirish
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" onClick={onClose} type="button">
              Bekor qilish
            </Button>
            <Button onClick={handleSave} loading={loading} type="button">
              Saqlash
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
