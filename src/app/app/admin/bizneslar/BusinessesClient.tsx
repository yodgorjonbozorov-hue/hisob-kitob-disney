"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { isAvto } from "@/lib/biznesTuri";
import { YangiBiznesModal } from "./YangiBiznesModal";
import type { BusinessDTO, YangiBiznes } from "./turlar";

export function BusinessesClient({ initialBusinesses }: { initialBusinesses: BusinessDTO[] }) {
  const router = useRouter();
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [modalOpen, setModalOpen] = useState(false);

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
          ? { ...x, isActive: updated.isActive, turi: updated.turi, omborli: updated.omborli }
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
    return patch(b, { omborli: !b.omborli });
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModalOpen(true)}>+ Yangi biznes</Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-xs uppercase">
              <th className="pb-2">Nomi</th>
              <th className="pb-2">Rejim</th>
              <th className="pb-2">Ombor</th>
              <th className="pb-2 text-right">Kategoriyalar</th>
              <th className="pb-2 text-right">Tranzaksiyalar</th>
              <th className="pb-2">Holati</th>
              <th className="pb-2 text-right">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {businesses.map((b) => (
              <tr key={b.id}>
                <td className="py-2.5 font-medium">{b.nomi}</td>
                <td className="py-2.5">
                  <Badge tone={isAvto(b.turi) ? "kirim" : "neutral"}>
                    {isAvto(b.turi) ? "Avto" : "Umumiy"}
                  </Badge>
                </td>
                <td className="py-2.5">
                  <Badge tone={b.omborli ? "kirim" : "neutral"}>{b.omborli ? "Yoqiq" : "O'chiq"}</Badge>
                </td>
                <td className="py-2.5 text-right text-muted">{b.kategoriyalar}</td>
                <td className="py-2.5 text-right text-muted">{b.tranzaksiyalar}</td>
                <td className="py-2.5">
                  <Badge tone={b.isActive ? "kirim" : "neutral"}>{b.isActive ? "Faol" : "Nofaol"}</Badge>
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => toggleOmbor(b)}
                    className="text-xs font-medium text-muted hover:text-brand mr-3"
                  >
                    {b.omborli ? "Omborni o'chirish" : "Omborni yoqish"}
                  </button>
                  <button
                    onClick={() => toggleTuri(b)}
                    className="text-xs font-medium text-muted hover:text-brand mr-3"
                  >
                    {isAvto(b.turi) ? "Umumiy rejim" : "Avto rejim"}
                  </button>
                  <button
                    onClick={() => patch(b, { isActive: !b.isActive })}
                    className="text-xs font-medium text-muted hover:text-income mr-3"
                  >
                    {b.isActive ? "Nofaollashtirish" : "Faollashtirish"}
                  </button>
                  <button
                    onClick={() => deleteBusiness(b)}
                    className="text-xs font-medium text-muted hover:text-expense"
                  >
                    O&apos;chirish
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-faint">
        &quot;Ombor&quot; ustuni — shu bizneste mahsulot qoldig&apos;i, sotuv va ombor kirimi yuritiladimi.
        Menyuda &quot;Ombor&quot; va &quot;Sotuv&quot; ko&apos;rinishi uchun Sozlamalar → Modullar da
        &quot;Ombor va sotuv&quot; moduli ham yoqilgan bo&apos;lishi kerak.
      </p>

      {modalOpen && <YangiBiznesModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </div>
  );
}
