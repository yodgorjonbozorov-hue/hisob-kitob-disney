"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { useToast } from "@/components/ui/Toast";
import { formatSomLabel } from "@/lib/format";
import type { PosMahsulotDTO, PosKategoriyaDTO } from "@/lib/queries/pos";
import type { AccountDTO } from "@/lib/queries/accounts";
import { Savat } from "./Savat";
import { MahsulotTori } from "./MahsulotTori";
import { TolovModal, type TolovTuri } from "./TolovModal";
import { KameraSkaner } from "./KameraSkaner";
import { useSkaner } from "./useSkaner";
import { useSavat } from "./useSavat";

/**
 * KASSIR EKRANI (POS) — chap tomonda mahsulot to'ri, o'ngda savat.
 *
 * Bu komponent faqat BOG'LAYDI: savat mantig'i `useSavat`da, apparat skaner
 * `useSkaner`da, to'lov `TolovModal`da. Shu bo'linish kassa ekranini
 * o'zgartirishni xavfsiz qiladi — savat qoidasiga tegmasdan tashqi
 * ko'rinishni almashtirish mumkin.
 */
export function PosClient({
  mahsulotlar,
  kategoriyalar,
  kassalar,
}: {
  mahsulotlar: PosMahsulotDTO[];
  kategoriyalar: PosKategoriyaDTO[];
  kassalar: AccountDTO[];
  /** MIJOZLAR moduli yoqiq bo'lsa — qarzga sotuvda limit ishlaydigan kartochkalar. */
}) {
  const router = useRouter();
  const { toast } = useToast();
  const savat = useSavat(mahsulotlar);
  const [qidiruv, setQidiruv] = useState("");
  const [kategoriya, setKategoriya] = useState("");
  const [kamera, setKamera] = useState(false);
  const [tolov, setTolov] = useState(false);
  const [yuborilmoqda, setYuborilmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const qidiruvRef = useRef<HTMLInputElement>(null);

  /** Kod topilsa qidiruv maydoni tozalanadi — keyingi skanerlashga tayyor. */
  async function kodKirdi(kod: string) {
    const topildi = await savat.kodQoshildi(kod);
    if (topildi) setQidiruv("");
  }

  // Apparat skaner: fokus kiritish maydonida BO'LMAGANDA ishlaydi, shuning
  // uchun kassir qidiruvga yozayotganda harflar aralashib ketmaydi.
  useSkaner((kod) => void kodKirdi(kod));

  async function sot(d: {
    tolovTuri: TolovTuri;
    accountId: string | null;
    contactId: string | null;
    mijozNomi: string | null;
    mijozTel: string | null;
  }) {
    setYuborilmoqda(true);
    setXato(null);
    try {
      const res = await fetch("/api/pos/chek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          satrlar: savat.satrlar.map((s) => ({
            productId: s.productId,
            miqdor: s.miqdor,
            narx: s.birlikNarx,
          })),
          ...d,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      savat.tozala();
      setTolov(false);
      toast({
        message: `${data.raqam}-chek yopildi · ${formatSomLabel(data.jamiSumma)}`,
        tone: "success",
      });
      // Ombor qoldiqlari o'zgardi — sahifa ma'lumoti yangilanadi.
      router.refresh();
      qidiruvRef.current?.focus();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setYuborilmoqda(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
      <MahsulotTori
        mahsulotlar={mahsulotlar}
        kategoriyalar={kategoriyalar}
        qidiruv={qidiruv}
        kategoriya={kategoriya}
        qidiruvRef={qidiruvRef}
        onQidiruv={setQidiruv}
        onKategoriya={setKategoriya}
        onKod={(kod) => void kodKirdi(kod)}
        onTanlandi={savat.qosh}
        onKamera={() => setKamera(true)}
      />

      <Card className="lg:sticky lg:top-4 h-fit">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-fg">Savat</h2>
          {savat.satrlar.length > 0 && (
            <button onClick={savat.tozala} className="text-xs text-muted underline">
              Tozalash
            </button>
          )}
        </div>

        <Savat
          satrlar={savat.satrlar}
          onMiqdor={savat.miqdor}
          onNarx={savat.narx}
          onOchir={savat.ochir}
        />

        <div className="border-t border-line pt-3 mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Jami</span>
            <Money value={savat.jami} size="xl" tone="brand" />
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={savat.satrlar.length === 0}
            onClick={() => {
              setXato(null);
              setTolov(true);
            }}
          >
            To&apos;lovga o&apos;tish
          </Button>
        </div>
      </Card>

      {kamera && (
        <KameraSkaner
          onKod={(kod) => {
            setKamera(false);
            void kodKirdi(kod);
          }}
          onClose={() => setKamera(false)}
          // Kamera ishlamaydigan brauzerda (masalan iPhone Safari) kassir
          // boshi berk ko'chada qolmasin: oyna yopiladi va fokus qidiruv
          // maydoniga qaytadi — u yerdan nom yoki kod bilan davom etadi.
          onFallback={() => {
            setKamera(false);
            qidiruvRef.current?.focus();
          }}
        />
      )}

      {tolov && (
        <TolovModal
          jami={savat.jami}
          kassalar={kassalar}
          yuborilmoqda={yuborilmoqda}
          xato={xato}
          onClose={() => setTolov(false)}
          onTasdiq={sot}
        />
      )}
    </div>
  );
}
