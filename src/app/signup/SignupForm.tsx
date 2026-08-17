"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";

export default function SignupForm() {
  const router = useRouter();
  const [kompaniya, setKompaniya] = useState("");
  const [ism, setIsm] = useState("");
  const [telefon, setTelefon] = useState("");
  const [parol, setParol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (parol.length < 8) {
      setError("Parol kamida 8 belgi bo'lishi kerak");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kompaniya, ism, telefon, parol }),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={LABEL_CLASS}>Kompaniya nomi</label>
        <input
          type="text"
          value={kompaniya}
          onChange={(e) => setKompaniya(e.target.value)}
          placeholder="Masalan: Baraka Market"
          className={INPUT_CLASS}
          autoFocus
          required
        />
      </div>
      <div>
        <label className={LABEL_CLASS}>Ismingiz</label>
        <input
          type="text"
          value={ism}
          onChange={(e) => setIsm(e.target.value)}
          placeholder="Ism Familiya"
          className={INPUT_CLASS}
          required
        />
      </div>
      <div>
        <label className={LABEL_CLASS}>Telefon raqam (login)</label>
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
      {/* Brend rangi — yashil EMAS: yashil bu tizimda "pul kirdi" degani. */}
      <Button type="submit" size="lg" loading={loading} className="w-full">
        {loading ? "Yaratilmoqda…" : "Bepul boshlash (14 kun)"}
      </Button>
      <p className="text-2xs text-faint text-center">
        Ro'yxatdan o'tish bilan siz ma'lumotlaringiz faqat sizning kompaniyangizga ko'rinishini kafolatlaydigan
        tizimda hisob ochasiz.
      </p>
    </form>
  );
}
