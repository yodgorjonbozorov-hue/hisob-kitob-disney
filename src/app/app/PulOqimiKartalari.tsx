"use client";

import { useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { PulOqimiTafsilot } from "@/components/pul/PulOqimiTafsilot";
import { formatMoneyCompact, formatSomLabel } from "@/lib/format";
import type { TolovTaqsimotiDTO } from "@/lib/queries/tolovTaqsimoti";

/**
 * "JAMI KIRIM" va "JAMI CHIQIM" kartalari — bosiladigan.
 *
 * Ikkalasi bitta klient komponentda, chunki tafsilot varag'i ham bitta:
 * qaysi karta bosilgani `ochiq` holatida saqlanadi. Qolgan kartalar
 * (Sof foyda, Menga qarzdor) server komponentida qoladi — ular klient
 * kodiga muhtoj emas.
 *
 * Taqsimot serverda hisoblanadi va prop sifatida keladi: oyna ochilganda
 * qo'shimcha so'rov ketmaydi va undagi jami kartadagi summa bilan bir xil
 * bo'ladi (ikkalasi ham bitta oy oralig'i va bitta to'plamdan).
 */
export function PulOqimiKartalari({
  kirimSumma,
  chiqimSumma,
  kirimChangePct,
  chiqimChangePct,
  kirimTaqsimot,
  chiqimTaqsimot,
  oyFrom,
  oyTo,
  oyNomi,
}: {
  kirimSumma: number;
  chiqimSumma: number;
  kirimChangePct: number | null;
  chiqimChangePct: number | null;
  kirimTaqsimot: TolovTaqsimotiDTO;
  chiqimTaqsimot: TolovTaqsimotiDTO;
  oyFrom: string;
  oyTo: string;
  oyNomi: string;
}) {
  const [ochiq, setOchiq] = useState<"kirim" | "chiqim" | null>(null);
  const taqsimot = ochiq === "chiqim" ? chiqimTaqsimot : kirimTaqsimot;

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
      />
      <StatCard
        label="Jami chiqim"
        value={formatMoneyCompact(chiqimSumma)}
        title={formatSomLabel(chiqimSumma)}
        changePct={chiqimChangePct}
        goodWhenUp={false}
        accent="expense"
        onClick={() => setOchiq("chiqim")}
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
