"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Money } from "@/components/ui/Money";
import { todayTashkentDateOnlyString } from "@/lib/date";
import type { SupplierDTO } from "@/lib/queries/xarid";
import type { ProductAdminDTO } from "@/lib/queries/inventory";

interface Satr {
  productId: string;
  miqdor: string;
  birlikNarx: string;
}

/** Bo'sh satr — yangi qator qo'shilganda shu qiymatlar bilan boshlanadi. */
function bosqSatr(products: ProductAdminDTO[]): Satr {
  const p = products[0];
  return {
    productId: p?.id ?? "",
    // Tannarx allaqachon ma'lum bo'lsa — oldingi kelgan narx taklif qilinadi.
    birlikNarx: p ? String(p.kelganNarx || "") : "",
    miqdor: "1",
  };
}

export function BuyurtmaModal({
  suppliers,
  products,
  onClose,
  onDone,
}: {
  suppliers: SupplierDTO[];
  products: ProductAdminDTO[];
  onClose: () => void;
  onDone: () => void;
}) {
  const faolMahsulotlar = products.filter((p) => p.isActive);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [sana, setSana] = useState(todayTashkentDateOnlyString());
  const [tolovTuri, setTolovTuri] = useState<"naqd" | "qarz">("naqd");
  const [izoh, setIzoh] = useState("");
  const [satrlar, setSatrlar] = useState<Satr[]>([bosqSatr(faolMahsulotlar)]);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  function satrOzgart(i: number, patch: Partial<Satr>) {
    setSatrlar((oldingi) =>
      oldingi.map((s, idx) => {
        if (idx !== i) return s;
        const yangi = { ...s, ...patch };
        // Mahsulot almashtirilsa narx o'sha mahsulotning kelgan narxiga tushadi.
        if (patch.productId !== undefined) {
          const p = faolMahsulotlar.find((x) => x.id === patch.productId);
          yangi.birlikNarx = p ? String(p.kelganNarx || "") : "";
        }
        return yangi;
      })
    );
  }

  function satrQosh() {
    setSatrlar((oldingi) => [...oldingi, bosqSatr(faolMahsulotlar)]);
  }

  function satrOchir(i: number) {
    setSatrlar((oldingi) => (oldingi.length === 1 ? oldingi : oldingi.filter((_, idx) => idx !== i)));
  }

  const jamiSumma = satrlar.reduce(
    (a, s) => a + (Number(s.miqdor) || 0) * (Number(s.birlikNarx) || 0),
    0
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setXato(null);

    const tayyor = satrlar.map((s) => ({
      productId: s.productId,
      miqdor: Number(s.miqdor),
      birlikNarx: Number(s.birlikNarx),
    }));
    if (tayyor.some((s) => !s.productId)) {
      setXato("Har satrda mahsulot tanlanishi kerak");
      return;
    }
    if (tayyor.some((s) => !Number.isInteger(s.miqdor) || s.miqdor <= 0)) {
      setXato("Miqdor musbat butun son bo'lishi kerak");
      return;
    }
    if (tayyor.some((s) => !Number.isInteger(s.birlikNarx) || s.birlikNarx < 0)) {
      setXato("Narx butun son (so'm) bo'lishi kerak");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/xarid/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          sana,
          tolovTuri,
          izoh: izoh.trim() || null,
          satrlar: tayyor,
        }),
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

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

  return (
    <Modal open onClose={onClose} title="Yangi xarid buyurtmasi">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="bm-supplier">
            Ta&apos;minotchi
          </label>
          <select
            id="bm-supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
            className={input}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nomi}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="bm-sana">
              Sana
            </label>
            <input
              id="bm-sana"
              type="date"
              value={sana}
              onChange={(e) => setSana(e.target.value)}
              required
              className={input}
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="bm-tolov">
              To&apos;lov turi
            </label>
            <select
              id="bm-tolov"
              value={tolovTuri}
              onChange={(e) => setTolovTuri(e.target.value as "naqd" | "qarz")}
              className={input}
            >
              <option value="naqd">Naqd (chiqim yoziladi)</option>
              <option value="qarz">Qarzga (ta&apos;minotchiga qarz)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted">Satrlar</p>
          {satrlar.map((s, i) => {
            const p = faolMahsulotlar.find((x) => x.id === s.productId);
            return (
              <div key={i} className="border border-line rounded-xl p-2 space-y-2">
                <select
                  value={s.productId}
                  onChange={(e) => satrOzgart(i, { productId: e.target.value })}
                  required
                  className={input}
                  aria-label="Mahsulot"
                >
                  {faolMahsulotlar.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nomi}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-2xs text-faint mb-1">
                      Miqdor {p ? `(${p.birlik})` : ""}
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={s.miqdor}
                      onChange={(e) => satrOzgart(i, { miqdor: e.target.value })}
                      required
                      className={input}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-2xs text-faint mb-1">Birlik narxi (so&apos;m)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={s.birlikNarx}
                      onChange={(e) => satrOzgart(i, { birlikNarx: e.target.value })}
                      required
                      className={input}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => satrOchir(i)}
                    disabled={satrlar.length === 1}
                    aria-label="Satrni o'chirish"
                  >
                    ✕
                  </Button>
                </div>
                <p className="text-2xs text-faint text-right tnum">
                  {((Number(s.miqdor) || 0) * (Number(s.birlikNarx) || 0)).toLocaleString("uz-UZ")} so&apos;m
                </p>
              </div>
            );
          })}
          <Button variant="secondary" size="sm" onClick={satrQosh}>
            + Satr qo&apos;shish
          </Button>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-2">
          <span className="text-sm text-muted">Jami</span>
          <Money value={jamiSumma} size="lg" tone="expense" />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="bm-izoh">
            Izoh
          </label>
          <input
            id="bm-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={500}
            className={input}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <p className="text-2xs text-faint">
          Buyurtma qoralama sifatida saqlanadi — ombor va pul yozuvlari faqat &laquo;Qabul
          qilish&raquo;da yoziladi.
        </p>

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading} disabled={!supplierId || faolMahsulotlar.length === 0}>
            Saqlash
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
