"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { parseSomInput, formatSom, formatMoney } from "@/lib/format";
import type { KassaNazoratKarta } from "@/lib/queries/kassaNazorat";

const input =
  "w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-surface-2 border border-line text-fg " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/**
 * KASSADAN KASSAGA PUL O'TKAZISH.
 *
 * Ikki qadam: forma → TASDIQLASH. Moliyaviy amal bir bosishda bajarilmaydi —
 * foydalanuvchi kim kimga qancha yuborayotganini o'qib tasdiqlaydi.
 *
 * MAVJUD qoldiq ko'rsatiladi (qoldiq − tasdiq kutayotgan chiqim), chunki
 * server aynan shuni tekshiradi: tasdiq kutayotgan pul kassada turgan
 * bo'lsa ham qayta jo'natib bo'lmaydi. Aks holda forma "yetadi" deb turib,
 * server rad etardi.
 *
 * Qabul qiluvchi kassa boshqa odamniki bo'lsa o'tkazma DARHOL yakunlanmaydi:
 * u tasdiq kutadi (lib/services/kassaTransfer.ts).
 */
export function TransferModal({
  kassalar,
  boshlangichId,
  meniKassam,
  onClose,
  onDone,
}: {
  /** Faol kassalar — yuboruvchi ham, qabul qiluvchi ham shu ro'yxatdan. */
  kassalar: KassaNazoratKarta[];
  boshlangichId: string | null;
  /** Joriy foydalanuvchining kassasi (bo'lsa) — standart yuboruvchi. */
  meniKassam: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const boshFrom = boshlangichId ?? meniKassam ?? kassalar[0]?.id ?? "";
  const [fromId, setFrom] = useState(boshFrom);
  const [toId, setTo] = useState(kassalar.find((k) => k.id !== boshFrom)?.id ?? "");
  const [summaMatn, setSummaMatn] = useState("");
  const [izoh, setIzoh] = useState("");
  const [tasdiq, setTasdiq] = useState(false);
  const [yuborilmoqda, setYuborilmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const summa = parseSomInput(summaMatn);
  const manba = kassalar.find((k) => k.id === fromId);
  const qabul = kassalar.find((k) => k.id === toId);
  const mavjud = manba?.mavjud ?? 0;
  const yetarli = summa <= mavjud;
  const tasdiqKerak = !!qabul?.userId && qabul.id !== meniKassam;

  function manbaAlmash(id: string) {
    setFrom(id);
    if (toId === id) setTo(kassalar.find((k) => k.id !== id)?.id ?? "");
  }

  async function yubor() {
    setYuborilmoqda(true);
    setXato(null);
    try {
      const res = await fetch("/api/kassa-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: fromId,
          toAccountId: toId,
          summa,
          turi: "transfer",
          izoh: izoh.trim() || null,
        }),
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
      setYuborilmoqda(false);
    }
  }

  if (tasdiq) {
    return (
      <Modal open onClose={() => setTasdiq(false)} title="Tasdiqlaysizmi?">
        <div className="space-y-4">
          <div className="rounded-xl bg-surface-2 border border-line p-4 text-center space-y-1">
            <p className="text-sm text-muted">{manba?.nomi}</p>
            <p className="text-2xl font-display font-bold text-fg tnum">{formatMoney(summa)}</p>
            <p className="text-sm text-muted">↓</p>
            <p className="text-sm font-medium text-fg">{qabul?.nomi}</p>
          </div>
          {tasdiqKerak && (
            <p className="text-2xs text-muted">
              {qabul?.egaIsm ?? "Qabul qiluvchi"} tasdiqlamaguncha pul sizning kassangizda qoladi.
            </p>
          )}
          <p className="text-2xs text-faint">
            O&apos;tkazma kirim ham, chiqim ham hisoblanmaydi — savdo va sof foyda
            o&apos;zgarmaydi.
          </p>
          {xato && <p className="text-sm text-expense">{xato}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setTasdiq(false)} disabled={yuborilmoqda}>
              Orqaga
            </Button>
            {/* Yuborilayotganda tugma o'chadi; server esa aynan shu yo'nalish
                va summadagi ochiq o'tkazmani ikkinchi marta yaratmaydi. */}
            <Button loading={yuborilmoqda} onClick={yubor}>
              Tasdiqlash
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

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
            Qaysi kassadan
          </label>
          <select
            id="tr-from"
            value={fromId}
            onChange={(e) => manbaAlmash(e.target.value)}
            className={input}
          >
            {kassalar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nomi} · {formatSom(k.mavjud)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tr-to">
            Qaysi kassaga
          </label>
          <select id="tr-to" value={toId} onChange={(e) => setTo(e.target.value)} className={input}>
            <option value="">— tanlang —</option>
            {kassalar
              .filter((k) => k.id !== fromId)
              .map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nomi} · {formatSom(k.mavjud)}
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
            autoComplete="off"
            value={summaMatn}
            // Guruhlab ko'rsatish — "2 000 000" ni "20 000 00" dan ajratish
            // uchun (ilovadagi boshqa summa maydonlari bilan bir xil).
            onChange={(e) =>
              setSummaMatn(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")
            }
            required
            placeholder="0"
            className={`${input} text-lg font-display tnum`}
          />
          <p className={`text-2xs mt-1.5 ${summa > 0 && !yetarli ? "text-expense" : "text-faint"}`}>
            {summa > 0 && !yetarli
              ? `Kassada yetarli mablag' yo'q. Mavjud: ${formatSom(mavjud)} soʻm`
              : `Mavjud: ${formatSom(mavjud)} soʻm`}
          </p>
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
            placeholder="Masalan: bankka topshirish uchun"
            className={input}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={summa <= 0 || !toId || !yetarli}>
            Davom etish
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
