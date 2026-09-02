"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { KassaDavr } from "@/lib/kassaDavr";
import type { TransferDTO } from "@/lib/queries/accounts";
import type { KassaNazorat, KassaNazoratKarta } from "@/lib/queries/kassaNazorat";
import { QoldiqHero } from "./QoldiqHero";
import { KutilayotganPanel } from "./KutilayotganPanel";
import { KassaKarta } from "./KassaKarta";
import { HarakatlarPaneli } from "./HarakatlarPaneli";
import { SozlamalarPanel } from "./SozlamalarPanel";
import { AmalTugma } from "./AmalTugma";
import { TransferModal } from "./TransferModal";
import { TopshirishModal } from "./TopshirishModal";
import { KassaModal } from "./KassaModal";
import type { KartaAmal } from "./KartaMenyu";

type Oyna =
  | { tur: "transfer"; fromId: string | null }
  | { tur: "topshirish"; fromId: string | null }
  | { tur: "kassa"; kassa: KassaNazoratKarta | null }
  | null;

/**
 * KASSALAR — PUL NAZORATI MARKAZI.
 *
 * Bloklar tartibi savollarning DOLZARBLIGI bo'yicha: avval jami qoldiq va
 * bugungi harakat (har kuni kerak), keyin harakat talab qiladigan
 * topshirishlar, so'ng kassalar, tarix va oxirida sozlamalar.
 *
 * ═══ HUQUQ ═══
 * Bu ekran faqat "kassa.jami" huquqi bilan ochiladi (sahifa serverda
 * tekshiradi): barcha kassalar, jami pul va bugungi biznes kesimi — direktor
 * darajasi. Oddiy xodim bu yerga tushmaydi, u "Mening kassam"da faqat o'z
 * kassasini ko'radi.
 * Amallar esa huquq bilan qulflanadi: o'tkazma va topshirish "pul.berish",
 * qaror "pul.qabul", kassa ochish/tahrirlash faqat boshqaruvchida. Bu
 * yerdagi bayroqlar shunchaki ishlamaydigan tugmani ko'rsatmaydi — HAR
 * amalni server mustaqil tekshiradi (frontendda tugmani yashirish
 * xavfsizlik emas).
 */
export function KassaClient({
  nazorat,
  harakatlar,
  davr,
  meniUserId,
  boshqaruvchi,
  transferQila,
  qabulQila,
  businessId,
  shaxsiyKassa,
}: {
  nazorat: KassaNazorat;
  harakatlar: TransferDTO[];
  davr: KassaDavr;
  meniUserId: string;
  boshqaruvchi: boolean;
  /** "pul.berish" — o'tkazma va topshirish yaratish. */
  transferQila: boolean;
  /** "pul.qabul" — kutilayotgan topshiriq bo'yicha qaror. */
  qabulQila: boolean;
  businessId: string;
  shaxsiyKassa: boolean;
}) {
  const router = useRouter();
  const [oyna, setOyna] = useState<Oyna>(null);

  const faollar = nazorat.kartalar.filter((k) => k.isActive);
  const meniKassam = nazorat.kartalar.find((k) => k.userId === meniUserId && k.isActive) ?? null;
  const otkazaOladi = transferQila && faollar.length >= 2;

  /** Shu kassadan pul chiqarishga haqqi bormi (server qoidasining nusxasi). */
  function manbaBolaOladi(k: KassaNazoratKarta): boolean {
    return k.isActive && (!k.userId || k.userId === meniUserId || boshqaruvchi);
  }
  const manbalar = faollar.filter(manbaBolaOladi);
  const topshiraOladi = transferQila && faollar.length >= 2 && manbalar.some((k) => k.mavjud > 0);

  function yopVaYangila() {
    setOyna(null);
    router.refresh();
  }

  function kartaAmallari(k: KassaNazoratKarta): KartaAmal[] {
    const amallar: KartaAmal[] = [
      { label: "Batafsil", onClick: () => router.push(`/app/kassa/${k.id}`) },
    ];
    if (otkazaOladi && manbaBolaOladi(k)) {
      amallar.push({
        label: "Pul o'tkazish",
        onClick: () => setOyna({ tur: "transfer", fromId: k.id }),
      });
    }
    if (topshiraOladi && manbaBolaOladi(k) && k.mavjud > 0) {
      amallar.push({
        label: "Kassani topshirish",
        onClick: () => setOyna({ tur: "topshirish", fromId: k.id }),
      });
    }
    if (boshqaruvchi) {
      amallar.push({ label: "Tahrirlash", onClick: () => setOyna({ tur: "kassa", kassa: k }) });
    }
    return amallar;
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <QoldiqHero
        jamiQoldiq={nazorat.jamiQoldiq}
        turBoyicha={nazorat.turBoyicha}
        bugungiKirim={nazorat.bugungiKirim}
        bugungiChiqim={nazorat.bugungiChiqim}
        bugungiSof={nazorat.bugungiSof}
        kutilayotganSoni={nazorat.kutilayotganlar.length}
        amallar={
          <>
            {transferQila && (
              <Button
                variant="secondary"
                onClick={() => setOyna({ tur: "transfer", fromId: meniKassam?.id ?? null })}
                disabled={!otkazaOladi}
              >
                Pul o&apos;tkazish
              </Button>
            )}
            {transferQila && (
              <Button
                variant="secondary"
                onClick={() => setOyna({ tur: "topshirish", fromId: meniKassam?.id ?? null })}
                disabled={!topshiraOladi}
              >
                Kassani topshirish
              </Button>
            )}
            {boshqaruvchi && (
              <Button onClick={() => setOyna({ tur: "kassa", kassa: null })}>Yangi kassa</Button>
            )}
          </>
        }
      />

      {transferQila && faollar.length < 2 && (
        <p className="text-2xs text-faint px-1">
          Pul o&apos;tkazish uchun kamida 2 ta faol kassa kerak.
        </p>
      )}

      <KutilayotganPanel
        transferlar={nazorat.kutilayotganlar}
        meniUserId={meniUserId}
        boshqaruvchi={boshqaruvchi}
        qabulQila={qabulQila}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {nazorat.kartalar.map((k) => (
          <KassaKarta
            key={k.id}
            kassa={k}
            meniki={k.userId === meniUserId}
            amallar={kartaAmallari(k)}
          />
        ))}
      </div>

      <HarakatlarPaneli harakatlar={harakatlar} davr={davr} />

      {boshqaruvchi && (
        <SozlamalarPanel businessId={businessId} shaxsiyKassa={shaxsiyKassa} />
      )}

      <AmalTugma
        amallar={[
          {
            label: "Pul o'tkazish",
            izoh: "Kassadan kassaga",
            ochiq: transferQila,
            sabab: otkazaOladi ? undefined : "Kamida 2 ta faol kassa kerak",
            onClick: () => setOyna({ tur: "transfer", fromId: meniKassam?.id ?? null }),
          },
          {
            label: "Kassani topshirish",
            izoh: "Smena oxirida pulni topshirish",
            ochiq: transferQila,
            sabab: topshiraOladi ? undefined : "Topshiriladigan pul yo'q",
            onClick: () => setOyna({ tur: "topshirish", fromId: meniKassam?.id ?? null }),
          },
          {
            label: "Yangi kassa",
            izoh: "Naqd, plastik yoki bank hisobi",
            ochiq: boshqaruvchi,
            onClick: () => setOyna({ tur: "kassa", kassa: null }),
          },
        ]}
      />

      {oyna?.tur === "transfer" && (
        <TransferModal
          kassalar={faollar}
          boshlangichId={
            oyna.fromId && manbalar.some((k) => k.id === oyna.fromId) ? oyna.fromId : null
          }
          meniKassam={meniKassam?.id ?? null}
          onClose={() => setOyna(null)}
          onDone={yopVaYangila}
        />
      )}
      {oyna?.tur === "topshirish" && (
        <TopshirishModal
          kassalar={manbalar.filter((k) => k.mavjud > 0)}
          boshlangichId={oyna.fromId}
          nishonlar={faollar}
          onClose={() => setOyna(null)}
          onDone={yopVaYangila}
        />
      )}
      {oyna?.tur === "kassa" && (
        <KassaModal
          kassa={oyna.kassa}
          onClose={() => setOyna(null)}
          onDone={yopVaYangila}
        />
      )}
    </div>
  );
}
