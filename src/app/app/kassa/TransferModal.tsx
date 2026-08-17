"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { parseSomInput, formatMoney } from "@/lib/format";
import { TRANSFER_TURLARI, TRANSFER_TURI_NOMI, type TransferTuri } from "@/lib/validation/account";
import type { AccountQoldiq } from "@/lib/queries/accounts";

/**
 * KASSADAN KASSAGA PUL O'TKAZISH.
 *
 * Ikki qadam: forma → TASDIQLASH ekrani. Moliyaviy amal bir bosishda
 * bajarilmaydi — foydalanuvchi kim kimga qancha yuborayotganini o'qib
 * tasdiqlaydi.
 *
 * Qabul qiluvchi kassa boshqa odamniki bo'lsa, o'tkazma DARHOL yakunlanmaydi:
 * u tasdiq kutadi va faqat qabul qiluvchi "Qabul qilish"ni bosgandan keyin
 * pul ko'chadi (lib/services/kassaTransfer.ts).
 */
export function TransferModal({
  kassalar,
  meniKassam,
  onClose,
  onDone,
}: {
  /** Faol kassalar — yuboruvchi ham, qabul qiluvchi ham shu ro'yxatdan. */
  kassalar: AccountQoldiq[];
  /** Joriy foydalanuvchining kassasi (bo'lsa) — standart yuboruvchi. */
  meniKassam: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [fromAccountId, setFrom] = useState(meniKassam ?? kassalar[0]?.id ?? "");
  const [toAccountId, setTo] = useState(
    kassalar.find((k) => k.id !== (meniKassam ?? kassalar[0]?.id))?.id ?? ""
  );
  const [summaMatn, setSummaMatn] = useState("");
  const [turi, setTuri] = useState<TransferTuri>("transfer");
  const [izoh, setIzoh] = useState("");
  const [tasdiq, setTasdiq] = useState(false);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const summa = parseSomInput(summaMatn);
  const manba = kassalar.find((k) => k.id === fromAccountId);
  const qabul = kassalar.find((k) => k.id === toAccountId);
  const yetarli = !manba || summa <= manba.qoldiq;
  const tasdiqKerak = !!qabul?.userId && qabul.id !== meniKassam;

  async function yubor(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kassa-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAccountId, toAccountId, summa, turi, izoh: izoh || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        setTasdiq(false);
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
      setTasdiq(false);
    } finally {
      setLoading(false);
    }
  }

  const select = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

  // ── TASDIQLASH QADAMI ──────────────────────────────────────────────────
  if (tasdiq) {
    return (
      <Modal open onClose={() => setTasdiq(false)} title="Tasdiqlaysizmi?">
        <div className="space-y-4">
          <div className="rounded-xl bg-surface-2 border border-line p-4 text-center space-y-1">
            <p className="text-sm text-muted">{manba?.nomi} kassasidan</p>
            <p className="text-2xl font-bold text-fg tnum">{formatMoney(summa)}</p>
            <p className="text-sm text-muted">{qabul?.nomi} kassasiga</p>
            <p className="text-sm font-medium text-fg">o&apos;tkazilsinmi?</p>
          </div>
          {tasdiqKerak && (
            <p className="text-2xs text-muted">
              {qabul?.egaIsm ?? "Qabul qiluvchi"} tasdiqlamaguncha pul sizning kassangizda qoladi.
            </p>
          )}
          {xato && <p className="text-sm text-expense">{xato}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setTasdiq(false)}>
              Bekor qilish
            </Button>
            <Button type="button" loading={loading} onClick={yubor}>
              Tasdiqlash
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // ── FORMA QADAMI ───────────────────────────────────────────────────────
  return (
    <Modal open onClose={onClose} title="Pul o'tkazish">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTasdiq(true);
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tr-from">
            Kassadan
          </label>
          <select id="tr-from" value={fromAccountId} onChange={(e) => setFrom(e.target.value)} className={select}>
            {kassalar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nomi} · {formatMoney(k.qoldiq)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tr-to">
            Kassaga
          </label>
          <select id="tr-to" value={toAccountId} onChange={(e) => setTo(e.target.value)} className={select}>
            <option value="">— tanlang —</option>
            {kassalar
              .filter((k) => k.id !== fromAccountId)
              .map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nomi} · {formatMoney(k.qoldiq)}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tr-summa">
            Summa
          </label>
          <input
            id="tr-summa"
            inputMode="numeric"
            value={summaMatn}
            onChange={(e) => setSummaMatn(e.target.value)}
            required
            placeholder="0"
            className={select}
          />
          {summa > 0 && !yetarli && (
            <p className="text-2xs text-expense mt-1">
              Kassada yetarli mablag&apos; mavjud emas. Mavjud: {formatMoney(manba!.qoldiq)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tr-turi">
            Sabab
          </label>
          <select
            id="tr-turi"
            value={turi}
            onChange={(e) => setTuri(e.target.value as TransferTuri)}
            className={select}
          >
            {TRANSFER_TURLARI.map((t) => (
              <option key={t} value={t}>
                {TRANSFER_TURI_NOMI[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tr-izoh">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="tr-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={300}
            placeholder="Masalan: kechki smena topshirildi"
            className={select}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <p className="text-2xs text-faint">
          Pul o&apos;tkazish kirim ham, chiqim ham hisoblanmaydi — savdo va sof foyda o&apos;zgarmaydi.
        </p>

        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={summa <= 0 || !toAccountId || !yetarli}>
            Davom etish
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
