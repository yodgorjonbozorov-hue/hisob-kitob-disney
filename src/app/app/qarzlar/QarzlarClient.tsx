"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { formatSomLabel } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { isAvto, type QarzTuri } from "@/lib/biznesTuri";
import { type QarzHolat } from "@/lib/validation/qarz";
import type { MijozTanlov } from "@/components/qarz/MijozTanlash";
import type {
  QarzDTO,
  QarzDashboardDTO,
  QarzdorDTO,
  QarzdorTafsilotDTO,
} from "@/lib/queries/qarz";
import { QarzKPI } from "./QarzKPI";
import { QarzJadval } from "./QarzJadval";
import { QarzTafsilot } from "./QarzTafsilot";
import { QarzdorRoyxat } from "./QarzdorRoyxat";
import { QarzdorTafsilot } from "./QarzdorTafsilot";
import { QarzFiltrPanel, type QarzKorinish, type QarzYonalish } from "./QarzFiltrPanel";
import { QarzYangiModal, type QarzProductOption } from "./QarzYangiModal";
import type { KassaOption } from "./QarzTolovForm";

export type { QarzProductOption };

/**
 * QARZLAR MODULI — ikki ko'rinish, bitta ma'lumot.
 *
 *   "Qarzdorlar" — SHAXS kesimi: kim qancha qarzdor (kundalik savol);
 *   "Yozuvlar"   — QARZ kesimi: qaysi savdo qarzga ketdi (tekshiruv uchun).
 *
 * Sahifa OMBOR modulidan mustaqil: qarz ombori yo'q biznesda ham yuritiladi
 * (lib/modules/registry.ts da u MOLIYA moduliga ko'chirilgan).
 */
export function QarzlarClient({
  initialDebts,
  qarzdorlar,
  dashboard,
  kassalar,
  products = [],
  biznesTuri = "umumiy",
  bekorQilaOladi = false,
  boshlangichYonalish = "olinadigan",
}: {
  initialDebts: QarzDTO[];
  qarzdorlar: QarzdorDTO[];
  dashboard: QarzDashboardDTO;
  kassalar: KassaOption[];
  products?: QarzProductOption[];
  biznesTuri?: string;
  /** Qarzni bekor qilish faqat boshqaruvchida. */
  bekorQilaOladi?: boolean;
  /** URL'dagi `?turi=` — bosh sahifadagi karta shu bilan keladi. */
  boshlangichYonalish?: QarzYonalish;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const avto = isAvto(biznesTuri);
  const [debts, setDebts] = useState(initialDebts);
  // router.refresh() dan keyin server yangi ro'yxatni beradi — moslaymiz.
  useEffect(() => setDebts(initialDebts), [initialDebts]);

  const [yonalish, setYonalish] = useState<QarzYonalish>(boshlangichYonalish);
  const [korinish, setKorinish] = useState<QarzKorinish>("qarzdorlar");
  const [status, setStatus] = useState<QarzHolat | "HAMMASI">("HAMMASI");
  const [q, setQ] = useState("");
  const [ochilgan, setOchilgan] = useState<string | null>(null);
  const [ochilganQarzdor, setOchilganQarzdor] = useState<QarzdorDTO | null>(null);
  const [yangi, setYangi] = useState<{ turi: QarzTuri; mijoz: MijozTanlov | null } | null>(null);

  const matn = q.trim().toLowerCase();
  const yonalishMos = (t: string) => yonalish === "hammasi" || t === yonalish;

  const korinadiganQarzdorlar = useMemo(
    () =>
      qarzdorlar
        .filter((d) => yonalishMos(d.turi))
        .filter(
          (d) => !matn || d.ism.toLowerCase().includes(matn) || (d.tel ?? "").includes(matn)
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qarzdorlar, yonalish, matn]
  );

  const korinadiganYozuvlar = useMemo(
    () =>
      debts
        .filter((d) => yonalishMos(d.turi))
        .filter((d) => status === "HAMMASI" || d.status === status)
        .filter(
          (d) =>
            !matn ||
            d.mijozNomi.toLowerCase().includes(matn) ||
            (d.mijozTel ?? "").includes(matn)
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debts, yonalish, status, matn]
  );

  const sanoq: Record<QarzYonalish, number> = {
    hammasi: qarzdorlar.length,
    olinadigan: qarzdorlar.filter((d) => d.turi === "olinadigan").length,
    beriladigan: qarzdorlar.filter((d) => d.turi === "beriladigan").length,
  };

  /** Yangi qarz oynasi uchun yo'nalish: "Barcha" tanlanganda olinadigan. */
  const yangiTuri: QarzTuri = yonalish === "beriladigan" ? "beriladigan" : "olinadigan";

  function eslatma(d: QarzDTO) {
    const text = `Assalomu alaykum, ${d.mijozNomi}. Sizning ${formatSomLabel(
      d.qolgan
    )} miqdoridagi qarzingiz eslatib o'tamiz. Iltimos, imkoniyat bo'lganda to'lab qo'ysangiz. Rahmat.`;
    navigator.clipboard?.writeText(text).then(
      () => toast({ message: "Eslatma matni nusxalandi", tone: "success" }),
      () => toast({ message: text, tone: "neutral", duration: 8000 })
    );
  }

  /** Qarzdor kartochkasidan "+ Qarz qo'shish" — mijoz oldindan to'ldiriladi. */
  function qarzdordanQosh(t: QarzdorTafsilotDTO) {
    setOchilganQarzdor(null);
    setYangi({
      turi: t.turi === "beriladigan" ? "beriladigan" : "olinadigan",
      mijoz: { contactId: t.contactId, ism: t.ism, tel: t.tel ?? "" },
    });
  }

  return (
    <div className="space-y-4">
      <QarzKPI d={dashboard} />

      <div className="flex justify-end">
        <Button onClick={() => setYangi({ turi: yangiTuri, mijoz: null })}>
          + Qarz qo&apos;shish
        </Button>
      </div>

      <QarzFiltrPanel
        yonalish={yonalish}
        onYonalish={setYonalish}
        sanoq={sanoq}
        korinish={korinish}
        onKorinish={setKorinish}
        q={q}
        onQ={setQ}
        status={status}
        onStatus={setStatus}
      />

      {korinish === "qarzdorlar" ? (
        <QarzdorRoyxat
          qarzdorlar={korinadiganQarzdorlar}
          onOch={setOchilganQarzdor}
          onQarzQosh={() => setYangi({ turi: yangiTuri, mijoz: null })}
          bosh={qarzdorlar.length === 0}
        />
      ) : (
        <QarzJadval qarzlar={korinadiganYozuvlar} onOch={(d) => setOchilgan(d.id)} onEslatma={eslatma} />
      )}

      {ochilganQarzdor && (
        <QarzdorTafsilot
          kalit={ochilganQarzdor.kalit}
          turi={ochilganQarzdor.turi}
          kassalar={kassalar}
          onQarzQosh={qarzdordanQosh}
          onClose={() => setOchilganQarzdor(null)}
          onChanged={() => router.refresh()}
        />
      )}
      {ochilgan && (
        <QarzTafsilot
          debtId={ochilgan}
          kassalar={kassalar}
          bekorQilaOladi={bekorQilaOladi}
          onClose={() => setOchilgan(null)}
          onChanged={() => router.refresh()}
        />
      )}
      {yangi && (
        <QarzYangiModal
          turi={yangi.turi}
          mijoz={yangi.mijoz}
          products={products}
          avto={avto}
          onClose={() => setYangi(null)}
          onDone={() => {
            setYangi(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
