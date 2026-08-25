"use client";

import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { TransactionTable } from "./TransactionTable";
import { TransactionCards } from "./TransactionCards";
import type { TransactionDTO } from "@/lib/queries/transactions";
import type { YozuvAmallari } from "./YozuvOynalari";

interface Props {
  items: TransactionDTO[];
  total: number;
  page: number;
  pageSize: number;
  /** Yozuvni o'zgartirish huquqi (RBAC oynasi; server qaytadan tekshiradi). */
  ozgartirsaBoladi: (t: TransactionDTO) => boolean;
  filtrFaol: boolean;
  /** Tafsilot/tahrirlash/o'chirish oynalari sahifa darajasida (YozuvOynalari). */
  amallar: YozuvAmallari;
  onYangi: () => void;
  onFiltrTozalash: () => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
}

/**
 * RO'YXAT — desktopda jadval, telefonda kartalar (`TransactionCards`).
 * Ikkalasi bir xil ma'lumot ustida ishlaydi, ammo BOSHQA maketda: 375px da
 * jadvalni siljitib ko'rsatish ma'lumotni yashirish bilan teng.
 *
 * Sahifalash SERVERDA (`listTransactions`): brauzerga bir vaqtning o'zida
 * faqat bitta sahifa keladi. Filtr va qidiruv ham serverda — ular BUTUN
 * to'plam bo'yicha ishlaydi, yuklangan sahifa bo'yicha emas.
 */
export function TransactionList({
  items,
  total,
  page,
  pageSize,
  ozgartirsaBoladi,
  filtrFaol,
  amallar,
  onYangi,
  onFiltrTozalash,
  selected,
  onToggleSelect,
  onToggleAll,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (items.length === 0) {
    return (
      <div className="bg-surface rounded-2xl shadow-sm border border-line">
        {filtrFaol ? (
          <EmptyState
            title="Filtrga mos yozuv topilmadi"
            description="Sana oralig'ini kengaytiring yoki filtrlarni tozalab ko'ring."
            icon="🔍"
            action={
              <Button variant="secondary" onClick={onFiltrTozalash}>
                Filtrlarni tozalash
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Hozircha yozuv yo'q"
            description="Birinchi kirim yoki chiqimni qo'shing — jamilar shu zahoti hisoblanadi."
            icon="🧾"
            action={<Button onClick={onYangi}>+ Birinchi kirimni qo&apos;shish</Button>}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
      <TransactionTable
        items={items}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onToggleAll={onToggleAll}
        onBatafsil={amallar.onBatafsil}
        onTahrirlash={amallar.onTahrirlash}
        onOchirish={amallar.onOchirish}
        ozgartirsaBoladi={ozgartirsaBoladi}
      />

      {/* Telefonda jadval o'rniga kartalar (kenglik chegarasi shu yerda). */}
      <div className="lg:hidden">
        <TransactionCards
          items={items}
          onBatafsil={amallar.onBatafsil}
          onTahrirlash={amallar.onTahrirlash}
          onOchirish={amallar.onOchirish}
          ozgartirsaBoladi={ozgartirsaBoladi}
        />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-line text-sm text-muted">
          <span className="tnum">
            {page}-sahifa / {totalPages}
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
    return (
      <span className="px-3 py-2 min-h-[40px] inline-flex items-center rounded-lg bg-surface-2 text-faint">
        {children}
      </span>
    );
  }
  const params = new URLSearchParams(searchParams.toString());
  params.set("page", String(page));
  return (
    <a
      href={`?${params.toString()}`}
      className="px-3 py-2 min-h-[40px] inline-flex items-center rounded-lg bg-surface-2 hover:bg-line"
    >
      {children}
    </a>
  );
}
