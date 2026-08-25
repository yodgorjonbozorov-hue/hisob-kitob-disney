"use client";

import { isManager } from "@/lib/auth/roles";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatSom, formatSomLabel, formatDateUZ } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import type { TransactionDTO } from "@/lib/queries/transactions";
import type { Rol } from "@/lib/auth/session";
import { ReceiptList } from "@/components/ui/ReceiptList";
import { formatKgLabel } from "@/lib/kg";
import { EditModal } from "./EditModal";
import type { CategoryOption } from "./turlar";

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
      <div className="hidden lg:block jadval-siljish">
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
                <td className="px-4 py-3">
                  {t.category.nomi}
                  {/* Kg savdosi: miqdor × 1 kg narxi — o'sha savdodagi REAL narx. */}
                  {t.miqdorGr != null && t.kgNarxi != null && (
                    <span className="block text-2xs text-muted tnum">
                      {formatKgLabel(t.miqdorGr)} × {formatSom(t.kgNarxi)} soʻm
                    </span>
                  )}
                </td>
                <td
                  className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                    t.turi === "kirim" ? "text-income" : "text-expense"
                  }`}
                >
                  {formatSomLabel(t.summa)}
                </td>
                <td className="px-4 py-3 text-muted max-w-[200px] truncate">
                  {t.izoh ?? "—"}
                  {/* MANBA: CRM — yozuv CRM buyurtmasidan ko'chirilgan. */}
                  {t.crmBuyurtma && (
                    <span className="ml-1.5 align-middle">
                      <Badge tone="info">CRM</Badge>
                    </span>
                  )}
                </td>
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
              // Mobil lentada "CRM" manbasi izoh boshida ko'rinadi.
              izoh: t.crmBuyurtma ? `CRM · ${t.izoh ?? t.crmBuyurtma.nomi}` : t.izoh,
              userIsm: t.user.ism,
              miqdorGr: t.miqdorGr,
              kgNarxi: t.kgNarxi,
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

