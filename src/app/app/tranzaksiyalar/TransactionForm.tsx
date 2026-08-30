"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { formatSom, parseSomInput } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import { Button } from "@/components/ui/Button";
import type { TolovTuri } from "@/lib/validation/transaction";
import { TurVaTolov } from "./TurVaTolov";
import { QarzForm, type QarzMasul } from "./QarzForm";
import { KG_BOSH, KgMaydonlari, type KgQiymat } from "./KgMaydonlari";
import { SummaMaydoni } from "./SummaMaydoni";
import { KategoriyaTanlov } from "./KategoriyaTanlov";
import { QoshimchaMaydonlar } from "./QoshimchaMaydonlar";
import type { TransactionDTO } from "@/lib/queries/transactions";
import type { CategoryOption, XodimOption } from "./turlar";
import type { TezKategoriyalar } from "@/lib/queries/tezKategoriyalar";

interface AccountOption {
  id: string;
  nomi: string;
}

/**
 * KIRIM / CHIQIM FORMASI — pastdan chiqadigan varaq (mobil) yoki dialog
 * (desktop) ichida ishlaydi, shuning uchun o'zining kartasi YO'Q.
 *
 * Maydonlar tezlik tartibida: tur → summa → to'lov → kategoriya → sana →
 * (kassa) → izoh. Summa eng tepada va eng katta: kassir uni birinchi yozadi.
 *
 * IKKI MARTA YUBORISH HIMOYASI: `yuborilmoqda` refi bosishni STATE
 * yangilanishini kutmasdan bloklaydi (React state asinxron — ikki tez
 * bosishda `loading` hali `true` bo'lib ulgurmasdi va bir xil yozuv ikki
 * marta yaratilardi).
 */
export function TransactionForm({
  categories,
  accounts,
  masullar = [],
  sotuvchilar = [],
  currentUserId = "",
  sotuvchiTanlash = false,
  tezKategoriyalar,
  boshTuri = "kirim",
  onCreated,
  onQarzCreated,
}: {
  categories: CategoryOption[];
  /** Faol kassalar. Bitta bo'lsa tanlash maydoni KO'RSATILMAYDI — ortiqcha qadam. */
  accounts: AccountOption[];
  /** Qarzga mas'ul qilib belgilash mumkin bo'lgan xodimlar. */
  masullar?: QarzMasul[];
  /** Kirimda "Sotuvchi / Xodim" tanlovi uchun biznes xodimlari. */
  sotuvchilar?: XodimOption[];
  /** Sotuvchi tanlovining standart qiymati — joriy foydalanuvchi. */
  currentUserId?: string;
  /** Boshqa xodimni tanlashga ruxsat (boshqaruvchi). Aks holda maydon chiqmaydi. */
  sotuvchiTanlash?: boolean;
  /** Ko'p ishlatiladigan kategoriyalar — faqat tartib uchun. */
  tezKategoriyalar?: TezKategoriyalar;
  boshTuri?: "kirim" | "chiqim";
  /** `t === null` — tasdiqlash so'rovi yaratildi, yozuv hali yo'q. */
  onCreated: (t: TransactionDTO | null, xabar: string) => void;
  /** Qarz yozilgach sahifani yangilash (qarz tranzaksiya emas). */
  onQarzCreated?: () => void;
}) {
  const [turi, setTuri] = useState<"kirim" | "chiqim">(boshTuri);
  const [tolovTuri, setTolovTuri] = useState<TolovTuri>("naqd");
  const [categoryId, setCategoryId] = useState("");
  const [summaText, setSummaText] = useState("");
  const [sana, setSana] = useState(todayDateOnlyString());
  const [izoh, setIzoh] = useState("");
  const [accountId, setAccountId] = useState("");
  const [sotuvchiId, setSotuvchiId] = useState(currentUserId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yuborilmoqda = useRef(false);
  const ildiz = useRef<HTMLDivElement>(null);

  // Varaq ochilganda Modal birinchi maydonga (summa) fokus beradi va brauzer
  // uni ko'rinishga surib, tepadagi "Kirim/Chiqim" va "To'lov turi"
  // tanlovlarini ekrandan chiqarib yuboradi — kassir nima tanlanganini
  // ko'rmay qoladi. Fokusdan KEYIN (rAF) varaqni boshiga qaytaramiz.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const varaq = ildiz.current?.closest<HTMLElement>(".overflow-y-auto");
      if (varaq) varaq.scrollTop = 0;
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.turi === turi),
    [categories, turi]
  );
  const tezIdlar = turi === "kirim" ? tezKategoriyalar?.kirim : tezKategoriyalar?.chiqim;

  // KG SAVDOSI (mijozga xos — Fortex Selos): kg kategoriyasi tanlansa summa
  // maydoni o'rniga miqdor va 1 kg narxi so'raladi (KgMaydonlari).
  const [kg, setKg] = useState<KgQiymat>(KG_BOSH);
  const [kgTozalash, setKgTozalash] = useState(0);
  const tanlangan = filteredCategories.find((c) => c.id === categoryId);
  const kgRejimi = !!tanlangan?.kgAsosli;

  function turiAlmash(yangi: "kirim" | "chiqim") {
    setTuri(yangi);
    setCategoryId("");
    // Qarz faqat kirim uchun — chiqimga o'tilganda naqdga qaytariladi.
    if (yangi === "chiqim" && tolovTuri === "qarz") setTolovTuri("naqd");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (yuborilmoqda.current) return;
    setError(null);

    const summa = kgRejimi ? kg.jami : parseSomInput(summaText);
    if (!categoryId) return setError("Kategoriya tanlanmagan");
    if (kgRejimi && kg.miqdorKg <= 0) return setError("Miqdorni (kg) kiriting");
    if (kgRejimi && kg.kgNarxi <= 0) return setError("1 kg narxini kiriting");
    if (summa <= 0) return setError("Summani kiriting");

    yuborilmoqda.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turi,
          tolovTuri,
          categoryId,
          summa,
          sana,
          izoh: izoh || undefined,
          // Kg savdosida server summani miqdor × narxdan qayta hisoblaydi.
          ...(kgRejimi ? { miqdorKg: kg.miqdorKg, kgNarxi: kg.kgNarxi } : {}),
          // Bitta kassali biznesda accountId yuborilmaydi — server birinchi
          // faol kassani o'zi tanlaydi.
          ...(accountId ? { accountId } : {}),
          // Sotuvchi faqat kirimda; yuborilmasa server yozuvchining o'zini oladi.
          ...(turi === "kirim" && sotuvchiId ? { sotuvchiId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        return;
      }
      // TASDIQLASH moduli: chegaradan oshgan chiqim YOZILMAYDI, so'rov
      // yaratiladi (202). Uni ro'yxatga qo'shish yolg'on bo'lardi.
      if (data.tasdiqKutilmoqda) {
        onCreated(null, data.message ?? "Tasdiq kutilmoqda");
        return;
      }
      const nom = turi === "kirim" ? "Kirim" : "Chiqim";
      onCreated(data, `${formatSom(summa)} so'm ${nom} qo'shildi`);
      setSummaText("");
      setKgTozalash((n) => n + 1);
      setIzoh("");
      setCategoryId("");
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      yuborilmoqda.current = false;
      setLoading(false);
    }
  }

  const qarzRejimi = tolovTuri === "qarz";

  return (
    <div ref={ildiz} className="space-y-4">
      <TurVaTolov turi={turi} tolovTuri={tolovTuri} onTuri={turiAlmash} onTolov={setTolovTuri} />

      {/* QARZ — butunlay boshqa forma: tranzaksiya emas, majburiyat yoziladi.
          Shuning uchun kassa/summa maydonlari o'rniga mijoz formasi chiqadi. */}
      {qarzRejimi ? (
        <QarzForm kategoriyalar={filteredCategories} masullar={masullar} onCreated={() => onQarzCreated?.()} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {kgRejimi ? (
            <KgMaydonlari onChange={setKg} tozalash={kgTozalash} />
          ) : (
            <SummaMaydoni qiymat={summaText} onChange={setSummaText} turi={turi} disabled={loading} />
          )}

          <KategoriyaTanlov
            kategoriyalar={filteredCategories}
            qiymat={categoryId}
            onChange={setCategoryId}
            tezIdlar={tezIdlar}
            disabled={loading}
          />

          <QoshimchaMaydonlar
            sana={sana}
            onSana={setSana}
            accounts={accounts}
            accountId={accountId}
            onAccount={setAccountId}
            izoh={izoh}
            onIzoh={setIzoh}
            loading={loading}
            kirim={turi === "kirim"}
            sotuvchilar={sotuvchilar}
            sotuvchiId={sotuvchiId}
            onSotuvchi={setSotuvchiId}
            sotuvchiTanlash={sotuvchiTanlash}
          />

          {error && (
            <p role="alert" className="text-expense text-sm">
              {error}
            </p>
          )}

          {/* Yopishqoq: uzun formada ham "Saqlash" barmoq ostida qoladi. */}
          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-surface border-t border-line">
            <Button type="submit" size="lg" loading={loading} className="w-full">
              {turi === "kirim" ? "Kirimni saqlash" : "Chiqimni saqlash"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
