"use client";

import { useEffect, useState } from "react";

/**
 * Yorug'/qorong'i mavzu almashtirgichi. localStorage'da saqlanadi, birinchi
 * tashrifda prefers-color-scheme'ga tayanadi. FOUC oldini olish layout.tsx
 * ichidagi inline skript orqali (bo'yashdan oldin `dark` klass qo'shiladi).
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setIsDark(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Yorug' rejim" : "Qorong'i rejim"}
      title={isDark ? "Yorug' rejim" : "Qorong'i rejim"}
      className={`inline-flex items-center justify-center rounded-lg w-9 h-9 text-muted hover:text-fg hover:bg-surface-2 transition ${className}`}
    >
      {/* Ikkala ikonka ham render qilinadi; CSS orqali mavzuga qarab ko'rsatiladi (hydration-safe) */}
      <svg className="w-5 h-5 hidden dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      </svg>
      <svg className="w-5 h-5 block dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}
