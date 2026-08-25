"use client";

import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import type { KunlikOperatsiyaDTO } from "@/lib/queries/kunlik";
import { soatToshkent } from "./vaqt";

/**
 * KUN LENTASI — "nima bo'ldi" savoliga vaqt tartibida javob.
 *
 * ═══ IKKI TURDAGI QATOR ATAYLAB AJRATILADI ═══
 *   📈 / 📉  BIZNES TRANZAKSIYASI — Jami Kirim/Chiqimga kiradi;
 *   🔄       ICHKI PUL HARAKATI (kassa topshirish) — hisobotga KIRMAYDI,
 *            faqat pulning egasi almashadi.
 * Ilgari bunday ajratish yo'q edi va "7 mln topshirildi" qatori xuddi yangi
 * kirimdek o'qilardi. Vizual farq shu tushunmovchilikning oldini oladi.
 */

const HOLAT_NOMI: Record<string, string> = {
  kutilmoqda: "tasdiq kutmoqda",
  bajarildi: "qabul qilindi",
  rad: "rad etildi",
  bekor: "bekor qilindi",
  arxiv: "arxiv",
};

function Qator({ op }: { op: KunlikOperatsiyaDTO }) {
  const kochish = op.turi === "kochish";
  const kirim = op.turi === "kirim";

  return (
    <li
      className={`py-3 flex items-start justify-between gap-3 ${
        kochish ? "opacity-90" : ""
      }`}
    >
      <div className="min-w-0 flex gap-2.5">
        <span
          className={`shrink-0 w-8 h-8 rounded-full inline-flex items-center justify-center text-sm ${
            kochish
              ? "bg-surface-2 text-muted border border-dashed border-line"
              : kirim
                ? "bg-income-soft text-income-fg"
                : "bg-expense-soft text-expense-fg"
          }`}
          aria-hidden
        >
          {kochish ? "🔄" : kirim ? "📈" : "📉"}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-fg truncate">{op.sarlavha}</p>
          <p className="text-2xs text-faint">
            {soatToshkent(op.vaqt)}
            {op.tolov && <span> · {op.tolov}</span>}
            {op.kim && <span> · {op.kim}</span>}
            {op.holat && <span> · {HOLAT_NOMI[op.holat] ?? op.holat}</span>}
          </p>
          {op.izoh && <p className="text-2xs text-muted truncate">{op.izoh}</p>}
          {kochish && (
            <p className="text-2xs text-faint">Ichki ko&apos;chirish — hisobotga kirmaydi</p>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {kochish ? (
          <Money value={op.summa} size="md" tone="neutral" />
        ) : (
          <Money
            value={kirim ? op.summa : -op.summa}
            size="md"
            tone={kirim ? "income" : "expense"}
            signed
          />
        )}
      </div>
    </li>
  );
}

export function Operatsiyalar({
  operatsiyalar,
  bugungi,
}: {
  operatsiyalar: KunlikOperatsiyaDTO[];
  bugungi: boolean;
}) {
  return (
    <Card>
      <h2 className="font-semibold text-fg mb-1">
        {bugungi ? "Bugungi operatsiyalar" : "Shu kundagi operatsiyalar"}
      </h2>
      <p className="text-2xs text-faint mb-2">
        {operatsiyalar.length} ta yozuv · pul ko&apos;chishlari alohida belgilangan
      </p>

      {operatsiyalar.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Hali operatsiya yo'q"
          description="Kun davomida kiritilgan har bir kirim, chiqim va pul ko'chishi shu yerda ko'rinadi."
        />
      ) : (
        <ul className="divide-y divide-line">
          {operatsiyalar.map((op) => (
            <Qator key={`${op.turi}-${op.id}`} op={op} />
          ))}
        </ul>
      )}
    </Card>
  );
}
