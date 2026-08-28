"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { KunlikDirektorDTO, KunlikHolatDTO } from "@/lib/queries/kunlik";
import type { KunlikRuxsat } from "@/lib/services/kunlik";
import { HOLAT_KORINISHI } from "./holat";
import { sanaSur, sanaUz } from "./vaqt";

/**
 * KUNLIK HISOBOT SARLAVHASI — sana, holat va kun bo'ylab yurish.
 *
 * Mobil ko'rinish DESKTOPNING KICHRAYTIRILGANI EMAS: telefonda sarlavha va
 * holat ustma-ust turadi (raqam bilan bellashmaydi), sana o'qlari esa 44px
 * nishonli tugmalar bo'lib qatorning ikki chekkasida qoladi — bosh barmoq
 * bilan yetib boradigan joyda.
 */
export function KunlikSarlavha({
  sana,
  holat,
  bugun,
  ruxsat,
  direktor,
  onDirektor,
}: {
  sana: string;
  holat: KunlikHolatDTO;
  bugun: string;
  ruxsat: KunlikRuxsat;
  direktor: KunlikDirektorDTO;
  onDirektor: () => void;
}) {
  const router = useRouter();
  const bugungi = sana === bugun;
  const kor = HOLAT_KORINISHI[holat];
  const yur = (kun: number) => router.push(`/app/kunlik?sana=${sanaSur(sana, kun)}`);

  const oq = (yonalish: -1 | 1, belgi: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => yur(yonalish)}
      aria-label={label}
      className="shrink-0 w-11 h-11 inline-flex items-center justify-center rounded-xl border border-line bg-surface-2 text-muted hover:text-fg hover:border-brand transition"
    >
      {belgi}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-fg tracking-tight-display">
            Kunlik hisobot
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {sanaUz(sana)}
            {bugungi && <span className="text-faint"> · bugun</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${kor.klass}`}
          >
            {kor.belgi} {kor.nomi}
          </span>
          {ruxsat.tarixniKoradi && (
            <Link
              href="/app/kunlik/tarix"
              className="text-sm text-brand hover:underline whitespace-nowrap"
            >
              Tarix
            </Link>
          )}
        </div>
      </div>

      <p className="text-2xs text-faint">{kor.izoh}</p>

      {ruxsat.tarixniKoradi && (
        <div className="flex items-center gap-2">
          {oq(-1, <ChevronLeft className="w-5 h-5" aria-hidden />, "Oldingi kun")}
          {!bugungi && oq(1, <ChevronRight className="w-5 h-5" aria-hidden />, "Keyingi kun")}
          {!bugungi && (
            <button
              type="button"
              onClick={() => router.push("/app/kunlik")}
              className="text-sm text-brand hover:underline px-1"
            >
              Bugunga qaytish
            </button>
          )}
        </div>
      )}

      {/* DIREKTOR TAYINLANMAGAN — foydalanuvchini noaniq holatda qoldirmaymiz.
          Sozlash tugmasi FAQAT huquqi borga ko'rinadi; qolganlarga esa
          nima bo'layotgani tushuntiriladi. */}
      {!direktor.direktorId && (
        <div className="rounded-xl border border-line bg-debt-soft/40 p-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-debt-fg">
            ⚠ Direktor tayinlanmagan.{" "}
            <span className="text-muted">
              {ruxsat.boshqaruvchimi
                ? "Kun yakunini hozircha boshqaruvchi tasdiqlaydi va pul umumiy kassaga o'tadi."
                : "Kun yakunini hozircha boshqaruvchi tasdiqlaydi."}
            </span>
          </p>
          {ruxsat.boshqaruvchimi && (
            <button
              type="button"
              onClick={onDirektor}
              className="shrink-0 min-h-[44px] px-4 rounded-lg bg-surface border border-line text-sm font-medium text-fg hover:border-brand transition"
            >
              Sozlash
            </button>
          )}
        </div>
      )}

      {direktor.direktorId && ruxsat.boshqaruvchimi && (
        <button
          type="button"
          onClick={onDirektor}
          className="text-2xs text-faint hover:text-brand hover:underline"
        >
          Direktor: {direktor.direktorIsm ?? "—"} · o&apos;zgartirish
        </button>
      )}
    </div>
  );
}
