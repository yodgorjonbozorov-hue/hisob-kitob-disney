"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { soro } from "./soro";

/**
 * XAVFLI AMAL TASDIG'I (talab 46).
 *
 * Uch qismli tasdiq, chunki bu amallar qaytarib bo'lmaydi yoki mijozga
 * darhol ta'sir qiladi:
 *   1. NIMA BO'LADI — oqibatlar ro'yxati (taxmin qilishga qoldirilmaydi);
 *   2. SABAB — audit jurnaliga tushadi, majburiy;
 *   3. TASDIQ — eng xavflilarida so'zni qo'lda yozish talab qilinadi.
 *
 * Server baribir mustaqil tekshiradi: bu modal QULAYLIK, himoya emas.
 */
export function XavfliAmal({
  label,
  sarlavha,
  tavsif,
  nimaBoladi,
  url,
  method = "POST",
  body,
  sababKerak = true,
  yozibTasdiqlash,
  variant = "danger",
  size = "sm",
  muvaffaqiyatMatni,
  ochiq,
  onYopish,
  onMuvaffaqiyat,
}: {
  label?: string;
  sarlavha: string;
  tavsif?: string;
  nimaBoladi: string[];
  url: string;
  method?: string;
  body?: Record<string, unknown>;
  sababKerak?: boolean;
  /** Berilsa, foydalanuvchi shu so'zni QO'LDA yozmaguncha tugma yopiq. */
  yozibTasdiqlash?: string;
  variant?: "danger" | "primary" | "secondary";
  size?: "sm" | "md";
  muvaffaqiyatMatni?: string;
  /** Tashqaridan boshqarish (masalan ommaviy amal panelidan). */
  ochiq?: boolean;
  onYopish?: () => void;
  onMuvaffaqiyat?: (malumot: Record<string, unknown> | null) => void;
}) {
  const router = useRouter();
  const [ichkiOchiq, setIchkiOchiq] = useState(false);
  const [sabab, setSabab] = useState("");
  const [tasdiq, setTasdiq] = useState("");
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [natija, setNatija] = useState<string | null>(null);

  const boshqariladi = ochiq !== undefined;
  const open = boshqariladi ? ochiq : ichkiOchiq;

  function yop() {
    if (band) return;
    setSabab("");
    setTasdiq("");
    setXato(null);
    setNatija(null);
    if (boshqariladi) onYopish?.();
    else setIchkiOchiq(false);
  }

  const sababYetarli = !sababKerak || sabab.trim().length >= 10;
  const tasdiqOk = !yozibTasdiqlash || tasdiq.trim().toUpperCase() === yozibTasdiqlash.toUpperCase();

  async function yubor(e: FormEvent) {
    e.preventDefault();
    if (!sababYetarli || !tasdiqOk) return;
    setBand(true);
    setXato(null);
    const javob = await soro(url, {
      method,
      body: { ...(body ?? {}), ...(sababKerak ? { sabab: sabab.trim() } : {}) },
    });
    setBand(false);
    if (!javob.ok) {
      setXato(javob.xato);
      return;
    }
    onMuvaffaqiyat?.(javob.malumot as Record<string, unknown> | null);
    router.refresh();
    if (muvaffaqiyatMatni) {
      setNatija(muvaffaqiyatMatni);
      return;
    }
    yop();
  }

  const maydon =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

  return (
    <>
      {!boshqariladi && label && (
        <Button variant={variant} size={size} onClick={() => setIchkiOchiq(true)}>
          {label}
        </Button>
      )}

      <Modal open={open} onClose={yop} title={sarlavha}>
        {natija ? (
          <div className="space-y-4">
            <p className="text-sm text-income-fg">{natija}</p>
            <Button variant="secondary" onClick={yop}>
              Yopish
            </Button>
          </div>
        ) : (
          <form onSubmit={yubor} className="space-y-4">
            {tavsif && <p className="text-sm text-muted">{tavsif}</p>}

            <div className="rounded-lg bg-surface-2 border border-line p-3">
              <p className="text-2xs uppercase tracking-wide text-faint font-medium mb-1.5">
                Nima bo&apos;ladi
              </p>
              <ul className="space-y-1">
                {nimaBoladi.map((n) => (
                  <li key={n} className="text-sm text-fg flex gap-2">
                    <span aria-hidden="true" className="text-faint">
                      ·
                    </span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>

            {sababKerak && (
              <div>
                <label htmlFor="xavfli-sabab" className="block text-sm font-medium text-fg mb-1">
                  Sabab <span className="text-expense">*</span>
                </label>
                <textarea
                  id="xavfli-sabab"
                  value={sabab}
                  onChange={(e) => setSabab(e.target.value)}
                  rows={2}
                  required
                  minLength={10}
                  placeholder="Bu amal nega bajarilmoqda? (audit jurnaliga yoziladi)"
                  className={maydon}
                />
                <p className="text-2xs text-faint mt-1">
                  Kamida 10 belgi. Sabab o&apos;zgarmas audit jurnaliga tushadi.
                </p>
              </div>
            )}

            {yozibTasdiqlash && (
              <div>
                <label htmlFor="xavfli-tasdiq" className="block text-sm font-medium text-fg mb-1">
                  Tasdiqlash uchun <code className="font-mono">{yozibTasdiqlash}</code> so&apos;zini
                  yozing
                </label>
                <input
                  id="xavfli-tasdiq"
                  value={tasdiq}
                  onChange={(e) => setTasdiq(e.target.value)}
                  className={maydon}
                  autoComplete="off"
                />
              </div>
            )}

            {xato && (
              <p className="text-sm text-expense-fg bg-expense-soft rounded-lg px-3 py-2" role="alert">
                {xato}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={yop} disabled={band}>
                Bekor qilish
              </Button>
              <Button
                type="submit"
                variant={variant}
                loading={band}
                disabled={!sababYetarli || !tasdiqOk}
              >
                Tasdiqlash
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
