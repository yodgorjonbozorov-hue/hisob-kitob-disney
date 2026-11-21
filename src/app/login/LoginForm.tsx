"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ParolInput } from "@/components/ui/ParolInput";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { telgaOxshaydi, telKorinish, telNormalize } from "@/lib/tel";

/** Qolgan vaqt: 60 soniyadan kami "45 s", ko'pi "12:55" (daqiqa:soniya). */
function sanoqMatni(soniya: number): string {
  if (soniya < 60) return `${soniya} s`;
  const d = Math.floor(soniya / 60);
  const s = soniya % 60;
  return `${d}:${String(s).padStart(2, "0")}`;
}

export default function LoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [parol, setParol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unutdim, setUnutdim] = useState(false);
  // Urinishlar chegarasiga yetilganda (429) qolgan soniyalar. 0 — bloklanmagan.
  const [kutish, setKutish] = useState(0);
  const parolRef = useRef<HTMLInputElement>(null);

  // Teskari sanoq: har soniyada kamayadi; tugaganda xabar o'chadi va tugma ochiladi.
  useEffect(() => {
    if (kutish <= 0) return;
    const t = setTimeout(() => {
      setKutish((s) => s - 1);
      if (kutish === 1) setError(null);
    }, 1000);
    return () => clearTimeout(t);
  }, [kutish]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (kutish > 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, parol }),
      });
      const data = await res.json();
      if (!res.ok) {
        const soniya = Number(data.retryAfter);
        if (res.status === 429 && Number.isFinite(soniya) && soniya > 0) {
          // Server matnidagi soniya tez eskiradi — sanoq tugmada ko'rsatiladi.
          setKutish(Math.ceil(soniya));
          setError("Juda ko'p urinish. Vaqt tugagach qayta urining.");
        } else {
          setError(data.error ?? "Xatolik yuz berdi");
        }
        setLoading(false);
        // Noto'g'ri parolda qayta yozish oson bo'lsin: parol belgilanadi.
        if (res.status === 401) {
          parolRef.current?.focus();
          parolRef.current?.select();
        }
        return;
      }
      router.push(data.rol === "SUPERADMIN" ? "/superadmin" : "/app");
      router.refresh();
    } catch {
      setError("Serverga ulanib bo'lmadi");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="login" className={LABEL_CLASS}>
          Login yoki telefon raqam
        </label>
        <input
          id="login"
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          // Raqam yozilgan bo'lsa E.123 ko'rinishiga keltiriladi — foydalanuvchi
          // to'g'ri tushunilganini ko'radi. Server raqamni qanday yozilganidan
          // qat'i nazar topadi (lib/auth/loginTop.ts); harfli login tegilmaydi.
          onBlur={() => {
            if (!telgaOxshaydi(login)) return;
            const uz = telNormalize(login);
            if (uz) setLogin(telKorinish(uz));
          }}
          className={INPUT_CLASS}
          // Telefon klaviaturasi birinchi harfni kattalashtirmasin va loginni
          // "to'g'rilab" yubormasin — aks holda kirish bekorga rad etiladi.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          autoFocus
          required
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="parol" className={LABEL_CLASS}>
            Parol
          </label>
          <button
            type="button"
            onClick={() => setUnutdim((v) => !v)}
            aria-expanded={unutdim}
            aria-controls="parol-unutdim"
            className="text-xs text-brand hover:underline mb-1.5"
          >
            Unutdingizmi?
          </button>
        </div>
        {unutdim && (
          <p id="parol-unutdim" className="mb-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
            Parolni kompaniyangiz direktori yoki administratori tiklab beradi: Sozlamalar → Foydalanuvchilar →
            &quot;Parolni tiklash&quot;. Telegram bog&apos;langan bo&apos;lsa, pastdagi Telegram tugmasi bilan parolsiz kiring.
          </p>
        )}
        <ParolInput
          ref={parolRef}
          id="parol"
          value={parol}
          onChange={(e) => setParol(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="current-password"
          required
        />
      </div>
      {/* role="alert" — xato ekran o'quvchiga darhol e'lon qilinadi. Element
          doim DOMda turadi: bo'sh konteynerga matn qo'shilganda e'lon ishonchli. */}
      <p role="alert" className="text-expense text-sm empty:hidden">
        {error}
      </p>
      {/* Brend rangi — yashil EMAS: yashil bu tizimda "pul kirdi" degani. */}
      <Button type="submit" size="lg" loading={loading} disabled={kutish > 0} className="w-full">
        {loading ? "Kirilmoqda…" : kutish > 0 ? `Kuting (${sanoqMatni(kutish)})` : "Kirish"}
      </Button>
    </form>
  );
}
