"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { soro } from "./soro";
import { BIZNES_TURLARI, type BiznesTuri } from "@/lib/biznesTuri";

interface Tarif {
  code: string;
  nomi: string;
}

/**
 * Yangi mijoz (kompaniya) ochish.
 *
 * Parol javobda QAYTARILMAYDI va auditga yozilmaydi — superadmin uni shu
 * formaning o'zida kiritadi va mijozga o'zi yetkazadi.
 */
export function YangiMijoz({ tariflar }: { tariflar: Tarif[] }) {
  const router = useRouter();
  const [ochiq, setOchiq] = useState(false);
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [natija, setNatija] = useState<string | null>(null);
  const [f, setF] = useState({
    nom: "",
    login: "",
    parol: "",
    ism: "",
    tarif: tariflar[0]?.code ?? "STANDARD",
    turi: "umumiy" as BiznesTuri,
    kunlar: 0,
  });

  const maydon =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

  async function yubor(e: FormEvent) {
    e.preventDefault();
    setBand(true);
    setXato(null);
    const javob = await soro<{ nom: string; login: string }>("/api/superadmin/tenants", {
      body: { ...f, ism: f.ism || null, kunlar: Number(f.kunlar) },
    });
    setBand(false);
    if (!javob.ok) {
      setXato(javob.xato);
      return;
    }
    setNatija(`"${javob.malumot?.nom}" yaratildi. Login: ${javob.malumot?.login}`);
    router.refresh();
  }

  function yop() {
    setOchiq(false);
    setNatija(null);
    setXato(null);
    setF({ ...f, nom: "", login: "", parol: "", ism: "" });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOchiq(true)}>
        Yangi mijoz
      </Button>
      <Modal open={ochiq} onClose={yop} title="Yangi mijoz ochish">
        {natija ? (
          <div className="space-y-4">
            <p className="text-sm text-income-fg">{natija}</p>
            <p className="text-2xs text-muted">
              Parol bu yerda ko&apos;rsatilmaydi — siz kiritgan parolni mijozga yetkazing.
            </p>
            <Button variant="secondary" onClick={yop}>
              Yopish
            </Button>
          </div>
        ) : (
          <form onSubmit={yubor} className="space-y-3">
            <div>
              <label htmlFor="ym-nom" className="block text-sm font-medium text-fg mb-1">
                Kompaniya nomi *
              </label>
              <input id="ym-nom" required minLength={2} className={maydon} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ym-login" className="block text-sm font-medium text-fg mb-1">
                  Direktor logini *
                </label>
                <input id="ym-login" required minLength={3} className={maydon} value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} />
              </div>
              <div>
                <label htmlFor="ym-parol" className="block text-sm font-medium text-fg mb-1">
                  Parol *
                </label>
                <input id="ym-parol" required minLength={8} type="text" className={maydon} value={f.parol} onChange={(e) => setF({ ...f, parol: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="ym-ism" className="block text-sm font-medium text-fg mb-1">
                Direktor ismi
              </label>
              <input id="ym-ism" className={maydon} value={f.ism} onChange={(e) => setF({ ...f, ism: e.target.value })} placeholder="Bo'sh qoldirilsa kompaniya nomi ishlatiladi" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="ym-tarif" className="block text-sm font-medium text-fg mb-1">
                  Tarif
                </label>
                <Select
                  id="ym-tarif"
                  value={f.tarif}
                  onChange={(v) => setF({ ...f, tarif: v })}
                  options={tariflar.map((t) => ({ value: t.code, label: t.nomi }))}
                />
              </div>
              <div>
                <label htmlFor="ym-turi" className="block text-sm font-medium text-fg mb-1">
                  Biznes turi
                </label>
                <Select
                  id="ym-turi"
                  value={f.turi}
                  onChange={(v) => setF({ ...f, turi: v as BiznesTuri })}
                  options={BIZNES_TURLARI.map((t) => ({
                    value: t.code,
                    label: t.nomi,
                    tavsif: t.tavsif,
                  }))}
                />
              </div>
              <div>
                <label htmlFor="ym-kunlar" className="block text-sm font-medium text-fg mb-1">
                  Obuna (kun)
                </label>
                <input id="ym-kunlar" type="number" min={0} max={366} className={maydon} value={f.kunlar} onChange={(e) => setF({ ...f, kunlar: Number(e.target.value) })} />
              </div>
            </div>
            <p className="text-2xs text-muted">0 kun — mijoz 14 kunlik bepul sinovda qoladi.</p>
            {xato && (
              <p className="text-sm text-expense-fg bg-expense-soft rounded-lg px-3 py-2" role="alert">
                {xato}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={yop} disabled={band}>
                Bekor qilish
              </Button>
              <Button type="submit" loading={band}>
                Yaratish
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
