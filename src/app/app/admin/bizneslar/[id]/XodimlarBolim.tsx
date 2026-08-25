"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROL_LABEL, type Rol } from "@/lib/auth/roles";
import type { BiznesXodim } from "@/lib/services/biznesTafsilot";

/**
 * XODIMLAR — shu bizneste ishlaydiganlar (faqat ko'rish).
 *
 * Biriktirish mavjud "Foydalanuvchilar" oqimida qoladi: bir xodim bir nechta
 * biznesga biriktiriladi va uni ikki joyda tahrirlash chalkashlik tug'diradi.
 * "Barcha bizneslar" belgisi — biriktirilmagan xodim (direktor/administrator),
 * u har bizneste ko'rinadi (lib/services/userBiznes.ts qoidasi).
 */
export function XodimlarBolim({ xodimlar }: { xodimlar: BiznesXodim[] }) {
  if (xodimlar.length === 0) {
    return (
      <EmptyState
        title="Xodim yo'q"
        description="Bu bizneste hali xodim ishlamayapti."
        action={
          <Link href="/app/admin/foydalanuvchilar" className="text-sm text-brand hover:underline">
            Foydalanuvchilar bo&apos;limi →
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <ul className="list-none divide-y divide-line">
        {xodimlar.map((x) => (
          <li key={x.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg truncate">{x.ism}</p>
              <p className="text-xs text-muted mt-0.5">{ROL_LABEL[x.rol as Rol] ?? x.rol}</p>
            </div>
            {!x.biriktirilgan && (
              <span className="shrink-0 text-2xs px-2 py-0.5 rounded-full bg-surface-2 text-muted">
                barcha bizneslar
              </span>
            )}
          </li>
        ))}
      </ul>
      <Link
        href="/app/admin/foydalanuvchilar"
        className="inline-flex items-center min-h-[44px] text-sm text-brand hover:underline"
      >
        Xodimlarni boshqarish →
      </Link>
    </div>
  );
}
