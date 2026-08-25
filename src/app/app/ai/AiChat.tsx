"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, Plus } from "lucide-react";
import type { BugungiXulosa } from "@/lib/ai/xulosa";
import { BoshHolat } from "./BoshHolat";
import { DavrTanlash } from "./DavrTanlash";
import { Kompozer } from "./Kompozer";
import { SuhbatlarPanel } from "./SuhbatlarPanel";
import { Xabarlar } from "./Xabarlar";
import type { SuhbatQator, Xabar } from "./turlar";

interface Props {
  biznesNomi: string;
  aiUlangan: boolean;
  savollar: string[];
  xulosa: BugungiXulosa;
  suhbatlar: SuhbatQator[];
}

/**
 * BALANSA AI — TO'LIQ EKRANLI SUHBAT.
 *
 * Maket bitta daraxt: mobil va desktop farqi faqat CSS'da (`ai-ekran`
 * balandligi, panelning drawer bo'lib ochilishi). Shu sabab ikkita alohida
 * komponent qo'llab-quvvatlanmaydi va ikkisi bir-biridan uzilib qolmaydi.
 *
 * Ekranda ko'rinadigan xabarlar faqat KO'RSATISH uchun — modelga ketadigan
 * tarix serverda (`lib/ai/suhbatlar.ts`), ya'ni soxta "assistant" xabari
 * bilan modelni chalg'itib bo'lmaydi.
 */
export function AiChat({ biznesNomi, aiUlangan, savollar, xulosa, suhbatlar }: Props) {
  const [xabarlar, setXabarlar] = useState<Xabar[]>([]);
  const [suhbatId, setSuhbatId] = useState<string | null>(null);
  const [royxat, setRoyxat] = useState<SuhbatQator[]>(suhbatlar);
  const [davr, setDavr] = useState("oy");
  const [kutilmoqda, setKutilmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [oxirgiSavol, setOxirgiSavol] = useState<string | null>(null);
  const [panelOchiq, setPanelOchiq] = useState(false);
  const pastRef = useRef<HTMLDivElement>(null);

  const pastgaTush = useCallback(() => {
    // Ramkadan keyin — yangi xabar DOM'ga chizilib bo'lgach.
    requestAnimationFrame(() => pastRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }, []);

  useEffect(() => {
    if (xabarlar.length > 0) pastgaTush();
  }, [xabarlar.length, kutilmoqda, pastgaTush]);

  async function yuborish(matn: string) {
    const savol = matn.trim();
    // Ikki marta bosish himoyasi: so'rov ketayotganda yangi savol qabul qilinmaydi.
    if (!savol || kutilmoqda) return;
    setXato(null);
    setOxirgiSavol(savol);
    setXabarlar((oldingi) => [...oldingi, { rol: "user", matn: savol }]);
    setKutilmoqda(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savol, suhbatId, davr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Ma'lumotlarni tahlil qilishda xatolik yuz berdi.");
        return;
      }
      setXabarlar((oldingi) => [
        ...oldingi,
        { rol: "assistant", matn: data.javob, havolalar: data.havolalar, takliflar: data.takliflar },
      ]);
      setSuhbatId(data.suhbatId);
      setRoyxat((oldingi) => {
        const qolgan = oldingi.filter((s) => s.id !== data.suhbatId);
        return [{ id: data.suhbatId, sarlavha: data.sarlavha, yangilangan: new Date().toISOString() }, ...qolgan];
      });
    } catch {
      setXato("Serverga ulanib bo'lmadi. Internetni tekshirib, qayta urining.");
    } finally {
      setKutilmoqda(false);
    }
  }

  function yangiSuhbat() {
    if (kutilmoqda) return;
    setXabarlar([]);
    setSuhbatId(null);
    setXato(null);
    setOxirgiSavol(null);
    setPanelOchiq(false);
  }

  async function suhbatniOch(id: string) {
    setPanelOchiq(false);
    if (kutilmoqda || id === suhbatId) return;
    setXato(null);
    try {
      const res = await fetch(`/api/ai/suhbatlar/${id}`);
      if (!res.ok) {
        setXato("Suhbatni ochib bo'lmadi.");
        return;
      }
      const data = await res.json();
      setXabarlar(data.xabarlar ?? []);
      setSuhbatId(data.id);
    } catch {
      setXato("Serverga ulanib bo'lmadi.");
    }
  }

  async function suhbatniOchir(id: string) {
    setRoyxat((oldingi) => oldingi.filter((s) => s.id !== id));
    if (id === suhbatId) yangiSuhbat();
    await fetch(`/api/ai/suhbatlar/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="ai-ekran -mx-4 -mt-4 -mb-24 lg:m-0 flex gap-4">
      <SuhbatlarPanel
        suhbatlar={royxat}
        joriyId={suhbatId}
        ochiq={panelOchiq}
        onYopish={() => setPanelOchiq(false)}
        onTanlash={suhbatniOch}
        onOchirish={suhbatniOchir}
        onYangi={yangiSuhbat}
      />

      <div className="flex-1 min-w-0 flex flex-col bg-surface lg:rounded-2xl lg:border lg:border-line overflow-hidden">
        <header className="shrink-0 border-b border-line px-4 lg:px-6 py-2.5 flex items-center gap-2">
          <button
            onClick={() => setPanelOchiq(true)}
            aria-label="Suhbatlar tarixi"
            className="xl:hidden shrink-0 w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-muted hover:text-fg hover:bg-surface-2 transition"
          >
            <History className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm lg:text-base font-semibold text-fg truncate">Balansa AI</h1>
            <p className="text-2xs text-muted truncate">{biznesNomi}</p>
          </div>
          <DavrTanlash qiymat={davr} onOzgarish={setDavr} />
          {/* xl'da yon panelning o'z tugmasi bor — sarlavhada takrorlanmaydi. */}
          <button
            onClick={yangiSuhbat}
            className="xl:hidden shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 lg:px-3 rounded-lg text-xs font-medium text-muted hover:text-fg hover:bg-surface-2 transition"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Yangi suhbat</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {xabarlar.length === 0 ? (
            <BoshHolat
              savollar={savollar}
              xulosa={xulosa}
              aiUlangan={aiUlangan}
              onSavol={yuborish}
            />
          ) : (
            <div className="px-4 lg:px-6 py-5">
              <Xabarlar
                xabarlar={xabarlar}
                kutilmoqda={kutilmoqda}
                onTaklif={yuborish}
                xato={xato}
                onQayta={() => oxirgiSavol && yuborish(oxirgiSavol)}
              />
              <div ref={pastRef} />
            </div>
          )}
        </div>

        <Kompozer
          onYuborish={yuborish}
          kutilmoqda={kutilmoqda}
          ochiq={aiUlangan}
          xato={xabarlar.length === 0 ? xato : null}
        />
      </div>
    </div>
  );
}
