"use client";

import { useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { PulOqimiTafsilot } from "@/components/pul/PulOqimiTafsilot";
import { formatMoneyCompact, formatSomLabel } from "@/lib/format";
import type { TolovTaqsimotiDTO } from "@/lib/queries/tolovTaqsimoti";
import {
  YASHIRIN_COOKIE,
  yashirinMatn,
  type PulKarta,
  type YashirinHolat,
} from "@/lib/pulYashirish";

/**
 * "JAMI KIRIM", "JAMI CHIQIM" va "SOF FOYDA" kartalari.
 *
 * Uchalasi bitta klient komponentda, chunki ikkita narsani bo'lishadi:
 * tafsilot varag'i (qaysi karta bosilgani `ochiq` holatida) va PUL
 * YASHIRISH holati. Qolgan kartalar (Menga qarzdor, Ombor) server
 * komponentida qoladi — ular klient kodiga muhtoj emas.
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
  oyFrom: string;
  oyTo: string;
  oyNomi: string;
  /** Serverda cookie'dan o'qilgan holat — birinchi chizishdayoq to'g'ri. */
  yashirinBoshlangich: YashirinHolat;
}) {
  const [ochiq, setOchiq] = useState<"kirim" | "chiqim" | null>(null);
  const [yashirin, setYashirin] = useState<YashirinHolat>(yashirinBoshlangich);
  const taqsimot = ochiq === "chiqim" ? chiqimTaqsimot : kirimTaqsimot;

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
        yashirin={yashirin.foyda}
        onYashir={() => almashtir("foyda")}
      />

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
