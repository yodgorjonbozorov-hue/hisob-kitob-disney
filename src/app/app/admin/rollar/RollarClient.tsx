"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { huquqJsonParse, HUQUQLAR } from "@/lib/permissions/katalog";
import { RolModal, type RolDTO } from "./RolModal";

const BAZA_LABEL: Record<string, string> = {
  ADMIN: "Administrator kabi",
  CASHIER: "Kassir kabi",
  SELLER: "Sotuvchi kabi",
};

const HUQUQ_LABEL = new Map(HUQUQLAR.map((h) => [h.code, h.label]));

/**
 * MAXSUS ROLLAR SAHIFASI (PRO).
 *
 * Mijoz o'zi rol yaratadi: "Taminotchi", "Omborchi", "Haydovchi"... va unga
 * granular huquqlarni belgilaydi. Rollar keyin Foydalanuvchilar bo'limida
 * tayinlanadi.
 */
export function RollarClient({ pro, initialRoles }: { pro: boolean; initialRoles: RolDTO[] }) {
  const [roles, setRoles] = useState(initialRoles);
  const [modal, setModal] = useState<"yopiq" | "yangi" | RolDTO>("yopiq");

  if (!pro) {
    return (
      <Card>
        <div className="py-8 text-center space-y-2">
          <p className="text-fg font-medium">Maxsus rollar — PRO tarif imkoniyati</p>
          <p className="text-sm text-muted">
            Istalgan nomdagi rol (Taminotchi, Omborchi, Haydovchi...) yarating va unga aniq
            huquqlarni belgilang. Tarifni «Obuna va to'lov» bo'limida yangilang.
          </p>
          <a href="/billing" className="inline-block text-sm font-medium text-brand hover:underline">
            Obuna va to'lov →
          </a>
        </div>
      </Card>
    );
  }

  async function deleteRole(r: RolDTO) {
    if (!confirm(`"${r.nomi}" rolini o'chirasizmi?`)) return;
    const res = await fetch(`/api/rollar/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      setRoles((prev) => prev.filter((x) => x.id !== r.id));
    } else {
      alert((await res.json()).error ?? "O'chirib bo'lmadi");
    }
  }

  function saqlandi(r: RolDTO) {
    setRoles((prev) => {
      const bor = prev.some((x) => x.id === r.id);
      return bor ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r];
    });
    setModal("yopiq");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Rol yarating va unga huquqlar belgilang — keyin{" "}
          <a href="/app/admin/foydalanuvchilar" className="text-brand hover:underline">
            Foydalanuvchilar
          </a>{" "}
          bo'limida tayinlanadi.
        </p>
        <Button onClick={() => setModal("yangi")}>+ Yangi rol</Button>
      </div>

      {roles.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-muted">
            Hozircha maxsus rol yo'q. Masalan «Taminotchi» rolini yarating: mahsulot ko'rish,
            pul qabul qilish va omborni ko'rish huquqlari bilan.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => {
            const kodlar = huquqJsonParse(r.huquqlar);
            return (
              <Card key={r.id}>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-fg">{r.nomi}</p>
                      <p className="text-xs text-faint">{BAZA_LABEL[r.bazaRol] ?? r.bazaRol}</p>
                    </div>
                    <Badge tone={r.isActive ? "kirim" : "neutral"}>
                      {r.isActive ? "Faol" : "Nofaol"}
                    </Badge>
                  </div>
                  {r.izoh && <p className="text-xs text-muted">{r.izoh}</p>}
                  <p className="text-xs text-muted">
                    {r.userSoni} ta foydalanuvchi · {kodlar.length} ta huquq
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {kodlar.slice(0, 4).map((k) => (
                      <span key={k} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
                        {HUQUQ_LABEL.get(k) ?? k}
                      </span>
                    ))}
                    {kodlar.length > 4 && (
                      <span className="text-[11px] text-faint">+{kodlar.length - 4}</span>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      onClick={() => setModal(r)}
                      className="text-xs font-medium text-muted hover:text-brand"
                    >
                      Tahrirlash
                    </button>
                    <button
                      onClick={() => deleteRole(r)}
                      className="text-xs font-medium text-muted hover:text-expense"
                    >
                      O'chirish
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {modal !== "yopiq" && (
        <RolModal
          rol={modal === "yangi" ? null : modal}
          onClose={() => setModal("yopiq")}
          onSaved={saqlandi}
        />
      )}
    </div>
  );
}
