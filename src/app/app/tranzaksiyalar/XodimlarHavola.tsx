"use client";

import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";

/**
 * "XODIMLAR" HAVOLA KARTASI — sotuvchilar kesimidagi analitika sahifasiga
 * o'tish (moliyaviy kategoriya EMAS). Faqat `hisobot.korish` huquqi borlarga
 * ko'rsatiladi (TransactionsClient shart bilan chaqiradi). Ixcham qator —
 * mobil ekranni bosib yubormaydi.
 */
export function XodimlarHavola() {
  return (
    <Link
      href="/app/tranzaksiyalar/xodimlar"
      className="flex items-center gap-3 bg-surface rounded-2xl shadow-card border border-line
        px-4 py-3 min-h-[52px] hover:border-brand transition"
    >
      <span className="w-9 h-9 rounded-xl bg-brand-wash text-brand flex items-center justify-center">
        <Users className="w-5 h-5" aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-medium text-fg">Xodimlar</span>
        <span className="block text-xs text-muted">
          Sotuvchilar bo&apos;yicha zakaz va savdo statistikasi
        </span>
      </span>
      <ChevronRight className="w-5 h-5 text-faint" aria-hidden="true" />
    </Link>
  );
}
