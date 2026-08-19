import { cn } from "@/lib/cn";

/**
 * STATUS BADGE TIZIMI (talab 38).
 *
 * Semantik ranglar loyihaning mavjud tokenlaridan olinadi (income/expense/
 * debt/brand) — Control Center o'z palitrasini YARATMAYDI, brend bilan bir xil
 * tilda gapiradi.
 */

export type Ton = "neytral" | "muvaffaqiyat" | "ogoh" | "xavf" | "info" | "brend";

const TON_KLASS: Record<Ton, string> = {
  neytral: "bg-surface-2 text-muted border-line",
  muvaffaqiyat: "bg-income-soft text-income-fg border-transparent",
  ogoh: "bg-debt-soft text-debt-fg border-transparent",
  xavf: "bg-expense-soft text-expense-fg border-transparent",
  info: "bg-brand-wash text-brand border-transparent",
  brend: "bg-brand text-brand-fg border-transparent",
};

export function Belgi({
  ton = "neytral",
  children,
  className = "",
}: {
  ton?: Ton;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-2xs font-medium whitespace-nowrap",
        TON_KLASS[ton],
        className
      )}
    >
      {children}
    </span>
  );
}

const TENANT_STATUS: Record<string, { label: string; ton: Ton }> = {
  TRIAL: { label: "Sinov", ton: "info" },
  ACTIVE: { label: "Faol", ton: "muvaffaqiyat" },
  PAST_DUE: { label: "Muddati o'tgan", ton: "ogoh" },
  BLOCKED: { label: "Bloklangan", ton: "xavf" },
};

export function TenantStatus({ status }: { status: string }) {
  const s = TENANT_STATUS[status] ?? { label: status, ton: "neytral" as Ton };
  return <Belgi ton={s.ton}>{s.label}</Belgi>;
}

const KIRISH_REJIM: Record<string, { label: string; ton: Ton }> = {
  FULL: { label: "To'liq", ton: "muvaffaqiyat" },
  READONLY: { label: "Faqat o'qish", ton: "ogoh" },
  BILLING_ONLY: { label: "Faqat to'lov", ton: "xavf" },
};

export function KirishRejimi({ mode }: { mode: string }) {
  const s = KIRISH_REJIM[mode] ?? { label: mode, ton: "neytral" as Ton };
  return <Belgi ton={s.ton}>{s.label}</Belgi>;
}

const TOLOV_STATUS: Record<string, { label: string; ton: Ton }> = {
  PENDING: { label: "Kutilmoqda", ton: "ogoh" },
  CONFIRMED: { label: "Tasdiqlangan", ton: "muvaffaqiyat" },
  REJECTED: { label: "Rad etilgan", ton: "xavf" },
};

export function TolovStatus({ status }: { status: string }) {
  const s = TOLOV_STATUS[status] ?? { label: status, ton: "neytral" as Ton };
  return <Belgi ton={s.ton}>{s.label}</Belgi>;
}

const SOGLIK: Record<string, Ton> = {
  "SOG'LOM": "muvaffaqiyat",
  OGOHLANTIRISH: "ogoh",
  KRITIK: "xavf",
  SOZLANMAGAN: "neytral",
};

export function SoglikBelgisi({ holat }: { holat: string }) {
  return <Belgi ton={SOGLIK[holat] ?? "neytral"}>{holat}</Belgi>;
}

const MUHIMLIK: Record<string, Ton> = {
  PAST: "neytral",
  ORTA: "info",
  YUQORI: "ogoh",
  KRITIK: "xavf",
};

export function MuhimlikBelgisi({ muhimlik, label }: { muhimlik: string; label: string }) {
  return <Belgi ton={MUHIMLIK[muhimlik] ?? "neytral"}>{label}</Belgi>;
}
