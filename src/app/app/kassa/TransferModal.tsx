"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { parseSomInput, formatMoney } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import type { AccountQoldiq } from "@/lib/queries/accounts";

interface UserOption {
  id: string;
  ism: string;
}

/**
 * Pul ko'chirish. Ikki rejim:
 *  - KASSAGA — kassalar aro (avvalgi xatti-harakat);
 *  - FOYDALANUVCHIGA (PRO) — qabul qiluvchining shaxsiy kassasiga (server
 *    kassani o'zi topadi/ochadi).
 * Bu kirim ham, chiqim ham EMAS — shuning uchun hisobotdagi aylanmaga ta'sir qilmaydi.
 */
export function TransferModal({
  kassalar,
  userlar,
  onClose,
  onDone,
}: {
  kassalar: AccountQoldiq[];
  userlar: UserOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [rejim, setRejim] = useState<"kassa" | "user">(
    kassalar.length < 2 && userlar.length > 0 ? "user" : "kassa"
  );
  const [fromAccountId, setFrom] = useState(kassalar[0]?.id ?? "");
  const [toAccountId, setTo] = useState(kassalar[1]?.id ?? "");
  const [toUserId, setToUserId] = useState(userlar[0]?.id ?? "");
  const [summaMatn, setSummaMatn] = useState("");
  const [sana, setSana] = useState(todayDateOnlyString());
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const summa = parseSomInput(summaMatn);
  const manba = kassalar.find((k) => k.id === fromAccountId);
  const yetarli = !manba || summa <= manba.qoldiq;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const body =
        rejim === "user"
          ? { toUserId, fromAccountId: fromAccountId || null, summa, sana, izoh: izoh || null }
          : { fromAccountId, toAccountId, summa, sana, izoh: izoh || null };
      const res = await fetch("/api/accounts/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  const select = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";
  const tugma = (faol: boolean) =>
    `flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      faol ? "bg-brand text-white" : "bg-surface-2 text-muted hover:text-fg"
    }`;

  return (
    <Modal open onClose={onClose} title="Pul ko'chirish">
      <form onSubmit={submit} className="space-y-3">
        {userlar.length > 0 && (
          <div className="flex gap-2">
            <button type="button" className={tugma(rejim === "kassa")} onClick={() => setRejim("kassa")}>
              Kassaga
            </button>
            <button type="button" className={tugma(rejim === "user")} onClick={() => setRejim("user")}>
              Foydalanuvchiga
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tr-from">
            Qaysi kassadan
          </label>
          <select id="tr-from" value={fromAccountId} onChange={(e) => setFrom(e.target.value)} className={select}>
            {kassalar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nomi} · {formatMoney(k.qoldiq)}
              </option>
            ))}
          </select>
        </div>

        {rejim === "user" ? (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="tr-user">
              Kimga (pul oluvchi)
            </label>
            <select id="tr-user" value={toUserId} onChange={(e) => setToUserId(e.target.value)} className={select}>
              {userlar.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.ism}
                </option>
              ))}
            </select>
            <p className="text-2xs text-faint mt-1">
              Pul qabul qiluvchining shaxsiy kassasiga tushadi (kassasi bo&apos;lmasa avtomatik ochiladi).
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="tr-to">
              Qaysi kassaga
            </label>
            <select id="tr-to" value={toAccountId} onChange={(e) => setTo(e.target.value)} className={select}>
              {kassalar
                .filter((k) => k.id !== fromAccountId)
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nomi} · {formatMoney(k.qoldiq)}
                  </option>
                ))}
            </select>
          </div>
        )}

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
            <p className="text-2xs text-debt mt-1">
              Diqqat: manba kassada {formatMoney(manba!.qoldiq)} bor — qoldiq manfiy bo&apos;ladi.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tr-sana">
            Sana
          </label>
          <input
            id="tr-sana"
            type="date"
            value={sana}
            onChange={(e) => setSana(e.target.value)}
            required
            className={select}
          />
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
            placeholder="Masalan: kunlik tushumni bankka topshirdik"
            className={select}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <p className="text-2xs text-faint">
          Pul ko&apos;chirish kirim ham, chiqim ham hisoblanmaydi — hisobotdagi aylanma o&apos;zgarmaydi.
        </p>

        <div className="flex gap-2 pt-1">
          <Button
            type="submit"
            loading={loading}
            disabled={summa <= 0 || (rejim === "user" ? !toUserId : !toAccountId)}
          >
            Ko&apos;chirish
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
