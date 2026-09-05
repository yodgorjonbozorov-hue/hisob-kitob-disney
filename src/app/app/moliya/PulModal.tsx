"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ShaxsTanlash } from "./ShaxsTanlash";
import { QarzKorinish } from "./QarzKorinish";
import { PulMaydonlari } from "./PulMaydonlari";
import { usePulFormasi } from "./usePulFormasi";
import type { KassaOption, KategoriyaOption, PulFormasi } from "./turlar";

/**
 * "PUL OLDIM / PUL BERDIM" OYNASI.
 *
 * Video referensidagi tartib saqlangan: Kimdan → Sabab → Summa → To'lov
 * usuli → Kassa → Saqlash. Sana va izoh yig'ilgan holda turadi — kundalik
 * yozuvda ular kerak emas (14-talab: minimal bosish).
 *
 * TAKROR BOSISHDAN HIMOYA: `amalId` oyna ochilganda BIR MARTA yaratiladi va
 * qayta urinishlarda O'ZGARMAYDI — server ikkinchi so'rovda yangi yozuv
 * yozmaydi, mavjudini qaytaradi (lib/services/pulOqimi.ts).
 */
export function PulModal({
  ochiq,
  onClose,
  boshlangich,
  kassalar,
  kategoriyalar,
  tahrirAmalId,
  onSaqlandi,
}: {
  ochiq: boolean;
  onClose: () => void;
  boshlangich: PulFormasi;
  kassalar: KassaOption[];
  kategoriyalar: KategoriyaOption[];
  /** Berilsa — mavjud amal tuzatilmoqda (11-talab). */
  tahrirAmalId?: string | null;
  onSaqlandi: () => void;
}) {
  const f = usePulFormasi(boshlangich, kategoriyalar);
  const [amalId] = useState(() => crypto.randomUUID());
  const [yuborilmoqda, setYuborilmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const kirim = f.forma.yonalish === "kirim";

  async function saqla() {
    if (f.xato) {
      setXato(f.xato);
      return;
    }
    setYuborilmoqda(true);
    setXato(null);
    try {
      const tana = {
        yonalish: f.forma.yonalish,
        shaxsTuri: f.forma.shaxs.turi,
        shaxsId: f.forma.shaxs.id,
        shaxsIsm: f.forma.shaxs.ism,
        sababKod: f.forma.sababKod || null,
        categoryId: f.forma.categoryId || null,
        summa: f.summa,
        sana: f.forma.sana,
        usul: f.forma.usul,
        accountId: f.forma.accountId || null,
        izoh: f.forma.izoh || null,
      };
      const res = await fetch(tahrirAmalId ? `/api/moliya/${tahrirAmalId}` : "/api/moliya", {
        method: tahrirAmalId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tahrirAmalId ? tana : { ...tana, amalId }),
      });
      const javob = await res.json();
      if (!res.ok) {
        setXato(javob.error ?? "Saqlab bo'lmadi");
        return;
      }
      onSaqlandi();
      onClose();
    } catch {
      setXato("Tarmoq xatosi — qayta urinib ko'ring");
    } finally {
      setYuborilmoqda(false);
    }
  }

  const sababVariantlari = [
    ...f.sabablar.map((s) => ({ value: `sabab:${s.kod}`, label: s.nomi })),
    ...f.qoshimchaKategoriyalar.map((k) => ({ value: `kat:${k.id}`, label: k.nomi })),
  ];
  const sababQiymati = f.forma.sababKod
    ? `sabab:${f.forma.sababKod}`
    : f.forma.categoryId
      ? `kat:${f.forma.categoryId}`
      : "";

  return (
    <Modal
      open={ochiq}
      onClose={onClose}
      title={tahrirAmalId ? "Pul harakatini tuzatish" : kirim ? "+ Pul oldim" : "− Pul berdim"}
    >
      <div className="space-y-4">
        <ShaxsTanlash
          yonalish={f.forma.yonalish}
          qiymat={f.forma.shaxs}
          onChange={f.shaxsniOzgart}
          disabled={yuborilmoqda}
        />

        <PulMaydonlari
          forma={f.forma}
          ozgart={f.ozgart}
          summa={f.summa}
          sababVariantlari={sababVariantlari}
          sababQiymati={sababQiymati}
          kassalar={kassalar}
          disabled={yuborilmoqda}
        />

        {/* Qarz paneli summa maydonidan KEYIN emas, yuborish tugmasidan
            OLDIN: foydalanuvchi summani yozib bo'lgach "to'lovdan keyin
            qancha qoladi" ni ko'rib tasdiqlaydi (10-talab). */}
        {f.qarzgaBogliq && f.forma.shaxs.ism.trim() && (
          <QarzKorinish
            ism={f.forma.shaxs.ism}
            hozirgi={f.qarz}
            tolanmoqda={f.summa}
            yuklanmoqda={f.qarzYuklanmoqda}
          />
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <Button
          variant={kirim ? "primary" : "danger"}
          size="lg"
          className="w-full"
          loading={yuborilmoqda}
          disabled={Boolean(f.xato)}
          onClick={saqla}
        >
          {tahrirAmalId ? "Saqlash" : kirim ? "KIRIM QILISH" : "CHIQIM QILISH"}
        </Button>
      </div>
    </Modal>
  );
}
