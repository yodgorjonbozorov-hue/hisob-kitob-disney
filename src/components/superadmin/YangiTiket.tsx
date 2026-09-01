"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { soro } from "./soro";

const MAYDON =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

interface TenantVariant {
  id: string;
  name: string;
}

/**
 * Yangi support tiketi.
 *
 * Kompaniya ro'yxati QIDIRUV orqali yuklanadi: platformada minglab kompaniya
 * bo'lishi mumkin, hammasini `select` ga tiqish sahifani cho'ktirardi.
 */
export function YangiTiket() {
  const router = useRouter();
  const [ochiq, setOchiq] = useState(false);
  const [qidiruv, setQidiruv] = useState("");
  const [variantlar, setVariantlar] = useState<TenantVariant[]>([]);
  const [tenant, setTenant] = useState<TenantVariant | null>(null);
  const [f, setF] = useState({ mavzu: "", tavsif: "", muhimlik: "ORTA" });
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  useEffect(() => {
    const q = qidiruv.trim();
    if (q.length < 2) {
      setVariantlar([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/superadmin/bizneslar?qidiruv=${encodeURIComponent(q)}&limit=8`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { qatorlar: { id: string; name: string }[] };
          setVariantlar(data.qatorlar.map((x) => ({ id: x.id, name: x.name })));
        }
      } catch {
        // bekor qilingan so'rov
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [qidiruv]);

  async function yubor(e: FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setBand(true);
    setXato(null);
    const javob = await soro<{ id: string }>("/api/superadmin/support", {
      body: { tenantId: tenant.id, ...f },
    });
    setBand(false);
    if (!javob.ok) {
      setXato(javob.xato);
      return;
    }
    setOchiq(false);
    setTenant(null);
    setQidiruv("");
    setF({ mavzu: "", tavsif: "", muhimlik: "ORTA" });
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={() => setOchiq(true)}>
        Yangi tiket
      </Button>
      <Modal open={ochiq} onClose={() => !band && setOchiq(false)} title="Yangi support tiketi">
        <form onSubmit={yubor} className="space-y-3">
          <div>
            <label htmlFor="tk-tenant" className="block text-sm font-medium text-fg mb-1">
              Kompaniya *
            </label>
            {tenant ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-fg flex-1">{tenant.name}</span>
                <button
                  type="button"
                  onClick={() => setTenant(null)}
                  className="text-2xs text-brand underline"
                >
                  o&apos;zgartirish
                </button>
              </div>
            ) : (
              <>
                <input
                  id="tk-tenant"
                  className={MAYDON}
                  value={qidiruv}
                  onChange={(e) => setQidiruv(e.target.value)}
                  placeholder="Kompaniya nomini yozing (kamida 2 belgi)"
                />
                {variantlar.length > 0 && (
                  <ul className="mt-1 border border-line rounded-lg divide-y divide-line max-h-40 overflow-y-auto">
                    {variantlar.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setTenant(v)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2"
                        >
                          {v.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label htmlFor="tk-mavzu" className="block text-sm font-medium text-fg mb-1">
              Mavzu *
            </label>
            <input
              id="tk-mavzu"
              required
              minLength={3}
              className={MAYDON}
              value={f.mavzu}
              onChange={(e) => setF({ ...f, mavzu: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="tk-tavsif" className="block text-sm font-medium text-fg mb-1">
              Tavsif *
            </label>
            <textarea
              id="tk-tavsif"
              required
              minLength={3}
              rows={4}
              className={MAYDON}
              value={f.tavsif}
              onChange={(e) => setF({ ...f, tavsif: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="tk-muhimlik" className="block text-sm font-medium text-fg mb-1">
              Muhimlik
            </label>
            <Select
              id="tk-muhimlik"
              value={f.muhimlik}
              onChange={(v) => setF({ ...f, muhimlik: v })}
              options={[
                { value: "PAST", label: "Past" },
                { value: "ORTA", label: "O'rta" },
                { value: "YUQORI", label: "Yuqori" },
                { value: "KRITIK", label: "Kritik" },
              ]}
            />
          </div>

          {xato && (
            <p className="text-sm text-expense-fg bg-expense-soft rounded-lg px-3 py-2" role="alert">
              {xato}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOchiq(false)} disabled={band}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={band} disabled={!tenant}>
              Yaratish
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
