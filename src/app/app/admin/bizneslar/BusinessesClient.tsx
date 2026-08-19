"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Jadval, type Ustun } from "@/components/ui/Jadval";
import { isAvto } from "@/lib/biznesTuri";
import { YangiBiznesModal } from "./YangiBiznesModal";
import { TozalashModal } from "./TozalashModal";
import type { BusinessDTO, YangiBiznes } from "./turlar";

export function BusinessesClient({ initialBusinesses }: { initialBusinesses: BusinessDTO[] }) {
  const router = useRouter();
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [modalOpen, setModalOpen] = useState(false);
  const [tozalash, setTozalash] = useState<BusinessDTO | null>(null);

  /** PATCH yuborib, javobdagi maydonlarni jadvalga qaytaradi. */
  async function patch(b: BusinessDTO, data: Record<string, unknown>) {
    const res = await fetch(`/api/businesses/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      alert((await res.json()).error ?? "Saqlab bo'lmadi");
      return;
    }
    const updated: BusinessDTO = await res.json();
    setBusinesses((prev) =>
      prev.map((x) =>
        x.id === updated.id
          ? {
              ...x,
              isActive: updated.isActive,
              turi: updated.turi,
              omborli: updated.omborli,
              magazin: updated.magazin,
            }
          : x
      )
    );
    router.refresh();
  }

  /** Biznes rejimi: umumiy ombor ↔ avto (olib-sotar). */
  function toggleTuri(b: BusinessDTO) {
    return patch(b, { turi: isAvto(b.turi) ? "umumiy" : "avto" });
  }

  /**
   * Ombor va sotuvni shu bizneste yoqish/o'chirish. OMBOR moduli tenantda
   * yoqilgan bo'lsa ham, nav'da "Ombor"/"Sotuv" faqat shu bayroq bilan chiqadi.
   */
  function toggleOmbor(b: BusinessDTO) {
    if (isAvto(b.turi)) {
      alert("Avto rejimi ombor tizimisiz ishlamaydi. Avval rejimni \"Umumiy\" ga o'tkazing.");
      return;
    }
    if (b.omborli && !confirm(`"${b.nomi}" da ombor va sotuv bo'limlari yopilsinmi?\n\nMahsulot va sotuv ma'lumotlari o'chmaydi — qayta yoqsangiz joyida bo'ladi.`)) {
      return;
    }
    // Ombor o'chirilsa kassa ham ma'nosini yo'qotadi (mahsulot va qoldiq
    // ombordan keladi) — shu bois birga o'chiriladi.
    return patch(b, { omborli: !b.omborli, ...(b.omborli ? { magazin: false } : {}) });
  }

  /**
   * Do'kon kassasini (POS) shu bizneste yoqish/o'chirish.
   *
   * O'chirilganda MA'LUMOT O'CHMAYDI: cheklar, sotuvlar, mahsulot kodlari va
   * qoldiqlar joyida qoladi — faqat kassa bo'limi ko'rinmay qoladi.
   */
  function toggleMagazin(b: BusinessDTO) {
    if (!b.omborli && !b.magazin) {
      alert("Kassa ombor ustida ishlaydi. Avval shu bizneste omborni yoqing.");
      return;
    }
    if (
      b.magazin &&
      !confirm(
        `"${b.nomi}" da kassa (POS) bo'limi yopilsinmi?\n\n` +
          "Cheklar, sotuvlar va mahsulot kodlari o'chmaydi — qayta yoqsangiz joyida bo'ladi."
      )
    ) {
      return;
    }
    return patch(b, { magazin: !b.magazin });
  }

  async function deleteBusiness(b: BusinessDTO) {
    if (!confirm(`"${b.nomi}" biznesini butunlay o'chirasizmi?\n\nFaqat BO'SH biznes o'chiriladi (yozuv/mahsulot/foydalanuvchi yo'q). Ma'lumot bor bo'lsa — o'chmaydi.`)) return;
    const res = await fetch(`/api/businesses/${b.id}`, { method: "DELETE" });
    if (res.ok) {
      setBusinesses((prev) => prev.filter((x) => x.id !== b.id));
      router.refresh();
    } else {
      alert((await res.json()).error ?? "O'chirib bo'lmadi");
    }
  }

  function handleCreated(b: YangiBiznes) {
    setBusinesses((prev) => [...prev, { ...b, kategoriyalar: 0, tranzaksiyalar: 0 }]);
    setModalOpen(false);
    router.refresh();
  }

  // Ustun ta'rifi BITTA — desktop jadval ham, mobil kartochka ham shundan.
  const ustunlar: Ustun<BusinessDTO>[] = [
    { kalit: "nomi", sarlavha: "Nomi", katak: (b) => b.nomi, className: "font-medium" },
    {
      kalit: "rejim",
      sarlavha: "Rejim",
      katak: (b) => (
        <Badge tone={isAvto(b.turi) ? "kirim" : "neutral"}>
          {isAvto(b.turi) ? "Avto" : "Umumiy"}
        </Badge>
      ),
    },
    {
      kalit: "ombor",
      sarlavha: "Ombor",
      katak: (b) => <Badge tone={b.omborli ? "kirim" : "neutral"}>{b.omborli ? "Yoqiq" : "O'chiq"}</Badge>,
    },
    {
      kalit: "kassa",
      sarlavha: "Kassa",
      katak: (b) => <Badge tone={b.magazin ? "kirim" : "neutral"}>{b.magazin ? "Yoqiq" : "O'chiq"}</Badge>,
    },
    { kalit: "kategoriyalar", sarlavha: "Kategoriyalar", raqam: true, katak: (b) => b.kategoriyalar },
    { kalit: "tranzaksiyalar", sarlavha: "Tranzaksiyalar", raqam: true, katak: (b) => b.tranzaksiyalar },
    {
      kalit: "holati",
      sarlavha: "Holati",
      katak: (b) => <Badge tone={b.isActive ? "kirim" : "neutral"}>{b.isActive ? "Faol" : "Nofaol"}</Badge>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModalOpen(true)}>+ Yangi biznes</Button>
      </div>

      <Card>
        <Jadval
          ustunlar={ustunlar}
          qatorlar={businesses}
          kalit={(b) => b.id}
          minKenglik="min-w-[60rem]"
          amallar={(b) => [
            { label: b.omborli ? "Omborni o'chirish" : "Omborni yoqish", onClick: () => void toggleOmbor(b), tur: "asosiy" },
            { label: b.magazin ? "Kassani o'chirish" : "Kassani yoqish", onClick: () => void toggleMagazin(b), tur: "asosiy" },
            { label: isAvto(b.turi) ? "Umumiy rejim" : "Avto rejim", onClick: () => void toggleTuri(b), tur: "asosiy" },
            {
              label: b.isActive ? "Nofaollashtirish" : "Faollashtirish",
              onClick: () => void patch(b, { isActive: !b.isActive }),
              tur: "ijobiy",
            },
            { label: "Tozalash", onClick: () => setTozalash(b), tur: "ogoh" },
            { label: "O'chirish", onClick: () => void deleteBusiness(b), tur: "xavf" },
          ]}
        />
      </Card>

      <p className="text-xs text-faint">
        &quot;Ombor&quot; ustuni — shu bizneste mahsulot qoldig&apos;i, sotuv va ombor kirimi yuritiladimi.
        Menyuda &quot;Ombor&quot; va &quot;Sotuv&quot; ko&apos;rinishi uchun Sozlamalar → Modullar da
        &quot;Ombor va sotuv&quot; moduli ham yoqilgan bo&apos;lishi kerak.
      </p>

      {modalOpen && <YangiBiznesModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
      {tozalash && (
        <TozalashModal
          biznes={tozalash}
          onClose={() => setTozalash(null)}
          onDone={(xabar) => {
            setTozalash(null);
            alert(xabar);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
