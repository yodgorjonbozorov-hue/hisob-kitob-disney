"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { useToast } from "@/components/ui/Toast";
import { formatSom } from "@/lib/format";
import { MahsulotQidiruv } from "./MahsulotQidiruv";
import type { OmborMahsulotDTO } from "@/lib/queries/ombor";

export type TogrilashTuri = "inventarizatsiya" | "chiqarish";

const SARLAVHA: Record<TogrilashTuri, string> = {
  inventarizatsiya: "Inventarizatsiya",
  chiqarish: "Hisobdan chiqarish",
};

/** Tayyor sabablar — foydalanuvchi yozib o'tirmasin, lekin sabab baribir qolsin. */
const CHIQARISH_SABABLARI = ["Buzildi", "Yo'qoldi", "Ishlatildi", "Boshqa"];

/**
 * QOLDIQNI TO'G'RILASH — ikki holat, bitta oyna.
 *
 * "Inventarizatsiya" — sanalgan REAL qoldiq kiritiladi, farq avtomatik
 * ko'rsatiladi. Tarix qayta yozilmaydi: server `StockAdjustment` bilan
 * TUZATISH HARAKATINI qo'shadi, eski kirim-chiqimlar joyida qoladi.
 *
 * "Hisobdan chiqarish" — buzilgan/yo'qolgan miqdor. Bu SOTUV HISOBLANMAYDI:
 * kassaga pul tushmaydi va daromadga yozilmaydi, faqat qoldiq kamayadi.
 *
 * Mahsulot server qidiruvi bilan tanlanadi — `<select>` 1000 ta tovarda
 * telefonda ochib bo'lmaydigan ro'yxatga aylanadi.
 */
export function TogrilashSheet({
  turi,
  onClose,
  onDone,
}: {
  turi: TogrilashTuri;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [mahsulot, setMahsulot] = useState<OmborMahsulotDTO | null>(null);
  const [miqdor, setMiqdor] = useState("");
  const [sabab, setSabab] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  const son = Number(miqdor);
  const togri = miqdor !== "" && Number.isInteger(son) && son >= 0;
  const farq =
    mahsulot && togri ? (turi === "inventarizatsiya" ? son - mahsulot.miqdor : -son) : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!mahsulot) return;
    setXato(null);
    setSaqlanmoqda(true);
    try {
      const res = await fetch("/api/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: mahsulot.id, turi, miqdor: son, sabab: sabab.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setXato(data.error ?? "Saqlab bo'lmadi");
        return;
      }
      toast({
        message:
          turi === "inventarizatsiya" ? "Qoldiq to'g'rilandi" : "Hisobdan chiqarildi",
        tone: "success",
      });
      onDone();
      onClose();
    } finally {
      setSaqlanmoqda(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={SARLAVHA[turi]}>
      {!mahsulot ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">Qaysi mahsulot?</p>
          {/* Bu oynadan yangi mahsulot yaratish ma'nosiz — qoldig'i yo'q
              mahsulotni to'g'rilab bo'lmaydi. */}
          <MahsulotQidiruv onTanla={setMahsulot} onYangi={() => undefined} />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <button
            type="button"
            onClick={() => setMahsulot(null)}
            className="w-full text-left rounded-xl border border-line px-3 py-2.5 hover:bg-surface-2 transition"
          >
            <span className="block text-sm font-medium text-fg">{mahsulot.nomi}</span>
            <span className="block text-2xs text-muted tnum">
              Tizimda: {formatSom(mahsulot.miqdor)} {mahsulot.birlik} · boshqasini tanlash
            </span>
          </button>

          <div>
            <label className={LABEL_CLASS} htmlFor="tg-miqdor">
              {turi === "inventarizatsiya"
                ? `Real qoldiq (${mahsulot.birlik})`
                : `Chiqariladigan miqdor (${mahsulot.birlik})`}
            </label>
            <input
              id="tg-miqdor"
              inputMode="numeric"
              value={miqdor}
              onChange={(e) => setMiqdor(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
              className={INPUT_CLASS}
              required
              autoFocus
            />
            {togri && farq !== 0 && (
              <p className={`text-xs mt-1.5 ${farq < 0 ? "text-expense" : "text-income"}`}>
                Farq: {farq > 0 ? "+" : ""}
                {formatSom(farq)} {mahsulot.birlik}
                {turi === "inventarizatsiya" &&
                  ` (tizimda ${formatSom(mahsulot.miqdor)} → ${formatSom(son)})`}
              </p>
            )}
          </div>

          {turi === "chiqarish" && (
            <div className="flex flex-wrap gap-2">
              {CHIQARISH_SABABLARI.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSabab(s)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition min-h-[36px] ${
                    sabab === s
                      ? "bg-brand text-brand-fg border-brand"
                      : "bg-surface text-muted border-line hover:text-fg"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className={LABEL_CLASS} htmlFor="tg-sabab">
              Sabab
            </label>
            <input
              id="tg-sabab"
              value={sabab}
              onChange={(e) => setSabab(e.target.value)}
              placeholder={turi === "inventarizatsiya" ? "Masalan: oylik sanash" : "Masalan: buzildi"}
              className={INPUT_CLASS}
              minLength={3}
              maxLength={300}
              required
            />
          </div>

          {xato && <p className="text-sm text-expense">{xato}</p>}

          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={onClose} className="flex-1">
              Bekor
            </Button>
            <Button
              type="submit"
              size="lg"
              loading={saqlanmoqda}
              disabled={!togri || sabab.trim().length < 3}
              className="flex-[2]"
            >
              {turi === "inventarizatsiya" ? "Qoldiqni to'g'rilash" : "Hisobdan chiqarish"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
