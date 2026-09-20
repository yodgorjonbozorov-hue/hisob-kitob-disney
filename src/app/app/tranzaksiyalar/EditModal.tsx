"use client";

import { useState } from "react";
import { formatSom, parseSomInput } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { KASSA_TANLANMADI, kassaKerakmi } from "@/lib/kassaQoida";
import { type TolovTuri } from "@/lib/validation/transaction";
import { formatKg, kgSumma, kgToGram, parseKgInput } from "@/lib/kg";
import type { TransactionDTO } from "@/lib/queries/transactions";
import type { AccountOption, CategoryOption, XodimOption } from "./turlar";
import { EditKgMaydonlari } from "./EditKgMaydonlari";
import { EditMaydonlar, type EditQiymat } from "./EditMaydonlar";

/**
 * Yozuvni tahrirlash oynasi. Maydonlar `EditMaydonlar.tsx` da (250 satr
 * chegarasi — CLAUDE.md), bu yerda holat, tekshiruv va saqlash.
 *
 * KASSA VA SOTUVCHI (audit K-2): endi tahrirda ham bor. Xato kassaga
 * tushgan yozuvni o'chirib qayta yaratish SHART EMAS — audit izi saqlanadi.
 * Kassa qoldig'i ledgerdan hisoblanadi (lib/queries/accounts.ts), shuning
 * uchun `accountId` almashganda eski kassadan avtomatik chiqadi va yangisiga
 * qo'shiladi: qo'shimcha tuzatish yozuvi YARATILMAYDI (dublikat pul yo'q).
 *
 * KG SAVDOSI yozuvida (mijozga xos — Fortex Selos) summa maydoni YO'Q:
 * miqdor va 1 kg narxi tuzatiladi, jami ikkalasidan qayta hisoblanadi.
 */
export function EditModal({
  transaction,
  categories,
  accounts = [],
  sotuvchilar = [],
  sotuvchiTanlash = false,
  canDelete,
  onClose,
  onSaved,
  onDelete,
}: {
  transaction: TransactionDTO;
  categories: CategoryOption[];
  /** Faol kassalar. Bo'sh ro'yxat — kassa maydoni ko'rsatilmaydi. */
  accounts?: AccountOption[];
  /** "Sotuvchi / Xodim" tanlovi uchun biznes xodimlari. */
  sotuvchilar?: XodimOption[];
  /** Boshqa xodim nomiga yozish — faqat boshqaruvchiga (server ham tekshiradi). */
  sotuvchiTanlash?: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (t: TransactionDTO) => void;
  onDelete: () => void;
}) {
  // KG SAVDOSI yozuvi (mijozga xos): summa QO'LDA tahrirlanmaydi.
  const kgYozuvi = transaction.miqdorGr != null && transaction.kgNarxi != null;

  const [q, setQ] = useState<EditQiymat>({
    turi: transaction.turi as "kirim" | "chiqim",
    // Eski yozuvda tolovTuri null — kassa turidan boshlang'ich qiymat chiqariladi.
    tolovTuri:
      (transaction.tolovTuri as TolovTuri | null) ??
      (transaction.account?.turi === "plastik" || transaction.account?.turi === "bank"
        ? "click"
        : "naqd"),
    categoryId: transaction.categoryId,
    summaText: formatSom(transaction.summa),
    sana: new Date(transaction.sana).toISOString().slice(0, 10),
    izoh: transaction.izoh ?? "",
    accountId: transaction.account?.id ?? "",
    sotuvchiId: transaction.sotuvchi?.id ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<EditQiymat>) => setQ((oldi) => ({ ...oldi, ...patch }));

  const [miqdorText, setMiqdorText] = useState(kgYozuvi ? formatKg(transaction.miqdorGr!) : "");
  const [kgNarxText, setKgNarxText] = useState(kgYozuvi ? formatSom(transaction.kgNarxi!) : "");
  const miqdorKg = parseKgInput(miqdorText);
  const kgNarxi = parseSomInput(kgNarxText);
  const kgJami = miqdorKg > 0 && kgNarxi > 0 ? kgSumma(kgToGram(miqdorKg), kgNarxi) : 0;

  // Kg yozuvi kirim bo'lib qoladi va faqat kg kategoriyalari orasida ko'chadi.
  const filteredCategories = kgYozuvi
    ? categories.filter((c) => c.kgAsosli)
    : categories.filter((c) => c.turi === q.turi);

  const kassaKerak = kassaKerakmi(q.tolovTuri);

  function turiAlmash(yangi: "kirim" | "chiqim") {
    // Qarz faqat kirim uchun — chiqimga o'tilganda naqdga qaytariladi.
    set({
      turi: yangi,
      categoryId: "",
      ...(yangi === "chiqim" && q.tolovTuri === "qarz" ? { tolovTuri: "naqd" as TolovTuri } : {}),
    });
  }

  async function handleSave() {
    if (loading) return;
    setError(null);
    if (kgYozuvi) {
      if (miqdorKg <= 0) return setError("Miqdorni (kg) kiriting");
      if (kgNarxi <= 0) return setError("1 kg narxini kiriting");
    }
    const summa = parseSomInput(q.summaText);
    if (!kgYozuvi && summa <= 0) return setError("Summani kiriting");
    // KASSA MAJBURIY — server ham AYNI qoidani majburlaydi
    // (lib/services/kassaTalab.ts). Qarzda kassa umuman bo'lmaydi.
    if (kassaKerak && accounts.length > 0 && !q.accountId) return setError(KASSA_TANLANMADI);

    setLoading(true);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tolovTuri: q.tolovTuri,
          categoryId: q.categoryId,
          sana: q.sana,
          izoh: q.izoh || undefined,
          // Kassa: qarzda pul kassaga tushmaydi, shuning uchun yuborilmaydi
          // (server `accountId` ni null qiladi).
          ...(kassaKerak && q.accountId ? { accountId: q.accountId } : {}),
          ...(kgYozuvi
            ? { miqdorKg, kgNarxi }
            : { turi: q.turi, summa }),
          // Sotuvchi faqat kirimda ma'noga ega; bo'sh tanlov — bog'lanishni
          // olib tashlash (null).
          ...(sotuvchiTanlash && q.turi === "kirim"
            ? { sotuvchiId: q.sotuvchiId || null }
            : {}),
        }),
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
        <EditMaydonlar
          q={q}
          set={set}
          kgYozuvi={kgYozuvi}
          kgMaydon={
            <EditKgMaydonlari
              miqdorText={miqdorText}
              kgNarxText={kgNarxText}
              kgJami={kgJami}
              onMiqdor={setMiqdorText}
              onNarx={setKgNarxText}
              disabled={loading}
            />
          }
          filteredCategories={filteredCategories}
          accounts={accounts}
          sotuvchilar={sotuvchilar}
          sotuvchiTanlash={sotuvchiTanlash}
          kassaKerak={kassaKerak}
          onTuri={turiAlmash}
          onTolov={(t) => set({ tolovTuri: t })}
          disabled={loading}
        />

        {error && (
          <p role="alert" className="text-expense text-sm">
            {error}
          </p>
        )}

        <div className="flex gap-2 items-center pt-2">
          {canDelete && (
            <Button variant="danger" onClick={onDelete} type="button">
              O&apos;chirish
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
