"use client";

import { useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import {
  narxHisobla,
  normalizeFiliallar,
  pricingConfig,
  somFormat,
  type AddonKey,
  type TolovDavri,
} from "@/lib/pricing/config";
import { BIZNES_PROFILLAR, BUSINESS_TYPES, type BusinessType } from "@/lib/pricing/profil";

/**
 * Tariflar sahifasidan URL orqali kelgan boshlang'ich tanlovlar.
 * ISHONCHSIZ ma'lumot: faqat formani oldindan to'ldiradi — narx va tarif
 * hisobi serverda qayta tekshiriladi.
 */
export interface SignupBoshlangich {
  yonalish: BusinessType | null;
  filiallar: number;
  addons: AddonKey[];
  davr: TolovDavri;
}

export default function SignupForm({ boshlangich }: { boshlangich: SignupBoshlangich }) {
  const router = useRouter();
  // 1-qadam: hisob. 2-qadam: biznes sozlamalari.
  const [qadam, setQadam] = useState<1 | 2>(1);
  const [ism, setIsm] = useState("");
  const [telefon, setTelefon] = useState("");
  const [parol, setParol] = useState("");
  const [kompaniya, setKompaniya] = useState("");
  const [yonalish, setYonalish] = useState<BusinessType | null>(boshlangich.yonalish);
  const [filiallar, setFiliallar] = useState(boshlangich.filiallar);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const narx = useMemo(
    () => narxHisobla({ filiallar, addons: boshlangich.addons, davr: boshlangich.davr }),
    [filiallar, boshlangich.addons, boshlangich.davr]
  );

  function birinchiQadam(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (parol.length < 8) {
      setError("Parol kamida 8 belgi bo'lishi kerak");
      return;
    }
    setQadam(2);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kompaniya,
          ism,
          telefon,
          parol,
          ...(yonalish ? { yonalish } : {}),
          ...(boshlangich.addons.length > 0 ? { addons: boshlangich.addons } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        setLoading(false);
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      setError("Serverga ulanib bo'lmadi");
      setLoading(false);
    }
  }

  if (qadam === 1) {
    return (
      <form onSubmit={birinchiQadam} className="space-y-4">
        <p className="text-2xs text-faint">1 / 2 — Hisob ochish</p>
        <div>
          <label className={LABEL_CLASS}>Ismingiz</label>
          <input
            type="text"
            value={ism}
            onChange={(e) => setIsm(e.target.value)}
            placeholder="Ism Familiya"
            className={INPUT_CLASS}
            autoFocus
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Telefon raqamingiz (login)</label>
          <input
            type="tel"
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
            placeholder="+998 90 123 45 67"
            className={INPUT_CLASS}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Parol</label>
          <input
            type="password"
            value={parol}
            onChange={(e) => setParol(e.target.value)}
            placeholder="Kamida 8 belgi"
            minLength={8}
            className={INPUT_CLASS}
            required
          />
        </div>
        {error && <p className="text-expense text-sm">{error}</p>}
        <Button type="submit" size="lg" className="w-full">
          Davom etish
        </Button>
        <p className="text-2xs text-faint text-center">
          Bank kartasi kerak emas · Avtomatik pul yechilmaydi
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-2xs text-faint">2 / 2 — Biznesingizni sozlaymiz</p>
      <div>
        <label className={LABEL_CLASS}>Biznes nomi</label>
        <input
          type="text"
          value={kompaniya}
          onChange={(e) => setKompaniya(e.target.value)}
          placeholder="Masalan: Navoi Market"
          className={INPUT_CLASS}
          autoFocus
          required
        />
      </div>
      <div>
        <label className={LABEL_CLASS}>Biznes yo'nalishi</label>
        <div className="grid grid-cols-2 gap-2">
          {BUSINESS_TYPES.map((code) => {
            const p = BIZNES_PROFILLAR[code];
            const faol = yonalish === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setYonalish(code)}
                aria-pressed={faol}
                className={`min-h-[44px] rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                  faol
                    ? "border-brand bg-brand-wash text-fg"
                    : "border-line bg-surface text-muted hover:bg-surface-2"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className={LABEL_CLASS}>Filiallar soni</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Filial kamaytirish"
            onClick={() => setFiliallar((f) => normalizeFiliallar(f - 1))}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-line bg-surface text-lg text-fg hover:bg-surface-2"
          >
            −
          </button>
          <span className="font-display text-base font-bold tabular-nums text-fg">{filiallar}</span>
          <button
            type="button"
            aria-label="Filial ko'paytirish"
            onClick={() => setFiliallar((f) => normalizeFiliallar(f + 1))}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-line bg-surface text-lg text-fg hover:bg-surface-2"
          >
            +
          </button>
          <span className="text-2xs text-faint">
            Filiallar keyin “Bizneslar” bo'limida qo'shiladi
          </span>
        </div>
      </div>
      <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-muted">
        Sinovdan keyingi narx:{" "}
        <span className="font-medium text-fg tabular-nums">
          {somFormat(narx.oylikJami)} so'm / oy
        </span>
        {boshlangich.addons.length > 0 && (
          <>
            {" · "}
            {boshlangich.addons.map((k) => pricingConfig.addons[k].nomi).join(", ")}
          </>
        )}
        <span className="block mt-0.5 text-2xs text-faint">
          Hozir hech narsa to'lamaysiz — {pricingConfig.trialDays} kun bepul.
        </span>
      </div>
      {error && <p className="text-expense text-sm">{error}</p>}
      {/* Brend rangi — yashil EMAS: yashil bu tizimda "pul kirdi" degani. */}
      <Button type="submit" size="lg" loading={loading} className="w-full">
        {loading ? "Yaratilmoqda…" : `${pricingConfig.trialDays} kun bepul boshlash`}
      </Button>
      <button
        type="button"
        onClick={() => setQadam(1)}
        className="w-full text-center text-xs text-muted hover:text-fg"
      >
        ← Orqaga
      </button>
      <p className="text-2xs text-faint text-center">
        Ro'yxatdan o'tish bilan siz ma'lumotlaringiz faqat sizning kompaniyangizga ko'rinishini
        kafolatlaydigan tizimda hisob ochasiz.
      </p>
    </form>
  );
}
