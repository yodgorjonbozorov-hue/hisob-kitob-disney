"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface KategoriyaSatri {
  id: string;
  nomi: string;
  soni: number;
}
interface Royxat {
  kategoriyalar: KategoriyaSatri[];
  kategoriyasiz: number;
  jami: number;
}
interface Hisob {
  ochiriladi: number;
  nofaolBoladi: number;
  qoladi: number;
}

/**
 * KATALOGNI TOZALASH — QOLADIGAN kategoriyalar belgilanadi, qolgan tovarlar
 * o'chiriladi. Ikki bosqichli: avval server aniq hisobni qaytaradi (nechta
 * o'chadi, nechtasi tarixi borligi uchun nofaol bo'ladi), foydalanuvchi
 * ko'rib tasdiqlagandagina o'chirish ketadi.
 */
export function KatalogTozalashModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [royxat, setRoyxat] = useState<Royxat | null>(null);
  const [tanlangan, setTanlangan] = useState<Set<string>>(new Set());
  const [kategoriyasizSaqla, setKategoriyasizSaqla] = useState(false);
  const [hisob, setHisob] = useState<Hisob | null>(null);
  const [natija, setNatija] = useState<Hisob | null>(null);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  useEffect(() => {
    let bekor = false;
    fetch("/api/products/tozalash")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Ro'yxat olinmadi"))))
      .then((d) => !bekor && setRoyxat(d))
      .catch(() => !bekor && setXato("Kategoriyalar ro'yxatini olib bo'lmadi"));
    return () => {
      bekor = true;
    };
  }, []);

  function belgila(id: string) {
    setHisob(null);
    setTanlangan((t) => {
      const yangi = new Set(t);
      if (yangi.has(id)) yangi.delete(id);
      else yangi.add(id);
      return yangi;
    });
  }

  async function sorov(tekshirish: boolean): Promise<Hisob | null> {
    setXato(null);
    setLoading(true);
    try {
      const res = await fetch("/api/products/tozalash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saqlanadiganKategoriyalar: [...tanlangan],
          kategoriyasizSaqlansin: kategoriyasizSaqla,
          tekshirish: tekshirish || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setXato(typeof data.error === "string" ? data.error : `Server xatosi (${res.status})`);
        return null;
      }
      return data as Hisob;
    } catch {
      setXato("Serverga ulanib bo'lmadi");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function korish() {
    const h = await sorov(true);
    if (h) setHisob(h);
  }

  async function tasdiqla() {
    const n = await sorov(false);
    if (n) {
      setNatija(n);
      onDone();
    }
  }

  if (natija) {
    return (
      <Modal open onClose={onClose} title="Katalog tozalandi">
        <div className="space-y-3">
          <p className="text-fg">
            O&apos;chirildi: <span className="font-semibold">{natija.ochiriladi}</span> ta tovar
          </p>
          {natija.nofaolBoladi > 0 && (
            <p className="text-muted text-sm">
              {natija.nofaolBoladi} ta tovar sotuv/kirim tarixi borligi uchun o&apos;chirilmadi —
              nofaol qilindi (hisobotlar buzilmaydi).
            </p>
          )}
          <p className="text-muted text-sm">Katalogda {natija.qoladi} ta tovar qoldi.</p>
          <Button onClick={onClose}>Yopish</Button>
        </div>
      </Modal>
    );
  }

  const belgilanganSoni =
    (royxat?.kategoriyalar ?? [])
      .filter((k) => tanlangan.has(k.id))
      .reduce((s, k) => s + k.soni, 0) + (kategoriyasizSaqla ? (royxat?.kategoriyasiz ?? 0) : 0);

  return (
    <Modal open onClose={onClose} title="Katalogni tozalash">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          QOLADIGAN kategoriyalarni belgilang — qolgan barcha tovarlar o&apos;chiriladi.
          Sotuv yoki kirim tarixi bor tovar o&apos;chirilmaydi, nofaol bo&apos;ladi.
        </p>

        {!royxat && !xato && <p className="text-sm text-muted">Yuklanmoqda…</p>}

        {royxat && (
          <div className="max-h-64 overflow-y-auto space-y-1 border border-line rounded-xl p-2">
            {royxat.kategoriyalar.map((k) => (
              <label
                key={k.id}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={tanlangan.has(k.id)}
                  onChange={() => belgila(k.id)}
                  className="w-4 h-4 accent-[var(--brand)]"
                />
                <span className="text-sm text-fg flex-1">{k.nomi}</span>
                <span className="text-2xs text-faint tnum">{k.soni} ta</span>
              </label>
            ))}
            {royxat.kategoriyasiz > 0 && (
              <label className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-2 cursor-pointer border-t border-line">
                <input
                  type="checkbox"
                  checked={kategoriyasizSaqla}
                  onChange={() => {
                    setHisob(null);
                    setKategoriyasizSaqla((v) => !v);
                  }}
                  className="w-4 h-4 accent-[var(--brand)]"
                />
                <span className="text-sm text-fg flex-1">Kategoriyasiz tovarlar</span>
                <span className="text-2xs text-faint tnum">{royxat.kategoriyasiz} ta</span>
              </label>
            )}
          </div>
        )}

        {royxat && (tanlangan.size > 0 || kategoriyasizSaqla) && !hisob && (
          <p className="text-sm text-fg">
            Qoladi: <span className="font-semibold">{belgilanganSoni}</span> ta ·
            o&apos;chirish nomzodi: {royxat.jami - belgilanganSoni} ta
          </p>
        )}

        {hisob && (
          <div className="text-sm space-y-1 bg-expense-soft border border-expense/40 rounded-lg px-3 py-2">
            <p className="text-expense-fg font-medium">
              {hisob.ochiriladi} ta tovar BUTUNLAY o&apos;chiriladi
              {hisob.nofaolBoladi > 0 && `, ${hisob.nofaolBoladi} ta nofaol bo'ladi`}.
            </p>
            <p className="text-expense-fg">Qoladi: {hisob.qoladi} ta. Bu amalni qaytarib bo&apos;lmaydi!</p>
          </div>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          {!hisob ? (
            <Button
              onClick={korish}
              loading={loading}
              disabled={!royxat || (tanlangan.size === 0 && !kategoriyasizSaqla)}
            >
              Ko&apos;rib chiqish
            </Button>
          ) : (
            <Button variant="danger" onClick={tasdiqla} loading={loading}>
              Ha, {hisob.ochiriladi + hisob.nofaolBoladi} ta tovar olib tashlansin
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
