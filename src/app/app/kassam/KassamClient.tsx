"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatSom, formatToshkentVaqt } from "@/lib/format";
import type { KassaHarakat } from "@/lib/queries/kassaDetal";
import {
  SmenaTopshirishModal,
  type TopshirishNishoni,
} from "@/components/kassa/SmenaTopshirishModal";

/**
 * MENING KASSAM — xodimning o'z kassasidagi pul.
 *
 * Raqam ledgerdan keladi (Transaction + AccountTransfer), ya'ni Kassalar
 * sahifasidagi bilan AYNI manba. Bu yerda FAQAT o'z kassasi ko'rinadi —
 * boshqa xodimlarning kassasi va biznesning jami puli emas (kassa maxfiyligi).
 *
 * ═══ TOPSHIRISH IKKI BOSQICHLI ═══
 * "Smenani topshirish" pulni kassadan DARHOL yechmaydi: topshiriq
 * "Qabul kutilmoqda" holatida turadi va pul xodimning kassasida qoladi
 * ("Kassangizdagi pul" o'zgarmaydi). Faqat direktor "Qabul qilish"ni
 * bosgach pul uning kassasiga o'tadi va bu yerdagi raqam kamayadi.
 *
 * Shu sababli ikkita raqam bor: `qoldiq` — kassadagi haqiqiy pul (katta
 * raqam), `mavjud` — undan tasdiq kutayotgan summa ayrilgani, ya'ni YANGI
 * topshirish uchun band bo'lmagan qism. Bir summani ikki marta topshirish
 * aynan shu ayirma bilan to'siladi (`lib/services/kassaTransfer.ts`).
 *
 * ═══ JORIY SMENA ═══
 * Kirim / chiqim / sof — oxirgi topshirishdan beri. Kassa topshirilgan
 * zahoti ular 0 dan boshlanadi (smena YOPILDI), lekin bu pulning ko'chgani
 * DEGANI EMAS — yuqoridagi izohga qarang. Topshirish tarixi pastdagi
 * lentada saqlanadi.
 */
export function KassamClient({
  accountId,
  qoldiq,
  mavjud,
  kutilayotganChiqim,
  smenaKirim,
  smenaChiqim,
  smenaBoshi,
  smenaTopshirishdan,
  harakatlar,
  nishonlar,
  ochiqTopshirish,
}: {
  accountId: string;
  /**
   * KASSADAGI PUL — ledger qoldig'i. Topshirilgan, lekin hali QABUL
   * QILINMAGAN summa bundan AYRILMAYDI: pul haqiqatda hali xodimning
   * qo'lida va direktor uni sanab olmagan.
   */
  qoldiq: number;
  /** Yangi topshirish uchun BAND BO'LMAGAN qism: qoldiq − kutilayotgan. */
  mavjud: number;
  /** Topshirilgan, hali qabul qilinmagan summa. */
  kutilayotganChiqim: number;
  smenaKirim: number;
  smenaChiqim: number;
  /** Joriy smena boshi (ISO) — topshirishdan yoki kun boshidan. */
  smenaBoshi: string;
  smenaTopshirishdan: boolean;
  harakatlar: KassaHarakat[];
  /** Kimga topshirish mumkin — boshqa faol kassalar (nomlar, summasiz). */
  nishonlar: TopshirishNishoni[];
  /** Tasdiq kutayotgan mening topshirishim (bo'lsa). */
  ochiqTopshirish: { summa: number; kimga: string; vaqt: string } | null;
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const smenaSof = smenaKirim - smenaChiqim;

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-sm text-muted">Kassangizdagi pul</p>
        <Money value={qoldiq} size="display" tone={qoldiq > 0 ? "brand" : qoldiq < 0 ? "expense" : "neutral"} />

        {ochiqTopshirish && (
          <div className="mt-2 rounded-lg bg-debt-soft px-3 py-2">
            <p className="text-xs font-medium text-debt-fg">⏳ Qabul kutilmoqda</p>
            <p className="text-2xs text-debt-fg mt-0.5">
              <span className="tnum font-medium">{formatSom(ochiqTopshirish.summa)}</span> soʻm{" "}
              {ochiqTopshirish.kimga}ga topshirildi (
              {formatToshkentVaqt(new Date(ochiqTopshirish.vaqt))}). Pul qabul qilinmaguncha
              kassangizda turaveradi — hisob faqat direktor &quot;Qabul qilish&quot;ni
              bosgandan keyin yopiladi.
            </p>
          </div>
        )}
        {!ochiqTopshirish && kutilayotganChiqim > 0 && (
          <p className="text-2xs text-debt mt-2">
            {formatSom(kutilayotganChiqim)} soʻm o&apos;tkazmada tasdiq kutmoqda — qabul
            qilinmaguncha qayta topshirib bo&apos;lmaydi.
          </p>
        )}

        <p className="text-2xs text-faint mt-4">
          Joriy smena ·{" "}
          {smenaTopshirishdan
            ? `oxirgi topshirishdan (${formatToshkentVaqt(new Date(smenaBoshi))})`
            : "bugundan"}
        </p>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 pt-3 border-t border-line">
          <div>
            <dt className="text-2xs text-muted">Kirim</dt>
            <dd><Money value={smenaKirim} size="md" tone="income" /></dd>
          </div>
          <div>
            <dt className="text-2xs text-muted">Chiqim</dt>
            <dd><Money value={smenaChiqim} size="md" tone="expense" /></dd>
          </div>
          <div>
            <dt className="text-2xs text-muted">Sof</dt>
            <dd>
              <Money
                value={smenaSof}
                size="md"
                tone={smenaSof > 0 ? "income" : smenaSof < 0 ? "expense" : "neutral"}
              />
            </dd>
          </div>
          <div>
            {/* Topshirilishi kerak = hali topshirilmagan qism. Tasdiq
                kutayotgan summa bu yerdan AYRILADI — u allaqachon
                topshirilgan, faqat qabul qilinmagan. */}
            <dt className="text-2xs text-muted">Topshirilishi kerak</dt>
            <dd><Money value={Math.max(mavjud, 0)} size="md" tone="neutral" /></dd>
          </div>
        </dl>

        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => setModal(true)}
            disabled={mavjud <= 0 || nishonlar.length === 0 || !!ochiqTopshirish}
          >
            Smenani topshirish
          </Button>
          <Link
            href={`/app/kassa/${accountId}`}
            className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-muted hover:text-fg"
          >
            To&apos;liq tarix
          </Link>
        </div>
        {nishonlar.length === 0 && (
          <p className="text-2xs text-faint mt-2">
            Topshirish uchun boshqa faol kassa yo&apos;q — direktor bilan bog&apos;laning.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-fg mb-3">So&apos;nggi harakatlar</h2>
        {harakatlar.length === 0 ? (
          <EmptyState
            icon="💵"
            title="Hali harakat yo'q"
            description="Naqd yozuv kiritsangiz yoki sizga pul o'tkazilsa — shu yerda ko'rinadi."
          />
        ) : (
          <ul className="divide-y divide-line">
            {harakatlar.map((h) => (
              <li key={`${h.turi}-${h.id}`} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-fg truncate">{h.matn}</p>
                  <p className="text-2xs text-faint">{formatToshkentVaqt(new Date(h.vaqt))}</p>
                </div>
                <p
                  className={`text-sm font-semibold tnum shrink-0 ${
                    h.summa >= 0 ? "text-income" : "text-expense"
                  }`}
                >
                  {h.summa >= 0 ? "+" : "−"}
                  {Math.abs(h.summa).toLocaleString("ru-RU")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {modal && (
        <SmenaTopshirishModal
          qoldiq={mavjud}
          nishonlar={nishonlar}
          onClose={() => setModal(false)}
          onDone={() => {
            setModal(false);
            // Server komponenti qayta o'qiladi — joriy smena 0 bo'lib chiqadi
            // (klient holati emas, backend hisobi).
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
