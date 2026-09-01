"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { soro } from "./soro";
import { SUPER_ROL_TAVSIF, type SuperRol } from "@/lib/superadmin/rbac";

/**
 * SUPERADMIN ROLINI TAYINLASH (talab 16/17) — faqat ROOT.
 *
 * Tanlangan rolning IMKONIYATI darhol tushuntiriladi: "SUPPORT nima qila
 * oladi?" degan savol tasdiqdan OLDIN javob topishi kerak.
 */
export function SuperadminRolTanlov({
  userId,
  ism,
  joriy,
  rollar,
}: {
  userId: string;
  ism: string;
  joriy: SuperRol;
  rollar: { kod: SuperRol; label: string }[];
}) {
  const router = useRouter();
  const [ochiq, setOchiq] = useState(false);
  const [rol, setRol] = useState<SuperRol>(joriy);
  const [sabab, setSabab] = useState("");
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const maydon =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

  async function yubor() {
    setBand(true);
    setXato(null);
    const javob = await soro(`/api/superadmin/users/${userId}/superadmin-rol`, {
      body: { superadminRol: rol, sabab: sabab.trim() },
    });
    setBand(false);
    if (!javob.ok) {
      setXato(javob.xato);
      return;
    }
    setOchiq(false);
    setSabab("");
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOchiq(true)}>
        Rolni o&apos;zgartirish
      </Button>
      <Modal open={ochiq} onClose={() => !band && setOchiq(false)} title={`${ism} — superadmin roli`}>
        <div className="space-y-3">
          <div>
            <label htmlFor="sa-rol" className="block text-sm font-medium text-fg mb-1">
              Yangi rol
            </label>
            <Select
              id="sa-rol"
              value={rol}
              onChange={(v) => setRol(v as SuperRol)}
              options={rollar.map((x) => ({ value: x.kod, label: x.label }))}
            />
            <p className="text-2xs text-muted mt-1">{SUPER_ROL_TAVSIF[rol]}</p>
          </div>

          <div className="rounded-lg bg-surface-2 border border-line p-3 text-sm text-fg">
            <p className="text-2xs uppercase tracking-wide text-faint font-medium mb-1.5">
              Nima bo&apos;ladi
            </p>
            <ul className="space-y-1">
              <li>· Huquqlar darhol yangi rolga o&apos;tadi.</li>
              <li>· Foydalanuvchining ochiq sessiyalari bekor qilinadi (qayta kirish kerak).</li>
              <li>· Oxirgi ROOT ni pasaytirib bo&apos;lmaydi — server rad etadi.</li>
            </ul>
          </div>

          <div>
            <label htmlFor="sa-rol-sabab" className="block text-sm font-medium text-fg mb-1">
              Sabab <span className="text-expense">*</span>
            </label>
            <textarea
              id="sa-rol-sabab"
              rows={2}
              minLength={10}
              value={sabab}
              onChange={(e) => setSabab(e.target.value)}
              className={maydon}
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
            <Button onClick={yubor} loading={band} disabled={sabab.trim().length < 10 || rol === joriy}>
              Tayinlash
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
