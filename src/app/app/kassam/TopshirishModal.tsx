"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { useToast } from "@/components/ui/Toast";
import { formatSom, parseSomInput } from "@/lib/format";

/**
 * KASSANI TOPSHIRISH tasdiq oynasi.
 *
 * ALDASHNING OLDINI OLISH (talab 11): topshiriladigan summa default holda
 * TIZIM hisoblagan qoldiq bo'ladi va uni o'zgartirish uchun foydalanuvchi
 * ataylab "Boshqa summa topshiraman" ni bosishi kerak. Bosilganda ham
 * kiritilgan raqam tizim hisobini ALMASHTIRMAYDI — server qoldiqni o'zi
 * qayta hisoblaydi va farq (kamomad/ortiqcha) direktorga ko'rinadi.
 */
export function TopshirishModal({
  qoldiq,
  onClose,
  onDone,
}: {
  qoldiq: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [boshqa, setBoshqa] = useState(false);
  const [summaText, setSummaText] = useState(formatSom(qoldiq));
  const [izoh, setIzoh] = useState("");
  const [yuborilmoqda, setYuborilmoqda] = useState(false);

  const topshiriladigan = boshqa ? parseSomInput(summaText) : qoldiq;
  const farq = topshiriladigan - qoldiq;

  async function yubor() {
    setYuborilmoqda(true);
    try {
      const res = await fetch("/api/kassa-topshirish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topshirilgan: topshiriladigan, izoh: izoh.trim() || undefined }),
      });
      if (!res.ok) {
        toast({ message: (await res.json()).error ?? "Topshirib bo'lmadi", tone: "error" });
        return;
      }
      toast({ message: "Kassa topshirildi — direktor tasdig'i kutilmoqda", tone: "success" });
      onDone();
    } catch {
      toast({ message: "Serverga ulanib bo'lmadi", tone: "error" });
    } finally {
      setYuborilmoqda(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Kassani topshirish">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 p-4">
          <p className="text-sm text-muted">Tizim hisoblagan kassa qoldig&apos;i</p>
          <Money value={qoldiq} size="xl" tone="brand" />
        </div>

        {!boshqa ? (
          <button
            type="button"
            onClick={() => setBoshqa(true)}
            className="text-sm text-brand hover:underline"
          >
            Kassamda boshqa summa bor
          </button>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-fg" htmlFor="topshiriladigan">
              Haqiqatda topshirilayotgan summa
            </label>
            <input
              id="topshiriladigan"
              inputMode="numeric"
              value={summaText}
              onChange={(e) => setSummaText(formatSom(parseSomInput(e.target.value)))}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-fg tnum"
            />
            {farq !== 0 && (
              <p className="text-sm">
                <span className={farq < 0 ? "text-expense" : "text-debt"}>
                  {farq < 0 ? "Kamomad" : "Ortiqcha"}:{" "}
                </span>
                <Money value={Math.abs(farq)} size="sm" />
                <span className="text-muted"> — direktor tasdiqlashi kerak bo&apos;ladi.</span>
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-sm font-medium text-fg" htmlFor="topshirish-izoh">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="topshirish-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={300}
            placeholder="Masalan: kechki smena puli"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-fg"
          />
        </div>

        <p className="text-sm text-muted">
          Bu summani direktor/qabul qiluvchiga topshirishingizni tasdiqlaysizmi? Kirim, chiqim va
          sof balans o&apos;zgarmaydi — faqat kassangizdagi qoldiq kamayadi.
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button onClick={yubor} loading={yuborilmoqda} disabled={topshiriladigan <= 0}>
            Topshirish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
