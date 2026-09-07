"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * DEMO BANNERI — demo rejimida HAR sahifa yuqorisida turadi.
 *
 * Ikki vazifasi bor: mehmon ko'rayotgan raqamlar namunaviy ekanini ochiq
 * aytish (aks holda u demo ma'lumotini o'z biznesi deb o'ylab qolishi
 * mumkin) va asosiy amalga — 14 kunlik ro'yxatdan o'tishga — yo'l ko'rsatish.
 */
export function DemoBanner() {
  const router = useRouter();

  async function chiqish() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mb-4 rounded-xl border border-brand bg-brand-wash text-fg px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
      <span>
        🎬 <span className="font-semibold">Demo rejimi</span> — bu namunaviy ma&apos;lumotlar,
        o&apos;zgartirishlar saqlanmaydi.
      </span>
      <span className="flex items-center gap-4 shrink-0">
        <Link href="/signup?manba=demo" className="font-medium text-brand underline">
          O&apos;z biznesim uchun boshlash
        </Link>
        <button onClick={chiqish} className="text-muted underline">
          Chiqish
        </button>
      </span>
    </div>
  );
}
