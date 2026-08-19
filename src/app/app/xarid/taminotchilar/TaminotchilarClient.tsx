"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { Jadval, type Ustun } from "@/components/ui/Jadval";
import type { SupplierDTO } from "@/lib/queries/xarid";

interface UserOption {
  id: string;
  ism: string;
}

export function TaminotchilarClient({
  suppliers,
  userlar,
}: {
  suppliers: SupplierDTO[];
  /** Ta'minotchini tizim useriga bog'lash (PRO) — bo'sh bo'lsa select ko'rinmaydi. */
  userlar: UserOption[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<SupplierDTO | "yangi" | null>(null);

  // Ustun ta'rifi BITTA — desktop jadval ham, mobil kartochka ham shundan.
  const ustunlar: Ustun<SupplierDTO>[] = [
    {
      kalit: "nomi",
      sarlavha: "Nomi",
      katak: (s) => (
        <span className={s.isActive ? "" : "opacity-50"}>
          {s.nomi}
          {s.manzil && <span className="block text-2xs text-faint font-normal">{s.manzil}</span>}
          {!s.isActive && <span className="block text-2xs text-faint font-normal">nofaol</span>}
        </span>
      ),
    },
    { kalit: "tel", sarlavha: "Telefon", katak: (s) => s.tel ?? "—" },
    {
      kalit: "xarid",
      sarlavha: "Jami xarid",
      raqam: true,
      katak: (s) => <Money value={s.jamiXarid} size="sm" tone="neutral" />,
    },
    {
      kalit: "buyurtma",
      sarlavha: "Ochiq buyurtma",
      raqam: true,
      katak: (s) =>
        s.ochiqBuyurtma > 0 ? (
          <span className="text-debt font-medium">{s.ochiqBuyurtma}</span>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModal("yangi")}>Yangi ta&apos;minotchi</Button>
      </div>

      <Card>
        <Jadval
          ustunlar={ustunlar}
          qatorlar={suppliers}
          kalit={(s) => s.id}
          amallar={(s) => [{ label: "Tahrirlash", onClick: () => setModal(s), tur: "asosiy" }]}
          bosh={
            <EmptyState
              icon="🏭"
              title="Hali ta'minotchi yo'q"
              description="Tovarni kimdan olayotganingizni yozib qo'ying — keyin xarid buyurtmasi va hisob-kitob shu yerdan yuritiladi."
              action={<Button onClick={() => setModal("yangi")}>Birinchi ta&apos;minotchi</Button>}
            />
          }
        />
      </Card>

      {modal && (
        <SupplierModal
          supplier={modal === "yangi" ? null : modal}
          userlar={userlar}
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
  userlar,
  onClose,
  onDone,
}: {
  supplier: SupplierDTO | null;
  userlar: UserOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const tahrir = supplier !== null;
  const [nomi, setNomi] = useState(supplier?.nomi ?? "");
  const [tel, setTel] = useState(supplier?.tel ?? "");
  const [manzil, setManzil] = useState(supplier?.manzil ?? "");
  const [izoh, setIzoh] = useState(supplier?.izoh ?? "");
  const [userId, setUserId] = useState(supplier?.userId ?? "");
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
            userId: userId || null,
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

        {userlar.length > 0 && (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="tm-user">
              Tizim foydalanuvchisi (PRO)
            </label>
            <select id="tm-user" value={userId} onChange={(e) => setUserId(e.target.value)} className={input}>
              <option value="">Bog&apos;lanmagan (tashqi ta&apos;minotchi)</option>
              {userlar.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.ism}
                </option>
              ))}
            </select>
            <p className="text-2xs text-faint mt-1">
              Bog&apos;lansa, xarid to&apos;lovlari chiqim o&apos;rniga shu foydalanuvchining shaxsiy
              kassasiga o&apos;tkazma bo&apos;lib tushadi.
            </p>
          </div>
        )}

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
