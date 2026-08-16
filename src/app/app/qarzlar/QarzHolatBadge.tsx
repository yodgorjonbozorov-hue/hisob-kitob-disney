"use client";

import { Badge } from "@/components/ui/Badge";
import { QARZ_HOLAT_NOMI, type QarzHolat } from "@/lib/validation/qarz";

/** Holat rangi: ochiq — ma'lumot, qisman — qarz rangi, yopilgan — kirim. */
const TONE: Record<QarzHolat, "kirim" | "chiqim" | "neutral" | "warning" | "info"> = {
  OPEN: "info",
  PARTIALLY_PAID: "warning",
  PAID: "kirim",
  CANCELLED: "neutral",
};

export function QarzHolatBadge({ status }: { status: QarzHolat }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{QARZ_HOLAT_NOMI[status] ?? status}</Badge>;
}
