"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * KUNNI QAYTA OCHISH — sabab MAJBURIY (M-9): tasdiqlangan moliyaviy kun
 * "tugmani bexosdan bosib" ochilib ketmasin va nega ochilgani auditda
 * hamda tarixda ko'rinib tursin.
 */
export function QaytaOchishModal({
  sana,
  onClose,
  onDone,
}: {
  sana: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [sabab, setSabab] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const sababTogri = sabab.trim().length >= 5;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!sababTogri) {
      setXato("Sabab kamida 5 belgi bo'lsin");
      return;
    }
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kunlik/qayta-ochish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sana, sabab: sabab.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Qayta ochib bo'lmadi");
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
    <Modal open onClose={onClose} title="Kunni qayta ochish">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">
          Yakunlangan kun tuzatish uchun ochiladi: topshiruv ma&apos;lumotlari tozalanadi va
          xodim kassani <span className="font-medium text-fg">qayta sanab</span> topshiradi.
          Sabab audit jurnaliga yoziladi.
        </p>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="qayta-ochish-sabab">
            Sabab (majburiy)
          </label>
          <textarea
            id="qayta-ochish-sabab"
            value={sabab}
            onChange={(e) => setSabab(e.target.value)}
            required
            minLength={5}
            maxLength={300}
            rows={3}
            placeholder="Masalan: kassir 150 000 so'mlik tushumni kiritmagan"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg"
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            Qayta ochish
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
