"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney, formatDateUZ } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { KirimTasdiq } from "./KirimTasdiq";
import { BuyurtmaTahrir } from "./BuyurtmaTahrir";
import { ZakazXodimlariBlok } from "./ZakazXodimlari";
import {
  kirimHavolasi,
  type BuyurtmaDTO,
  type KategoriyaDTO,
  type StageDTO,
  type XodimKategoriyaDTO,
  type ZakazXodimDTO,
} from "./turlar";

interface ActivityDTO {
  id: string;
  turi: string;
  matn: string;
  createdAt: string;
}

/**
 * Buyurtma tafsiloti: holat ko'chirish (drag'ga mobil muqobil), kirimga
 * o'tkazish, tez izoh va timeline.
 */
export function BuyurtmaSheet({
  b,
  stages,
  kategoriyalar,
  xodimKategoriyalari,
  onKochirish,
  onTahrirlandi,
  onClose,
}: {
  b: BuyurtmaDTO;
  stages: StageDTO[];
  /** Kirim modulining kategoriyalari — tahrirlash uchun (CRM alohida ro'yxat yuritmaydi). */
  kategoriyalar: KategoriyaDTO[];
  /** Xodim kategoriyalari (Sotuvchi/Diktor/...) — biriktiruv tahriri uchun. */
  xodimKategoriyalari: XodimKategoriyaDTO[];
  onKochirish: (s: StageDTO) => void;
  onTahrirlandi: (yangi: { categoryId: string; kategoriya: string; summa: number }) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityDTO[] | null>(null);
  const [zakazXodimlar, setZakazXodimlar] = useState<ZakazXodimDTO[] | null>(null);
  const [izoh, setIzoh] = useState("");
  const [tasdiq, setTasdiq] = useState(false);
  const kirimBor = Boolean(b.transactionId);

  const yuklash = useCallback(async () => {
    const res = await fetch(`/api/crm/deals/${b.id}`);
    if (res.ok) {
      const data = await res.json();
      setActivities(data.activities ?? []);
      setZakazXodimlar(data.xodimlar ?? []);
    }
  }, [b.id]);

  useEffect(() => {
    void yuklash();
  }, [yuklash]);

  async function vazifaYaratish() {
    const nomi = prompt("Vazifa nomi:", `${b.nomi} — keyingi qadam`);
    if (!nomi?.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomi: nomi.trim(), dealId: b.id }),
    });
    alert(res.ok ? "Vazifa yaratildi — Vazifalar bo'limida ko'rasiz." : (await res.json()).error ?? "Vazifa yaratilmadi");
  }

  async function izohYuborish(e: React.FormEvent) {
    e.preventDefault();
    if (!izoh.trim()) return;
    const res = await fetch(`/api/crm/deals/${b.id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turi: "izoh", matn: izoh }),
    });
    if (res.ok) {
      setIzoh("");
      await yuklash();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-line p-5 space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="space-y-1">
          {b.kategoriya && (
            <p className="text-2xs font-semibold text-brand uppercase tracking-wide">{b.kategoriya}</p>
          )}
          <h2 className="font-semibold text-fg text-lg">{b.nomi}</h2>
          <p className="text-sm text-muted">
            {b.kontakt ?? "Mijozsiz"}
            {b.tel ? ` · ${b.tel}` : ""}
          </p>
          <p className="text-sm text-fg tnum">
            {b.summa > 0 ? formatMoney(b.summa) : "Narx kiritilmagan"}
            {b.sana ? ` · ${formatDateUZ(new Date(b.sana))}` : ""}
          </p>
          {b.masulIsm && <p className="text-xs text-faint">Mas&apos;ul: {b.masulIsm}</p>}
          {b.izoh && <p className="text-xs text-muted whitespace-pre-line pt-1">{b.izoh}</p>}
        </div>

        {/* Kategoriya/narx — faqat kirim yozilmagan buyurtmada (server ham
            o'sha paytdan boshlab ikkalasini qulflaydi). */}
        {!kirimBor && (
          <BuyurtmaTahrir b={b} kategoriyalar={kategoriyalar} onSaqlandi={onTahrirlandi} />
        )}

        {/* Zakazdagi xodimlar (4-talab): ro'yxat + kirim yozilmaguncha tahrir. */}
        <ZakazXodimlariBlok
          dealId={b.id}
          kirimBor={kirimBor}
          kategoriyalar={xodimKategoriyalari}
          xodimlar={zakazXodimlar}
          onSaqlandi={() => {
            void yuklash();
            router.refresh();
          }}
        />

        {/* KIRIMGA O'TKAZISH (4- va 5-talab) */}
        <div className="rounded-xl border border-line bg-surface-2/50 p-3 space-y-2">
          {kirimBor ? (
            <>
              <Badge tone="kirim">🟢 Kirim yozilgan</Badge>
              <p className="text-xs text-muted">
                Bu buyurtma bo&apos;yicha kirim allaqachon yozilgan — takroriy yozib bo&apos;lmaydi.
              </p>
              <Link
                href={kirimHavolasi(b)}
                className="inline-block text-brand text-sm font-medium"
                onClick={onClose}
              >
                Kirim yozuvini ochish →
              </Link>
            </>
          ) : (
            <>
              <Badge tone="warning">🟠 Kirim kutilmoqda</Badge>
              <p className="text-xs text-muted">
                To&apos;lov olingach kirimga o&apos;tkazing — Kirim bo&apos;limida oddiy yozuv sifatida
                paydo bo&apos;ladi.
              </p>
              <button
                onClick={() => setTasdiq(true)}
                disabled={b.summa <= 0}
                className="w-full rounded-lg bg-income text-white text-sm font-medium py-2 disabled:opacity-50"
              >
                Kirimga o&apos;tkazish
              </button>
              {b.summa <= 0 && <p className="text-2xs text-faint">Avval buyurtma narxini kiriting.</p>}
            </>
          )}
        </div>

        {/* Holat ko'chirish (drag'ga mobil muqobil) */}
        <div className="flex gap-1.5 flex-wrap">
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => onKochirish(s)}
              disabled={s.id === b.stageId}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                s.id === b.stageId
                  ? "bg-brand text-white border-transparent"
                  : "border-line text-muted hover:border-brand/50"
              }`}
            >
              {s.nomi}
            </button>
          ))}
        </div>

        <button onClick={vazifaYaratish} className="text-brand text-sm font-medium">
          + Vazifa yaratish
        </button>

        <form onSubmit={izohYuborish} className="flex gap-2">
          <input
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            placeholder="Izoh yozing va Enter bosing..."
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button type="submit" className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium">
            +
          </button>
        </form>

        <div className="space-y-2">
          {activities === null ? (
            <p className="text-sm text-faint">Yuklanmoqda...</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-faint">Hali faoliyat yo&apos;q.</p>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="text-sm border-l-2 border-line pl-3 py-0.5">
                <p className={a.turi === "tizim" ? "text-faint" : "text-fg"}>{a.matn}</p>
                <p className="text-2xs text-faint">{new Date(a.createdAt).toLocaleString("ru-RU")}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {tasdiq && (
        <KirimTasdiq
          b={b}
          onClose={() => setTasdiq(false)}
          onDone={() => {
            setTasdiq(false);
            onClose();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
