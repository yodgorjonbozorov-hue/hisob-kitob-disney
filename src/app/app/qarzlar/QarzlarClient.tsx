"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { formatSomLabel } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { QARZ_MATN, isAvto, type QarzTuri } from "@/lib/biznesTuri";
import { QARZ_HOLATLARI, QARZ_HOLAT_NOMI, type QarzHolat } from "@/lib/validation/qarz";
import type { QarzDTO, QarzDashboardDTO } from "@/lib/queries/qarz";
import { QarzKPI } from "./QarzKPI";
import { QarzJadval } from "./QarzJadval";
import { QarzTafsilot } from "./QarzTafsilot";
import { QarzYangiModal, type QarzProductOption } from "./QarzYangiModal";
import type { KassaOption } from "./QarzTolovForm";

export type { QarzProductOption };

/**
 * QARZLAR MODULI — dashboard, filtr, jadval va tafsilot.
 *
 * Sahifa OMBOR modulidan mustaqil: qarz ombori yo'q biznesda ham yuritiladi
 * (lib/modules/registry.ts da u MOLIYA moduliga ko'chirilgan).
 */
export function QarzlarClient({
  initialDebts,
  dashboard,
  kassalar,
  products = [],
  biznesTuri = "umumiy",
  bekorQilaOladi = false,
}: {
  initialDebts: QarzDTO[];
  dashboard: QarzDashboardDTO;
  kassalar: KassaOption[];
  products?: QarzProductOption[];
  biznesTuri?: string;
  /** Qarzni bekor qilish faqat boshqaruvchida. */
  bekorQilaOladi?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const avto = isAvto(biznesTuri);
  const [debts, setDebts] = useState(initialDebts);
  // router.refresh() dan keyin server yangi ro'yxatni beradi — moslaymiz.
  useEffect(() => setDebts(initialDebts), [initialDebts]);

  const [tab, setTab] = useState<QarzTuri>("olinadigan");
  const [status, setStatus] = useState<QarzHolat | "HAMMASI">("HAMMASI");
  const [q, setQ] = useState("");
  const [ochilgan, setOchilgan] = useState<string | null>(null);
  const [yangiOchiq, setYangiOchiq] = useState(false);

  const korinadigan = useMemo(() => {
    const matn = q.trim().toLowerCase();
    return debts
      .filter((d) => d.turi === tab)
      .filter((d) => status === "HAMMASI" || d.status === status)
      .filter(
        (d) =>
          !matn ||
          d.mijozNomi.toLowerCase().includes(matn) ||
          (d.mijozTel ?? "").includes(matn)
      );
  }, [debts, tab, status, q]);

  function eslatma(d: QarzDTO) {
    const text = `Assalomu alaykum, ${d.mijozNomi}. Sizning ${formatSomLabel(
      d.qolgan
    )} miqdoridagi qarzingiz eslatib o'tamiz. Iltimos, imkoniyat bo'lganda to'lab qo'ysangiz. Rahmat.`;
    navigator.clipboard?.writeText(text).then(
      () => toast({ message: "Eslatma matni nusxalandi", tone: "success" }),
      () => toast({ message: text, tone: "neutral", duration: 8000 })
    );
  }

  return (
    <div className="space-y-4">
      <QarzKPI d={dashboard} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(["olinadigan", "beriladigan"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                tab === t ? "bg-brand text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {QARZ_MATN[t].nomi}
              <span className="ml-1.5 text-2xs opacity-80">
                {debts.filter((d) => d.turi === t && !d.isYopilgan).length}
              </span>
            </button>
          ))}
        </div>
        <Button onClick={() => setYangiOchiq(true)}>+ Qarz qo&apos;shish</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Mijoz yoki telefon..."
          className="flex-1 min-w-[12rem] rounded-lg border border-line px-3 py-2 text-sm"
          aria-label="Qarzlar orasidan qidirish"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as QarzHolat | "HAMMASI")}
          className="rounded-lg border border-line px-3 py-2 text-sm bg-surface"
          aria-label="Holat bo'yicha filtr"
        >
          <option value="HAMMASI">Barcha holatlar</option>
          {QARZ_HOLATLARI.map((s) => (
            <option key={s} value={s}>
              {QARZ_HOLAT_NOMI[s]}
            </option>
          ))}
        </select>
      </div>

      <QarzJadval qarzlar={korinadigan} onOch={(d) => setOchilgan(d.id)} onEslatma={eslatma} />

      {ochilgan && (
        <QarzTafsilot
          debtId={ochilgan}
          kassalar={kassalar}
          bekorQilaOladi={bekorQilaOladi}
          onClose={() => setOchilgan(null)}
          onChanged={() => router.refresh()}
        />
      )}
      {yangiOchiq && (
        <QarzYangiModal
          turi={tab}
          products={products}
          avto={avto}
          onClose={() => setYangiOchiq(false)}
          onDone={() => {
            setYangiOchiq(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
