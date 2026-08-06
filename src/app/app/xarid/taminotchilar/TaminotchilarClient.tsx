"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import type { SupplierDTO } from "@/lib/queries/xarid";

export function TaminotchilarClient({ suppliers }: { suppliers: SupplierDTO[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<SupplierDTO | "yangi" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModal("yangi")}>Yangi ta&apos;minotchi</Button>
      </div>

      <Card>
        {suppliers.length === 0 ? (
          <EmptyState
            icon="🏭"
            title="Hali ta'minotchi yo'q"
            description="Tovarni kimdan olayotganingizni yozib qo'ying — keyin xarid buyurtmasi va hisob-kitob shu yerdan yuritiladi."
            action={<Button onClick={() => setModal("yangi")}>Birinchi ta&apos;minotchi</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-faint text-xs uppercase">
                  <th className="pb-2">Nomi</th>
                  <th className="pb-2">Telefon</th>
                  <th className="pb-2 text-right">Jami xarid</th>
                  <th className="pb-2 text-right">Ochiq buyurtma</th>
                  <th className="pb-2 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {suppliers.map((s) => (
                  <tr key={s.id} className={s.isActive ? "" : "opacity-50"}>
                    <td className="py-2.5 font-medium">
                      {s.nomi}
                      {s.manzil && <span className="block text-2xs text-faint">{s.manzil}</span>}
                    </td>
                    <td className="py-2.5">{s.tel ?? "—"}</td>
                    <td className="py-2.5 text-right">
                      <Money value={s.jamiXarid} size="sm" tone="neutral" />
                    </td>
                    <td className="py-2.5 text-right tnum">
                      {s.ochiqBuyurtma > 0 ? (
                        <span className="text-debt font-medium">{s.ochiqBuyurtma}</span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setModal(s)}
                        className="text-2xs text-brand hover:underline"
                      >
                        Tahrirlash
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && (
        <SupplierModal
          supplier={modal === "yangi" ? null : modal}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function SupplierModal({
  supplier,
  onClose,
  onDone,
}: {
  supplier: SupplierDTO | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const tahrir = supplier !== null;
  const [nomi, setNomi] = useState(supplier?.nomi ?? "");
  const [tel, setTel] = useState(supplier?.tel ?? "");
  const [manzil, setManzil] = useState(supplier?.manzil ?? "");
  const [izoh, setIzoh] = useState(supplier?.izoh ?? "");
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(
        tahrir ? `/api/xarid/suppliers/${supplier!.id}` : "/api/xarid/suppliers",
        {
          method: tahrir ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nomi,
            tel: tel || null,
            manzil: manzil || null,
            izoh: izoh || null,
            ...(tahrir ? { isActive } : {}),
          }),
        }
      );
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

  async function ochirish() {
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/xarid/suppliers/${supplier!.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "O'chirib bo'lmadi");
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
    <Modal open onClose={onClose} title={tahrir ? "Ta'minotchini tahrirlash" : "Yangi ta'minotchi"}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tm-nomi">
            Nomi
          </label>
          <input id="tm-nomi" value={nomi} onChange={(e) => setNomi(e.target.value)} required maxLength={120} className={input} />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tm-tel">
            Telefon
          </label>
          <input id="tm-tel" value={tel} onChange={(e) => setTel(e.target.value)} maxLength={50} className={input} />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tm-manzil">
            Manzil
          </label>
          <input id="tm-manzil" value={manzil} onChange={(e) => setManzil(e.target.value)} maxLength={200} className={input} />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tm-izoh">
            Izoh
          </label>
          <input id="tm-izoh" value={izoh} onChange={(e) => setIzoh(e.target.value)} maxLength={500} className={input} />
        </div>

        {tahrir && (
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
            Faol (yangi buyurtmalarda ko&apos;rinadi)
          </label>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            {tahrir ? "Saqlash" : "Qo'shish"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          {tahrir && (
            <Button type="button" variant="ghost" onClick={ochirish} disabled={loading}>
              O&apos;chirish
            </Button>
          )}
        </div>
        {tahrir && (
          <p className="text-2xs text-faint">
            O&apos;chirilgan ta&apos;minotchining buyurtmalar tarixi saqlanadi.
          </p>
        )}
      </form>
    </Modal>
  );
}
