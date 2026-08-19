"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { can, type Resurs, type SuperRol } from "@/lib/superadmin/rbac";

export type TabKalit = "umumiy" | "userlar" | "modullar" | "obuna" | "billing" | "faoliyat";

const TABLAR: { kalit: TabKalit; label: string; resurs: Resurs }[] = [
  { kalit: "umumiy", label: "Umumiy", resurs: "bizneslar" },
  { kalit: "userlar", label: "Foydalanuvchilar", resurs: "foydalanuvchilar" },
  { kalit: "modullar", label: "Modullar", resurs: "modullar" },
  { kalit: "obuna", label: "Obuna", resurs: "obunalar" },
  { kalit: "billing", label: "Billing", resurs: "billing" },
  { kalit: "faoliyat", label: "Faoliyat", resurs: "audit" },
];

/**
 * Kompaniya kartochkasi tab'lari.
 *
 * Tab holati URL'da (`?tab=`) — server faqat OChIQ tab uchun ma'lumot
 * o'qiydi, ya'ni sahifa ochilganda 6 ta bo'lim emas, bittasi yuklanadi.
 * Ko'rish huquqi yo'q tab umuman ko'rsatilmaydi.
 */
export function BiznesTablar({
  tenantId,
  joriy,
  superRol,
}: {
  tenantId: string;
  joriy: TabKalit;
  superRol: SuperRol;
}) {
  const korinadigan = TABLAR.filter((t) => can(superRol, t.resurs, "VIEW"));

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-line -mx-3 px-3 md:mx-0 md:px-0"
      aria-label="Kompaniya bo'limlari"
    >
      {korinadigan.map((t) => (
        <Link
          key={t.kalit}
          href={`/superadmin/bizneslar/${tenantId}?tab=${t.kalit}`}
          aria-current={t.kalit === joriy ? "page" : undefined}
          className={cn(
            "px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition",
            t.kalit === joriy
              ? "border-brand text-brand font-medium"
              : "border-transparent text-muted hover:text-fg"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
