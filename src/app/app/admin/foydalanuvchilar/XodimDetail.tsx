"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatDateUZ, formatRelative } from "@/lib/format";
import { AmalMenu, type MenuAmali } from "./AmalMenu";
import type { XodimDTO } from "./turlar";

/**
 * XODIM TAFSILOTI — qator/kartochka bosilganda ochiladi.
 *
 * Desktopda markazdagi dialog, telefonda pastdan chiqadigan varaq (`Modal`
 * ikkalasini o'zi hal qiladi). Bu yerda faqat KO'RSATISH: har qanday
 * o'zgartirish "Tahrirlash" yoki "•••" orqali, ya'ni ataylab.
 */

function Qator({ nom, qiymat }: { nom: string; qiymat: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-line last:border-0">
      <dt className="text-sm text-muted shrink-0">{nom}</dt>
      <dd className="text-sm text-fg text-right min-w-0 break-words">{qiymat}</dd>
    </div>
  );
}

export function XodimDetail({
  xodim,
  amallar,
  onTahrir,
  onClose,
}: {
  xodim: XodimDTO;
  amallar: MenuAmali[];
  onTahrir: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={xodim.ism}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={xodim.isActive ? "kirim" : "neutral"}>
            <span aria-hidden>{xodim.isActive ? "🟢" : "⚪"}</span>{" "}
            {xodim.isActive ? "Faol" : "Nofaol"}
          </Badge>
          <Badge tone="info">{xodim.rolNomi}</Badge>
        </div>

        {!xodim.isActive && (
          <p className="text-xs text-muted rounded-lg bg-surface-2 px-3 py-2">
            Bu xodim tizimga kira olmaydi. Uning eski yozuvlari, qarzlari va kassa
            tarixi joyida turibdi — nomi hech qayerdan yo&apos;qolmagan.
          </p>
        )}

        <dl>
          <Qator nom="Login" qiymat={<span className="break-all">{xodim.login}</span>} />
          <Qator nom="Rol" qiymat={xodim.rolNomi} />
          <Qator
            nom="Bizneslar"
            qiymat={
              xodim.bizneslar.length === 0 ? (
                <span>
                  Barcha bizneslar
                  <span className="block text-2xs text-faint">cheklov qo&apos;yilmagan</span>
                </span>
              ) : (
                <ul className="list-none space-y-0.5">
                  {xodim.bizneslar.map((b) => (
                    <li key={b.id}>{b.nomi}</li>
                  ))}
                </ul>
              )
            }
          />
          <Qator nom="Qo'shilgan" qiymat={formatDateUZ(new Date(xodim.createdAt))} />
          <Qator
            nom="Oxirgi kirish"
            qiymat={
              xodim.lastLoginAt ? (
                formatRelative(new Date(xodim.lastLoginAt))
              ) : (
                <span className="text-faint">hech qachon kirmagan</span>
              )
            }
          />
        </dl>

        <div className="flex items-center gap-2 justify-end pt-1">
          <Button onClick={onTahrir} className="flex-1 sm:flex-none">
            Tahrirlash
          </Button>
          <AmalMenu label={xodim.ism} amallar={amallar} />
        </div>
      </div>
    </Modal>
  );
}
