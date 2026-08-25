"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import { useToast } from "@/components/ui/Toast";
import { formatSom, formatSomLabel, formatDateUz } from "@/lib/format";
import type { TaminotDTO } from "@/lib/queries/ombor";

/**
 * TA'MINOT TAFSILOTI VA BEKOR QILISH.
 *
 * BEKOR QILISH XAVFLI AMAL, shuning uchun u:
 *   - sabab yozilmaguncha bosilmaydi (audit uchun);
 *   - ombor, qarz va chiqimni BIRGA qaytaradi (serverda, bitta tranzaksiyada);
 *   - tovarning bir qismi sotilgan bo'lsa serverda RAD ETILADI va sabab
 *     foydalanuvchiga aynan shu so'zlar bilan qaytariladi.
 * Shu bois bu yerda "o'chirish" tugmasi umuman yo'q.
 */
export function TaminotDetal({
  taminot: t,
  onClose,
  onYangilandi,
}: {
  taminot: TaminotDTO;
  onClose: () => void;
  onYangilandi: () => void;
}) {
  const { toast } = useToast();
  const [bekorRejim, setBekorRejim] = useState(false);
  const [sabab, setSabab] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [ishlamoqda, setIshlamoqda] = useState(false);

  async function bekorQil() {
    setXato(null);
    setIshlamoqda(true);
    try {
      const res = await fetch(`/api/ombor/taminot/${t.id}/bekor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sabab: sabab.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setXato(data.error ?? "Bekor qilib bo'lmadi");
        return;
      }
      toast({ message: "Ta'minot bekor qilindi, yozuvlar qaytarildi", tone: "success" });
      onYangilandi();
    } finally {
      setIshlamoqda(false);
    }
  }

  async function qabulQil() {
    setXato(null);
    setIshlamoqda(true);
    try {
      const res = await fetch(`/api/ombor/taminot/${t.id}/qabul`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setXato(data.error ?? "Qabul qilib bo'lmadi");
        return;
      }
      toast({ message: "Qabul qilindi — ombor qoldig'i oshdi", tone: "success" });
      onYangilandi();
    } finally {
      setIshlamoqda(false);
    }
  }

  const bekorQilingan = t.holat === "bekor";
  // Eski XARID moduli bilan yaratilgan, hali qabul qilinmagan buyurtma.
  const kutilmoqda = t.holat === "qoralama" || t.holat === "tasdiqlangan";

  return (
    <Modal open onClose={onClose} title={t.supplierNomi} size="lg">
      <div className="space-y-4">
        <div className="rounded-xl border border-line divide-y divide-line">
          <Qator nomi="Sana" qiymat={formatDateUz(new Date(t.qabulSana ?? t.sana))} />
          <Qator
            nomi="To'lov turi"
            qiymat={t.tolovTuri === "qarz" ? "📒 Qarzga" : "💵 To'langan"}
          />
          <Qator nomi="Jami summa" qiymat={formatSomLabel(t.jamiSumma)} />
          {t.tolanganSumma > 0 && t.tolanganSumma < t.jamiSumma && (
            <Qator nomi="To'langan" qiymat={formatSomLabel(t.tolanganSumma)} />
          )}
        </div>

        <div>
          <p className="font-medium text-fg mb-2">Mahsulotlar</p>
          <ul className="rounded-xl border border-line divide-y divide-line">
            {t.satrlar.map((s) => (
              <li key={s.productId} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-9 h-9 shrink-0 rounded-lg bg-surface-2 overflow-hidden flex items-center justify-center">
                  {s.rasmUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.rasmUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm text-faint" aria-hidden>
                      &#128230;
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg truncate">{s.nomi}</span>
                  <span className="block text-2xs text-muted tnum">
                    {formatSom(s.miqdor)} {s.birlik} &times; {formatSom(s.birlikNarx)}
                  </span>
                </span>
                <span className="text-sm font-medium tnum shrink-0">
                  {formatSomLabel(s.jamiSumma)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {t.qoldiqQarz > 0 && (
          <div className="rounded-lg bg-debt-soft px-3 py-2.5 flex items-center justify-between gap-2">
            <span className="text-sm text-debt-fg">
              Men qarzdorman: <span className="font-semibold">{formatSomLabel(t.qoldiqQarz)}</span>
            </span>
            <Link href="/app/qarzlar" className="text-xs text-brand hover:underline shrink-0">
              Qarzlarga o&apos;tish
            </Link>
          </div>
        )}

        {kutilmoqda && (
          <div className="space-y-2">
            <p className="text-xs text-muted bg-surface-2 rounded-lg px-3 py-2">
              Bu buyurtma hali qabul qilinmagan — ombor ham, kassa ham
              o&apos;zgarmagan. Qabul qilinganda tovar omborga tushadi va
              to&apos;lov turiga qarab chiqim yoki qarz yoziladi.
            </p>
            <Button loading={ishlamoqda} onClick={() => void qabulQil()} className="w-full">
              Qabul qilish
            </Button>
            {xato && <p className="text-sm text-expense">{xato}</p>}
          </div>
        )}

        {bekorQilingan ? (
          <p className="text-sm text-muted bg-surface-2 rounded-lg px-3 py-2">
            Bu ta&apos;minot bekor qilingan{t.bekorSabab ? `: ${t.bekorSabab}` : ""}. Ombor, qarz
            va chiqim yozuvlari qaytarilgan.
          </p>
        ) : bekorRejim ? (
          <div className="space-y-2">
            <p className="text-sm text-fg">
              Bekor qilinsa qoldiq kamayadi, qarz yoki chiqim qaytariladi. Sababni yozing:
            </p>
            <input
              value={sabab}
              onChange={(e) => setSabab(e.target.value)}
              placeholder="Masalan: xato kiritildi"
              className={INPUT_CLASS}
              maxLength={300}
              autoFocus
            />
            {xato && <p className="text-sm text-expense">{xato}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setBekorRejim(false)} className="flex-1">
                Yo&apos;q
              </Button>
              <Button
                variant="danger"
                disabled={sabab.trim().length < 3}
                loading={ishlamoqda}
                onClick={() => void bekorQil()}
                className="flex-1"
              >
                Ha, bekor qilinsin
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setBekorRejim(true)} className="w-full">
            Ta&apos;minotni bekor qilish
          </Button>
        )}
      </div>
    </Modal>
  );
}

function Qator({ nomi, qiymat }: { nomi: string; qiymat: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <span className="text-sm text-muted">{nomi}</span>
      <span className="text-sm font-medium text-fg tnum">{qiymat}</span>
    </div>
  );
}
