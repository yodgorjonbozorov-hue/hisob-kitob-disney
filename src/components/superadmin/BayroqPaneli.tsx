"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Belgi } from "./belgilar";
import { soro } from "./soro";

export interface BayroqQator {
  id: string;
  kalit: string;
  nomi: string;
  tavsif: string | null;
  doira: string;
  yoqilgan: boolean;
  tenantSoni: number;
}

const MAYDON =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

/**
 * FEATURE FLAG BOSHQARUVI (talab 31).
 *
 * Bayroq mahsulot xatti-harakatini o'zgartiradi, shuning uchun u IMTIYOZLI
 * amal: har almashtirish sabab bilan auditga tushadi.
 */
export function BayroqPaneli({
  bayroqlar,
  ozgartirishMumkin,
}: {
  bayroqlar: BayroqQator[];
  ozgartirishMumkin: boolean;
}) {
  const router = useRouter();
  const [almashtirilayotgan, setAlmashtirilayotgan] = useState<BayroqQator | null>(null);
  const [yangiOchiq, setYangiOchiq] = useState(false);
  const [sabab, setSabab] = useState("");
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [yangi, setYangi] = useState({ kalit: "", nomi: "", tavsif: "", doira: "GLOBAL" });

  async function almashtir(b: BayroqQator) {
    setBand(true);
    setXato(null);
    const javob = await soro(`/api/superadmin/bayroqlar/${b.id}`, {
      method: "PATCH",
      body: { yoqilgan: !b.yoqilgan, sabab: sabab.trim() },
    });
    setBand(false);
    if (!javob.ok) {
      setXato(javob.xato);
      return;
    }
    setAlmashtirilayotgan(null);
    setSabab("");
    router.refresh();
  }

  async function yarat(e: FormEvent) {
    e.preventDefault();
    setBand(true);
    setXato(null);
    const javob = await soro("/api/superadmin/bayroqlar", {
      body: { ...yangi, yoqilgan: false, tenantIdlar: [], sabab: sabab.trim() },
    });
    setBand(false);
    if (!javob.ok) {
      setXato(javob.xato);
      return;
    }
    setYangiOchiq(false);
    setYangi({ kalit: "", nomi: "", tavsif: "", doira: "GLOBAL" });
    setSabab("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {bayroqlar.length === 0 && (
        <p className="text-sm text-muted">Hozircha bayroq yo&apos;q.</p>
      )}

      {bayroqlar.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-medium text-fg font-mono">{b.kalit}</p>
            <p className="text-2xs text-muted">{b.nomi}</p>
            {b.tavsif && <p className="text-2xs text-faint mt-0.5">{b.tavsif}</p>}
          </div>
          <Belgi ton="neytral">
            {b.doira === "GLOBAL" ? "global" : `${b.tenantSoni} kompaniya`}
          </Belgi>
          <Belgi ton={b.yoqilgan ? "muvaffaqiyat" : "neytral"}>
            {b.yoqilgan ? "YOQIQ" : "O'CHIQ"}
          </Belgi>
          {ozgartirishMumkin && (
            <Button size="sm" variant="secondary" onClick={() => setAlmashtirilayotgan(b)}>
              {b.yoqilgan ? "O'chirish" : "Yoqish"}
            </Button>
          )}
        </div>
      ))}

      {ozgartirishMumkin && (
        <Button size="sm" variant="secondary" onClick={() => setYangiOchiq(true)}>
          Yangi bayroq
        </Button>
      )}

      <Modal
        open={!!almashtirilayotgan}
        onClose={() => !band && setAlmashtirilayotgan(null)}
        title={almashtirilayotgan ? `${almashtirilayotgan.kalit}` : ""}
      >
        {almashtirilayotgan && (
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-2 border border-line p-3 text-sm text-fg">
              <p className="text-2xs uppercase tracking-wide text-faint font-medium mb-1.5">
                Nima bo&apos;ladi
              </p>
              <ul className="space-y-1">
                <li>
                  · Bayroq {almashtirilayotgan.yoqilgan ? "O'CHIRILADI" : "YOQILADI"} —{" "}
                  {almashtirilayotgan.doira === "GLOBAL"
                    ? "barcha kompaniyalarga"
                    : `${almashtirilayotgan.tenantSoni} ta kompaniyaga`}{" "}
                  ta&apos;sir qiladi.
                </li>
                <li>· O&apos;zgarish sabab bilan audit jurnaliga yoziladi.</li>
              </ul>
            </div>
            <div>
              <label htmlFor="bayroq-sabab" className="block text-sm font-medium text-fg mb-1">
                Sabab <span className="text-expense">*</span>
              </label>
              <textarea
                id="bayroq-sabab"
                rows={2}
                minLength={10}
                value={sabab}
                onChange={(e) => setSabab(e.target.value)}
                className={MAYDON}
              />
            </div>
            {xato && (
              <p className="text-sm text-expense-fg bg-expense-soft rounded-lg px-3 py-2" role="alert">
                {xato}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAlmashtirilayotgan(null)} disabled={band}>
                Bekor qilish
              </Button>
              <Button
                onClick={() => almashtir(almashtirilayotgan)}
                loading={band}
                disabled={sabab.trim().length < 10}
              >
                Tasdiqlash
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={yangiOchiq} onClose={() => !band && setYangiOchiq(false)} title="Yangi feature flag">
        <form onSubmit={yarat} className="space-y-3">
          <div>
            <label htmlFor="bq-kalit" className="block text-sm font-medium text-fg mb-1">
              Kalit * <span className="text-2xs text-faint">(KATTA_HARF_VA_PASTKI_CHIZIQ)</span>
            </label>
            <input
              id="bq-kalit"
              required
              pattern="[A-Z0-9_]+"
              className={`${MAYDON} font-mono`}
              value={yangi.kalit}
              onChange={(e) => setYangi({ ...yangi, kalit: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label htmlFor="bq-nomi" className="block text-sm font-medium text-fg mb-1">
              Nomi *
            </label>
            <input
              id="bq-nomi"
              required
              className={MAYDON}
              value={yangi.nomi}
              onChange={(e) => setYangi({ ...yangi, nomi: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="bq-doira" className="block text-sm font-medium text-fg mb-1">
              Doira
            </label>
            <Select
              id="bq-doira"
              value={yangi.doira}
              onChange={(v) => setYangi({ ...yangi, doira: v })}
              options={[
                { value: "GLOBAL", label: "Global — barcha kompaniyalar" },
                { value: "TENANT", label: "Tanlangan kompaniyalar" },
              ]}
            />
          </div>
          <div>
            <label htmlFor="bq-sabab" className="block text-sm font-medium text-fg mb-1">
              Sabab <span className="text-expense">*</span>
            </label>
            <textarea
              id="bq-sabab"
              rows={2}
              minLength={10}
              value={sabab}
              onChange={(e) => setSabab(e.target.value)}
              className={MAYDON}
            />
          </div>
          <p className="text-2xs text-muted">
            Bayroq O&apos;CHIQ holatda yaratiladi — yoqish alohida qadam.
          </p>
          {xato && (
            <p className="text-sm text-expense-fg bg-expense-soft rounded-lg px-3 py-2" role="alert">
              {xato}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setYangiOchiq(false)} disabled={band}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={band} disabled={sabab.trim().length < 10}>
              Yaratish
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
