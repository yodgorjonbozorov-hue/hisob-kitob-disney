"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { BusinessDTO } from "./turlar";

/**
 * BOSHLANG'ICH HOLATGA QAYTARISH — tasdiqlash oynasi.
 *
 * Qaytarib bo'lmaydigan amal, shuning uchun oddiy "Rostdanmi?" yetarli emas:
 * foydalanuvchi biznes nomini QO'LDA yozadi. Bu tasodifiy bosishni ham,
 * "noto'g'ri biznesni tanlab qo'yish"ni ham to'sadi.
 */
export function TozalashModal({
  biznes,
  onClose,
  onDone,
}: {
  biznes: BusinessDTO;
  onClose: () => void;
  onDone: (xabar: string) => void;
}) {
  const [nomi, setNomi] = useState("");
  const [kassalarniOchir, setKassalarniOchir] = useState(false);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const mos = nomi.trim() === biznes.nomi.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/businesses/${biznes.id}/tozalash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasdiqNomi: nomi.trim(), kassalarniOchir }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Tozalab bo'lmadi");
        return;
      }
      const ochirilgan =
        data.ochirilganKassalar?.length > 0
          ? `\nO'chirilgan kassalar: ${data.ochirilganKassalar.join(", ")}`
          : "";
      const yaratilgan =
        data.yaratilganKassalar?.length > 0
          ? `\nYangi shaxsiy kassalar: ${data.yaratilganKassalar.join(", ")}`
          : "";
      onDone(`${data.jami} ta yozuv o'chirildi, qoldiq 0${ochirilgan}${yaratilgan}`);
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

  return (
    <Modal open onClose={onClose} title="Boshlang'ich holatga qaytarish">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-expense/40 bg-expense-soft p-3 text-sm text-expense-fg">
          <p className="font-medium">Bu amalni qaytarib bo&apos;lmaydi.</p>
          <p className="mt-1 text-xs">
            O&apos;chadi: yozuvlar, pul o&apos;tkazmalari, sotuvlar, qarzlar, kunlik hisobotlar,
            smenalar va xaridlar. Barcha balans va hisobot 0 bo&apos;ladi.
          </p>
          <p className="mt-1 text-xs">
            Qoladi: kategoriyalar, mahsulotlar, mijozlar, xodimlar, foydalanuvchilar va audit
            jurnali.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={kassalarniOchir}
            onChange={(e) => setKassalarniOchir(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Umumiy kassalar ham o&apos;chirilsin
            <span className="block text-xs text-faint">
              Qo&apos;lda yaratilgan kassalar (&quot;Naqd kassa&quot; kabi) o&apos;chiriladi.
              Shaxsiy kassa hali yo&apos;q bo&apos;lsa, har faol xodimga avtomatik ochiladi va
              shaxsiy kassa rejimi yoqiladi — tartib bilan ovora bo&apos;lish shart emas.
            </span>
          </span>
        </label>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tz-nomi">
            Tasdiqlash uchun biznes nomini yozing:{" "}
            <span className="text-fg font-medium">{biznes.nomi}</span>
          </label>
          <input
            id="tz-nomi"
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            placeholder={biznes.nomi}
            className={input}
            autoFocus
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        {/* Tugma nima uchun bosilmasligini AYTIB turadi — o'chiq tugma
            sababsiz turganda foydalanuvchi uni "buzuq" deb o'ylaydi. */}
        {!mos && (
          <p className="text-2xs text-faint">
            {nomi.trim().length === 0
              ? "Tugma faollashishi uchun yuqoridagi maydonga biznes nomini qo'lda yozing."
              : "Nom mos kelmadi — aynan " + `"${biznes.nomi}"` + " deb yozing."}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={!mos} loading={loading}>
            Tozalash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
