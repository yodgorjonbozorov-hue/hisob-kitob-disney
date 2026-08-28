"use client";

import { useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { PulOqimiTafsilot } from "@/components/pul/PulOqimiTafsilot";
import { formatMoneyCompact, formatSomLabel } from "@/lib/format";
import { TOLOV_BOLIMI_NOMI, type TolovBolimi } from "@/lib/tolovBolimi";
import type { TolovTaqsimotiDTO } from "@/lib/queries/tolovTaqsimoti";
import type { KassaXulosa } from "@/lib/queries/dashboardPanel";
import type { QarzJamlariDTO } from "@/lib/queries/qarz";
import {
  YASHIRIN_COOKIE,
  yashirinMatn,
  type PulKarta,
  type YashirinHolat,
} from "@/lib/pulYashirish";

/**
 * BOSH SAHIFANING 5 TA KPI KARTASI: Jami kirim, Jami chiqim, Sof foyda,
 * Kassada, Menga qarzdor.
 *
 * Beshalasi bitta klient komponentda, chunki ikkita narsani bo'lishadi:
 * tafsilot varag'i (qaysi karta bosilgani `ochiq` holatida) va PUL
 * YASHIRISH holati (bitta cookie'ga yoziladi).
 *
 * DAVRLAR ARALASHMAYDI — bu kartalarning eng muhim qoidasi:
 *   kirim/chiqim/foyda — TANLANGAN OY;
 *   kassa va qarz      — JORIY HOLAT (butun davr qoldig'i).
 * Shuning uchun oxirgi ikkitasida "o'tgan oyga nisbatan" foizi ATAYLAB
 * yo'q: qoldiqni oylik oqim bilan taqqoslash matematik jihatdan noto'g'ri.
 *
 * Taqsimot serverda hisoblanadi va prop sifatida keladi: oyna ochilganda
 * qo'shimcha so'rov ketmaydi va undagi jami kartadagi summa bilan bir xil
 * bo'ladi (ikkalasi ham bitta oy oralig'i va bitta to'plamdan).
 */
export function PulOqimiKartalari({
  kirimSumma,
  chiqimSumma,
  sofFoyda,
  kirimChangePct,
  chiqimChangePct,
  foydaChangePct,
  kirimTaqsimot,
  chiqimTaqsimot,
  kassa,
  qarz,
  oyFrom,
  oyTo,
  oyNomi,
  yashirinBoshlangich,
}: {
  kirimSumma: number;
  chiqimSumma: number;
  sofFoyda: number;
  kirimChangePct: number | null;
  chiqimChangePct: number | null;
  foydaChangePct: number | null;
  kirimTaqsimot: TolovTaqsimotiDTO;
  chiqimTaqsimot: TolovTaqsimotiDTO;
  /** Faol kassalar joriy qoldig'i. Kassa ko'rish huquqi yo'q bo'lsa null. */
  kassa: KassaXulosa | null;
  /** Ochiq qarzdorlik. Qarz ko'rish huquqi yo'q bo'lsa null. */
  qarz: QarzJamlariDTO | null;
  oyFrom: string;
  oyTo: string;
  oyNomi: string;
  /** Serverda cookie'dan o'qilgan holat — birinchi chizishdayoq to'g'ri. */
  yashirinBoshlangich: YashirinHolat;
}) {
  const [ochiq, setOchiq] = useState<"kirim" | "chiqim" | null>(null);
  const [yashirin, setYashirin] = useState<YashirinHolat>(yashirinBoshlangich);
  const taqsimot = ochiq === "chiqim" ? chiqimTaqsimot : kirimTaqsimot;

  /*
   * TELEFONDA TARMOQ 2 USTUNLI. Kartalar soni toq bo'lsa oxirgisi yakka
   * qolib, yarim bo'sh qator qoldirardi — shuning uchun u ikkala ustunni
   * egallaydi. Soni huquqlarga qarab o'zgaradi (3, 4 yoki 5), shu bois
   * sinf qotirib yozilmaydi.
   */
  const kartaSoni = 3 + (kassa ? 1 : 0) + (qarz ? 1 : 0);
  const toq = kartaSoni % 2 === 1;
  const oxirgiKeng = toq ? "col-span-2 lg:col-span-1" : "";

  /**
   * Tanlov darhol ekranda, keyin cookie'ga yoziladi.
   *
   * `router.refresh()` ATAYLAB chaqirilmaydi: holat shu yerda turibdi,
   * qayta yuklash faqat sekinlashtirardi. Cookie esa KEYINGI ochilishda
   * server to'g'ri chizishi uchun kerak.
   */
  function almashtir(karta: PulKarta) {
    setYashirin((oldin) => {
      const yangi = { ...oldin, [karta]: !oldin[karta] };
      // Bir yil — tanlov brauzerda qoladi, har kuni qayta bosish shart emas.
      document.cookie = `${YASHIRIN_COOKIE}=${yashirinMatn(yangi)}; path=/; max-age=31536000; samesite=lax`;
      return yangi;
    });
  }

  return (
    <>
      <StatCard
        label="Jami kirim"
        value={formatMoneyCompact(kirimSumma)}
        title={formatSomLabel(kirimSumma)}
        changePct={kirimChangePct}
        goodWhenUp
        accent="income"
        onClick={() => setOchiq("kirim")}
        yashirin={yashirin.kirim}
        onYashir={() => almashtir("kirim")}
      />
      <StatCard
        label="Jami chiqim"
        value={formatMoneyCompact(chiqimSumma)}
        title={formatSomLabel(chiqimSumma)}
        changePct={chiqimChangePct}
        goodWhenUp={false}
        accent="expense"
        onClick={() => setOchiq("chiqim")}
        yashirin={yashirin.chiqim}
        onYashir={() => almashtir("chiqim")}
      />
      <StatCard
        label="Sof foyda"
        value={formatMoneyCompact(sofFoyda)}
        title={formatSomLabel(sofFoyda)}
        changePct={foydaChangePct}
        goodWhenUp
        accent={sofFoyda >= 0 ? "income" : "expense"}
        className={kartaSoni === 3 ? oxirgiKeng : ""}
        yashirin={yashirin.foyda}
        onYashir={() => almashtir("foyda")}
      />

      {/* KASSADA — tarixiy kirim EMAS, barcha faol kassalarning joriy
          qoldig'i (ledgerdan). Kassalar sahifasi bilan bitta hisob. */}
      {kassa && (
        <StatCard
          label="Kassada"
          value={formatMoneyCompact(kassa.jami)}
          title={formatSomLabel(kassa.jami)}
          accent={kassa.jami < 0 ? "expense" : "brand"}
          href="/app/kassa"
          className={!qarz && toq ? oxirgiKeng : ""}
          yashirin={yashirin.kassa}
          onYashir={() => almashtir("kassa")}
        >
          {/* Turlar kesimi O'RALADI, kesilmaydi: "Plastik 153,2 mln · Naqd…"
              ko'rinishi eng muhim ma'lumotni yashirib qo'yardi. */}
          {!yashirin.kassa && kassa.bolimlar.length > 0 && (
            <p className="text-2xs mt-1 tnum text-muted flex flex-wrap gap-x-2 gap-y-0.5">
              {kassa.bolimlar.map((b) => (
                <span key={b.turi} className="whitespace-nowrap">
                  {kassaTuriNomi(b.turi)}{" "}
                  <span className={b.qoldiq < 0 ? "text-expense font-medium" : "text-fg"}>
                    {formatMoneyCompact(b.qoldiq)}
                  </span>
                </span>
              ))}
            </p>
          )}
        </StatCard>
      )}

      {/* MENGA QARZDOR — joriy ochiq qarzlar qoldig'i. Raqam har yuklashda
          yozuvlardan qayta hisoblanadi (qo'lda yuritiladigan "balans" yo'q). */}
      {qarz && (
        <StatCard
          label="Menga qarzdor"
          value={formatMoneyCompact(qarz.olinadigan)}
          title={formatSomLabel(qarz.olinadigan)}
          accent={qarz.olinadigan > 0 ? "debt" : "neutral"}
          href="/app/qarzlar?turi=olinadigan"
          className={oxirgiKeng}
          yashirin={yashirin.qarz}
          onYashir={() => almashtir("qarz")}
        >
          <p className="text-2xs mt-1 tnum text-muted">{qarz.olinadiganSoni} ta qarzdor</p>
          {!yashirin.qarz && qarz.beriladigan > 0 && (
            <p className="text-2xs mt-0.5 tnum text-muted truncate">
              Men qarzdorman:{" "}
              <span className="font-medium text-expense">
                {formatMoneyCompact(qarz.beriladigan)}
              </span>{" "}
              · {qarz.beriladiganSoni} ta
            </p>
          )}
        </StatCard>
      )}

      {ochiq && (
        <PulOqimiTafsilot
          taqsimot={taqsimot}
          oyFrom={oyFrom}
          oyTo={oyTo}
          oyNomi={oyNomi}
          onClose={() => setOchiq(null)}
        />
      )}
    </>
  );
}

/**
 * Kassa TURI yorlig'i. `Account.turi` ("naqd" | "plastik" | "bank") to'lov
 * bo'limlari lug'ati bilan bir xil nomlanadi — foydalanuvchi uchun ikki xil
 * atama bo'lmasin. Noma'lum tur (kelajakda qo'shilsa) o'z kodi bilan chiqadi.
 */
function kassaTuriNomi(turi: string): string {
  return TOLOV_BOLIMI_NOMI[turi as TolovBolimi] ?? turi;
}
