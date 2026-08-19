"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Belgi } from "../belgilar";
import { soro } from "../soro";
import { formatDate } from "@/lib/format";

export interface ModulQator {
  code: string;
  nomi: string;
  tavsif: string;
  core: boolean;
  yoqilgan: boolean;
  tarifdaBor: boolean;
  talablar: string[];
  tayanadiganlar: string[];
  createdAt: string | null;
  oxirgiOzgarish: { amal: string; kim: string | null; qachon: string; sabab: string | null } | null;
}

/**
 * MODUL BOSHQARUVI (talab 12/13).
 *
 * ENG MUHIM XABAR — modul o'chirilganda MA'LUMOT O'CHMAYDI. Bu shu yerda
 * ochiq yozilgan, chunki superadmin "o'chirsam ma'lumot yo'qoladimi?" degan
 * savol bilan qolmasligi kerak.
 *
 * Bog'liqlik xatosi serverdan kelgan tushuntirish bilan ko'rsatiladi
 * (masalan: "Xarid ishlashi uchun Ombor yoqilgan bo'lishi kerak").
 */
export function ModulPaneli({
  tenantId,
  modullar,
  ozgartirishMumkin,
}: {
  tenantId: string;
  modullar: ModulQator[];
  ozgartirishMumkin: boolean;
}) {
  const router = useRouter();
  const [tanlangan, setTanlangan] = useState<ModulQator | null>(null);
  const [sabab, setSabab] = useState("");
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function ozgartir(m: ModulQator, yoqish: boolean, sababMatni?: string) {
    setBand(true);
    setXato(null);
    const javob = await soro(`/api/superadmin/tenants/${tenantId}/modullar`, {
      body: { code: m.code, isActive: yoqish, sabab: sababMatni ?? null },
    });
    setBand(false);
    if (!javob.ok) {
      setXato(javob.xato);
      return;
    }
    setTanlangan(null);
    setSabab("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {xato && !tanlangan && (
        <p className="text-sm text-expense-fg bg-expense-soft rounded-lg px-3 py-2" role="alert">
          {xato}
        </p>
      )}

      {modullar.map((m) => (
        <div
          key={m.code}
          className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface p-3"
        >
          <div className="flex-1 min-w-[220px]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-fg">{m.nomi}</p>
              {m.core && <Belgi ton="info">asosiy</Belgi>}
              {!m.tarifdaBor && <Belgi ton="neytral">tarifda yo&apos;q</Belgi>}
              {m.talablar.length > 0 && (
                <Belgi ton="neytral">talab: {m.talablar.join(", ")}</Belgi>
              )}
            </div>
            <p className="text-2xs text-muted mt-0.5">{m.tavsif}</p>
            <p className="text-2xs text-faint mt-1">
              {m.createdAt ? `Birinchi yoqilgan: ${formatDate(new Date(m.createdAt))}` : "Hech qachon yoqilmagan"}
              {m.oxirgiOzgarish
                ? ` · Oxirgi o'zgarish: ${formatDate(new Date(m.oxirgiOzgarish.qachon))} — ${m.oxirgiOzgarish.kim ?? "—"}`
                : ""}
            </p>
            {m.oxirgiOzgarish?.sabab && (
              <p className="text-2xs text-muted mt-0.5">Sabab: {m.oxirgiOzgarish.sabab}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Belgi ton={m.yoqilgan ? "muvaffaqiyat" : "neytral"}>
              {m.yoqilgan ? "YOQIQ" : "O'CHIQ"}
            </Belgi>
            {ozgartirishMumkin && !m.core && (
              <Button
                size="sm"
                variant={m.yoqilgan ? "secondary" : "primary"}
                disabled={band || (!m.yoqilgan && !m.tarifdaBor)}
                onClick={() => {
                  if (m.yoqilgan) setTanlangan(m);
                  else void ozgartir(m, true);
                }}
              >
                {m.yoqilgan ? "O'chirish" : "Yoqish"}
              </Button>
            )}
          </div>
        </div>
      ))}

      <Modal
        open={!!tanlangan}
        onClose={() => !band && setTanlangan(null)}
        title={tanlangan ? `${tanlangan.nomi} modulini o'chirish` : ""}
      >
        {tanlangan && (
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-2 border border-line p-3 text-sm text-fg">
              <p className="text-2xs uppercase tracking-wide text-faint font-medium mb-1.5">
                Nima bo&apos;ladi
              </p>
              <ul className="space-y-1">
                <li>· Modul menyudan yo&apos;qoladi va uning API&apos;lari yopiladi.</li>
                <li>
                  · <strong>MA&apos;LUMOT O&apos;CHIRILMAYDI</strong> — modul qayta yoqilsa barcha
                  yozuvlar aynan qaytadi.
                </li>
                {tanlangan.tayanadiganlar.length > 0 && (
                  <li>
                    · Bu modulga tayanadigan modullar:{" "}
                    {tanlangan.tayanadiganlar.join(", ")} — ular yoqiq bo&apos;lsa server rad etadi.
                  </li>
                )}
              </ul>
            </div>
            <div>
              <label htmlFor="modul-sabab" className="block text-sm font-medium text-fg mb-1">
                Sabab <span className="text-expense">*</span>
              </label>
              <textarea
                id="modul-sabab"
                rows={2}
                minLength={10}
                value={sabab}
                onChange={(e) => setSabab(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              />
            </div>
            {xato && (
              <p className="text-sm text-expense-fg bg-expense-soft rounded-lg px-3 py-2" role="alert">
                {xato}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTanlangan(null)} disabled={band}>
                Bekor qilish
              </Button>
              <Button
                variant="danger"
                loading={band}
                disabled={sabab.trim().length < 10}
                onClick={() => ozgartir(tanlangan, false, sabab.trim())}
              >
                O&apos;chirish
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
