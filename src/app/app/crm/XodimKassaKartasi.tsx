"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { formatSom } from "@/lib/format";
import { SmenaTopshirishModal } from "@/components/kassa/SmenaTopshirishModal";
import type { XodimKassaDTO } from "@/lib/crm/yuqoriPanel";

/**
 * XODIM KASSASI — buyurtmalar sahifasining 1-bloki.
 *
 * Xodim shu yerdan chiqmasdan o'z kassasini ko'radi va topshiradi. Raqam
 * Account ledgeridan ("Mening kassam" bilan AYNI manba), topshirish esa
 * MAVJUD `SmenaTopshirishModal` orqali — parallel kassa hisobi YO'Q.
 *
 * ═══ NEGA HUQUQ TEKSHIRILMAYDI ═══
 * "Barcha kassalar va jami summani ko'rish" (`kassa.jami`) huquqi BIZNESNING
 * umumiy kassasini yopadi. Xodimning O'Z kassasi esa yopilmaydi: u kun
 * oxirida shu pulni topshirishi kerak. Bu yerda faqat o'z kassasi va boshqa
 * kassalarning NOMI (summasiz) ko'rinadi.
 */
export function XodimKassaKartasi({
  kassa,
  onYangilandi,
}: {
  kassa: XodimKassaDTO | null;
  /** Topshirilgandan keyin panelni qayta o'qish. */
  onYangilandi: () => void;
}) {
  const [modal, setModal] = useState(false);

  if (!kassa) {
    return (
      <section className="bg-surface rounded-2xl border border-line p-4 space-y-2">
        <h2 className="font-semibold text-fg">Xodim kassasi</h2>
        <p className="text-sm text-muted">
          Sizda shaxsiy kassa ochilmagan — naqd pul biznesning umumiy kassasiga tushmoqda.
          Direktor <span className="text-fg font-medium">Kassalar → Shaxsiy kassa rejimi</span> ni
          yoqsa, har xodimga o&apos;z kassasi ochiladi.
        </p>
      </section>
    );
  }

  // Topshirish chegarasi — BAND BO'LMAGAN qism (`mavjud`), ko'rsatiladigan
  // raqam esa kassadagi haqiqiy pul. Ikkisi ajratilgani uchun bir summani
  // ikki marta topshirib bo'lmaydi, lekin kassa ham sun'iy nolga tushmaydi.
  const topshirolmaydi = kassa.mavjud <= 0 || kassa.nishonlar.length === 0 || !!kassa.ochiqTopshirish;

  return (
    <section className="bg-surface rounded-2xl border border-line p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-fg">Xodim kassasi</h2>
        <p className="text-sm text-muted">{kassa.ism}</p>
      </div>

      <dl className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-sm text-muted">Kirim</dt>
          <dd><Money value={kassa.kirim} size="md" tone="income" /></dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-sm text-muted">Chiqim</dt>
          <dd><Money value={kassa.chiqim} size="md" tone="expense" /></dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-t border-line pt-2">
          <dt className="text-sm font-medium text-fg">Kassada</dt>
          <dd>
            <Money
              value={kassa.kassada}
              size="xl"
              tone={kassa.kassada > 0 ? "brand" : kassa.kassada < 0 ? "expense" : "neutral"}
            />
          </dd>
        </div>
      </dl>

      {kassa.ochiqTopshirish && (
        <p className="text-2xs text-debt-fg bg-debt-soft rounded-lg px-2.5 py-1.5">
          ⏳ Qabul kutilmoqda:{" "}
          <span className="tnum font-medium">{formatSom(kassa.ochiqTopshirish.summa)}</span> soʻm{" "}
          {kassa.ochiqTopshirish.kimga}ga topshirildi. Qabul qilinmaguncha pul kassangizda
          turaveradi.
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button onClick={() => setModal(true)} disabled={topshirolmaydi}>
          Kassa topshirish
        </Button>
        <Link
          href={`/app/kassa/${kassa.accountId}`}
          className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-muted hover:text-fg"
        >
          Tarix
        </Link>
      </div>
      {kassa.nishonlar.length === 0 && (
        <p className="text-2xs text-faint">
          Topshirish uchun boshqa faol kassa yo&apos;q — direktor bilan bog&apos;laning.
        </p>
      )}

      {modal && (
        <SmenaTopshirishModal
          sarlavha="Kassa topshirish"
          qoldiq={kassa.mavjud}
          nishonlar={kassa.nishonlar}
          onClose={() => setModal(false)}
          onDone={() => {
            setModal(false);
            onYangilandi();
          }}
        />
      )}
    </section>
  );
}
