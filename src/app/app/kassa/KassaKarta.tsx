"use client";

import Link from "next/link";
import { Money } from "@/components/ui/Money";
import { formatSom, formatRelative, formatToshkentSoat } from "@/lib/format";
import { ACCOUNT_TURI_NOMI, type AccountTuri } from "@/lib/validation/account";
import type { KassaNazoratKarta } from "@/lib/queries/kassaNazorat";
import { KartaMenyu, type KartaAmal } from "./KartaMenyu";

/** Kassa turi belgisi — ro'yxatda darrov ajralib tursin. */
const TURI_BELGI: Record<string, string> = { naqd: "💵", plastik: "💳", bank: "🏦" };

/**
 * BITTA KASSA KARTASI — pul nazorati birligi.
 *
 * Ierarxiya ataylab qat'iy: eng katta element — JORIY QOLDIQ, chunki sahifani
 * ochgan odamning birinchi savoli "bu kassada hozir qancha pul bor". Smena
 * kirim/chiqim undan kichik, o'tkazma qatori esa eng past darajada — u
 * kamdan-kam bo'ladi va faqat bo'lganda ko'rinadi.
 *
 * ═══ JORIY SMENA ═══
 * Kirim/chiqim/sof — shu kassadan OXIRGI TOPSHIRISHDAN beri (topshirilmagan
 * kassada bugundan). Kassa topshirilgan zahoti bu raqamlar 0 dan boshlanadi;
 * direktor "topshirishdan keyin qancha yig'ildi"ni aynan shu yerda ko'radi.
 *
 * O'tkazma AYRIM qatorda: u kirim ham, chiqim ham emas (biznes hisobotiga
 * qo'shilmaydi), lekin kassaning qoldig'ini o'zgartiradi. Bir qatorga
 * qo'shib yuborilsa "5 mln kirdi, qoldiq nega 2 mln" degan savol
 * javobsiz qolardi.
 */
export function KassaKarta({
  kassa,
  meniki,
  amallar,
}: {
  kassa: KassaNazoratKarta;
  /** Shu kassa joriy foydalanuvchiniki — ajratib ko'rsatiladi. */
  meniki: boolean;
  /** "⋯" menyusidagi amallar (huquqqa qarab sahifa tayyorlaydi). */
  amallar: KartaAmal[];
}) {
  const transferBor = kassa.smenaKirgan > 0 || kassa.smenaChiqqan > 0;

  return (
    <article
      className={`relative flex flex-col bg-surface border rounded-2xl p-4 sm:p-5 shadow-card transition ${
        meniki ? "border-brand" : "border-line"
      } ${kassa.isActive ? "" : "opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/app/kassa/${kassa.id}`}
          className="min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <p className="text-sm font-semibold text-fg truncate">
            {kassa.userId ? "👤" : (TURI_BELGI[kassa.turi] ?? "💰")} {kassa.nomi}
          </p>
          <p className="text-2xs text-faint mt-0.5 truncate">
            {kassa.userId
              ? `Shaxsiy · ${kassa.egaIsm ?? "egasi o'chirilgan"}`
              : (ACCOUNT_TURI_NOMI[kassa.turi as AccountTuri] ?? kassa.turi)}
          </p>
        </Link>
        <KartaMenyu amallar={amallar} yorliq={kassa.nomi} />
      </div>

      <Link
        href={`/app/kassa/${kassa.id}`}
        className="block mt-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Money value={kassa.qoldiq} size="xl" tone={kassa.qoldiq >= 0 ? "neutral" : "expense"} />
      </Link>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {meniki && (
          <span className="rounded-full bg-brand-wash text-brand px-2 py-0.5 text-2xs font-medium">
            Sizniki
          </span>
        )}
        {kassa.topshirishKutmoqda && (
          <span className="rounded-full bg-debt-soft text-debt-fg px-2 py-0.5 text-2xs font-medium">
            Topshirish kutilmoqda
          </span>
        )}
        {!kassa.isActive && (
          <span className="rounded-full bg-surface-2 text-muted px-2 py-0.5 text-2xs font-medium">
            Nofaol
          </span>
        )}
      </div>

      <dl className="mt-3 pt-3 border-t border-line space-y-1.5 text-2xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-faint">Joriy smena</dt>
          <dd className="text-faint truncate">
            {kassa.smenaTopshirishdan
              ? `topshirishdan (${formatToshkentSoat(new Date(kassa.smenaBoshi))})`
              : "bugundan"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted">Kirim</dt>
          <dd className="tnum font-medium text-income">+ {formatSom(kassa.smenaKirim)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted">Chiqim</dt>
          <dd className="tnum font-medium text-expense">− {formatSom(kassa.smenaChiqim)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted">Sof</dt>
          <dd
            className={`tnum font-semibold ${
              kassa.smenaSof > 0 ? "text-income" : kassa.smenaSof < 0 ? "text-expense" : "text-fg"
            }`}
          >
            {kassa.smenaSof > 0 ? "+ " : kassa.smenaSof < 0 ? "− " : ""}
            {formatSom(Math.abs(kassa.smenaSof))}
          </dd>
        </div>
        {transferBor && (
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-line">
            <dt className="text-faint">Smena o&apos;tkazmasi</dt>
            <dd className="tnum text-muted">
              {kassa.smenaKirgan > 0 && `+${formatSom(kassa.smenaKirgan)}`}
              {kassa.smenaKirgan > 0 && kassa.smenaChiqqan > 0 && " · "}
              {kassa.smenaChiqqan > 0 && `−${formatSom(kassa.smenaChiqqan)}`}
            </dd>
          </div>
        )}
      </dl>

      {(kassa.kutilayotganChiqim > 0 || kassa.oxirgiTopshirish) && (
        <p className="mt-2 text-2xs text-faint">
          {kassa.kutilayotganChiqim > 0
            ? `${formatSom(kassa.kutilayotganChiqim)} soʻm tasdiq kutmoqda · mavjud ${formatSom(kassa.mavjud)}`
            : `Oxirgi topshirish: ${formatRelative(new Date(kassa.oxirgiTopshirish!))}`}
        </p>
      )}
    </article>
  );
}
