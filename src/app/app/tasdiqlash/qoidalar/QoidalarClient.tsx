"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Money } from "@/components/ui/Money";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROL_LABEL, type Rol } from "@/lib/auth/roles";
import { TASDIQLOVCHI_ROLLAR } from "@/lib/validation/approval";
import type { RuleDTO } from "@/lib/queries/approval";

interface KategoriyaOption {
  id: string;
  nomi: string;
}

export function QoidalarClient({
  qoidalar,
  kategoriyalar,
}: {
  qoidalar: RuleDTO[];
  kategoriyalar: KategoriyaOption[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<RuleDTO | "yangi" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModal("yangi")}>Yangi qoida</Button>
      </div>

      <Card>
        {qoidalar.length === 0 ? (
          <EmptyState
            icon="⚖️"
            title="Hali qoida yo'q"
            description="Qoida qo'yilmaguncha barcha chiqim odatdagidek darhol yoziladi."
            action={<Button onClick={() => setModal("yangi")}>Birinchi qoida</Button>}
          />
        ) : (
          <div className="jadval-siljish">
            <table className="w-full text-sm min-w-[32rem]">
              <thead>
                <tr className="text-left text-faint text-xs uppercase">
                  <th className="pb-2">Qamrov</th>
                  <th className="pb-2 text-right">Chegara</th>
                  <th className="pb-2">Tasdiqlovchi</th>
                  <th className="pb-2 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {qoidalar.map((q) => (
                  <tr key={q.id} className={q.isActive ? "" : "opacity-50"}>
                    <td className="py-2.5 font-medium">
                      {q.kategoriyaNomi ?? "Barcha chiqimlar"}
                      {q.izoh && <span className="block text-2xs text-faint">{q.izoh}</span>}
                      {!q.isActive && <span className="block text-2xs text-faint">Nofaol</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      <Money value={q.chegara} size="sm" tone="neutral" />
                    </td>
                    <td className="py-2.5">{ROL_LABEL[q.tasdiqlovchiRol as Rol] ?? q.tasdiqlovchiRol}</td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setModal(q)}
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

      <p className="text-2xs text-faint">
        Chegaradan KATTA summa tasdiq talab qiladi. O&apos;z darajasi tasdiqlovchi darajasidan
        past bo&apos;lmagan xodim (masalan direktor) uchun qoida qo&apos;llanmaydi.
      </p>

      {modal && (
        <QoidaModal
          qoida={modal === "yangi" ? null : modal}
          kategoriyalar={kategoriyalar}
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

function QoidaModal({
  qoida,
  kategoriyalar,
  onClose,
  onDone,
}: {
  qoida: RuleDTO | null;
  kategoriyalar: KategoriyaOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const tahrir = qoida !== null;
  const [categoryId, setCategoryId] = useState(qoida?.categoryId ?? "");
  const [chegara, setChegara] = useState(qoida ? String(qoida.chegara) : "");
  const [tasdiqlovchiRol, setTasdiqlovchiRol] = useState(qoida?.tasdiqlovchiRol ?? "OWNER");
  const [izoh, setIzoh] = useState(qoida?.izoh ?? "");
  const [isActive, setIsActive] = useState(qoida?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const son = Number(chegara);
    if (!Number.isInteger(son) || son <= 0) {
      setXato("Chegara musbat butun son bo'lishi kerak");
      return;
    }
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(
        tahrir ? `/api/tasdiqlash/qoidalar/${qoida!.id}` : "/api/tasdiqlash/qoidalar",
        {
          method: tahrir ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: categoryId || null,
            chegara: son,
            tasdiqlovchiRol,
            izoh: izoh.trim() || null,
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
      const res = await fetch(`/api/tasdiqlash/qoidalar/${qoida!.id}`, { method: "DELETE" });
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
    <Modal open onClose={onClose} title={tahrir ? "Qoidani tahrirlash" : "Yangi tasdiq qoidasi"}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="q-kat">
            Qamrov
          </label>
          <Select
            id="q-kat"
            value={categoryId}
            onChange={setCategoryId}
            searchable={kategoriyalar.length > 7}
            options={[
              { value: "", label: "Barcha chiqim kategoriyalari" },
              ...kategoriyalar.map((k) => ({ value: k.id, label: k.nomi })),
            ]}
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="q-chegara">
            Chegara (so&apos;m)
          </label>
          <input
            id="q-chegara"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={chegara}
            onChange={(e) => setChegara(e.target.value)}
            required
            className={input}
          />
          <p className="text-2xs text-faint mt-1">Shu summadan KATTA chiqim tasdiq talab qiladi.</p>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="q-rol">
            Kim tasdiqlaydi
          </label>
          <Select
            id="q-rol"
            value={tasdiqlovchiRol}
            onChange={setTasdiqlovchiRol}
            options={TASDIQLOVCHI_ROLLAR.map((r) => ({ value: r, label: ROL_LABEL[r] }))}
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="q-izoh">
            Izoh
          </label>
          <input
            id="q-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={300}
            className={input}
          />
        </div>

        {tahrir && (
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4"
            />
            Faol (o&apos;chirilsa chiqimlar tasdiqsiz o&apos;tadi)
          </label>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            {tahrir ? "Saqlash" : "Qo'shish"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          {tahrir && (
            <Button variant="ghost" onClick={ochirish} disabled={loading}>
              O&apos;chirish
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
