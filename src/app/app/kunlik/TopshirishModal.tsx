"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import type { KunlikKassaDTO } from "@/lib/queries/kunlik";
import { FarqBloki, SummaInput, sonOqi } from "./SummaInput";

/**
 * KUNNI DIREKTORGA TOPSHIRISH — solishtiruv varag'i.
 *
 * ═══ NIMA SODIR BO'LADI ═══
 * Yuborilganda: kun `SUBMITTED` ga o'tadi va topshirilayotgan summa uchun
 * "kutilmoqda" holatidagi pul o'tkazmasi yaraladi. Pul HALI kassirda —
 * direktor qabul qilganda ko'chadi. Bu ataylab: tasdiqlanmagan pul hech
 * kimning kassasida bo'lmagan holatga tushmasligi kerak.
 *
 * ═══ FARQ ═══
 * farq = real topshirilayotgan − tizim bo'yicha kassada.
 * Farq 0 bo'lmasa IZOH MAJBURIY (server ham tekshiradi — bu yerdagi
 * tekshiruv faqat tezkor javob uchun).
 */
export function TopshirishModal({
  sana,
  kassa,
  direktorIsm,
  onClose,
  onDone,
}: {
  sana: string;
  kassa: KunlikKassaDTO;
  direktorIsm: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [real, setReal] = useState(String(Math.max(kassa.qoldiq, 0)));
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const realSon = sonOqi(real);
  const farq = realSon === null ? null : realSon - kassa.qoldiq;
  const izohKerak = farq !== null && farq !== 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (realSon === null) {
      setXato("Summa 0 yoki undan katta butun son bo'lishi kerak");
      return;
    }
    if (izohKerak && !izoh.trim()) {
      setXato("Farq bor — sababini yozing");
      return;
    }
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kunlik/topshirish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sana, sanalganNaqd: realSon, izoh: izoh.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Topshirib bo'lmadi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Kunni direktorga topshirish">
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-2xs text-faint">
            {kassa.shaxsiy ? kassa.kassaNomi ?? "Sizning kassangiz" : "Biznes naqd kassasi"}
          </p>
          <div className="mt-0.5">
            <Money
              value={kassa.qoldiq}
              size="xl"
              tone={kassa.qoldiq < 0 ? "expense" : "brand"}
              signed={kassa.qoldiq < 0}
            />
          </div>
          <p className="text-2xs text-muted mt-0.5">Tizim bo&apos;yicha topshirilishi kerak</p>
        </div>

        <SummaInput
          id="topshirish-real"
          label="Real topshirayotgan naqd (so'm)"
          value={real}
          onChange={setReal}
          autoFocus
        />

        <FarqBloki kutilgan={kassa.qoldiq} real={realSon} />

        <div>
          <p className="text-sm text-muted">
            Qabul qiluvchi:{" "}
            <span className="font-medium text-fg">
              {direktorIsm ? `${direktorIsm} (direktor kassasi)` : "Markaziy kassa"}
            </span>
          </p>
          {!kassa.shaxsiy && (
            <p className="text-2xs text-faint mt-1">
              Bu bizneste shaxsiy kassa rejimi yoqilmagan — pul allaqachon biznes kassasida.
              Topshirish faqat solishtiruv sifatida yoziladi.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="topshirish-izoh">
            Izoh {izohKerak ? <span className="text-expense">— majburiy</span> : "(ixtiyoriy)"}
          </label>
          <input
            id="topshirish-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={300}
            placeholder="Masalan: 50 000 qaytim uchun ajratildi"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-surface-2 border border-line text-fg focus:border-brand focus:outline-none"
          />
        </div>

        <p className="text-2xs text-faint">
          Topshirilgandan keyin bu kunga yangi tushum kiritib bo&apos;lmaydi. Pul direktor qabul
          qilganda ko&apos;chadi — bu KIRIM ham, CHIQIM ham emas, faqat kassa egasi almashadi.
        </p>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1 sticky bottom-0 bg-surface pb-1">
          <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Bekor qilish
          </Button>
          <Button type="submit" loading={loading} className="w-full sm:w-auto">
            📤 Topshirish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
