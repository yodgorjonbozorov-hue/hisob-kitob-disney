"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { Jadval, type Ustun } from "@/components/ui/Jadval";
import type { MijozDTO } from "@/lib/queries/mijoz";
import { MijozModal } from "./MijozModal";

export function MijozlarClient({
  mijozlar,
  boshqaruvchi,
}: {
  mijozlar: MijozDTO[];
  boshqaruvchi: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<MijozDTO | "yangi" | null>(null);
  const [qidiruv, setQidiruv] = useState("");

  const q = qidiruv.trim().toLowerCase();
  const korinadigan = q
    ? mijozlar.filter(
        (m) => m.ism.toLowerCase().includes(q) || (m.tel ?? "").toLowerCase().includes(q)
      )
    : mijozlar;

  // Ustun ta'rifi BITTA — desktop jadval ham, mobil kartochka ham shundan.
  const ustunlar: Ustun<MijozDTO>[] = [
    {
      kalit: "mijoz",
      sarlavha: "Mijoz",
      katak: (m) => (
        <>
          <Link href={`/app/mijozlar/${m.id}`} className="text-brand hover:underline">
            {m.ism}
          </Link>
          {m.tel && <span className="block text-2xs text-faint font-normal">{m.tel}</span>}
        </>
      ),
    },
    {
      kalit: "sotuv",
      sarlavha: "Jami sotuv",
      raqam: true,
      katak: (m) => (
        <>
          <Money value={m.jamiSotuv} size="sm" tone="neutral" />
          <span className="block text-2xs text-faint tnum">{m.sotuvSoni} ta sotuv</span>
        </>
      ),
    },
    {
      kalit: "qarz",
      sarlavha: "Ochiq qarz",
      raqam: true,
      katak: (m) =>
        m.ochiqQarz > 0 ? (
          <Money value={m.ochiqQarz} size="sm" tone="expense" />
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    {
      kalit: "limit",
      sarlavha: "Limit",
      raqam: true,
      katak: (m) =>
        m.qarzLimit === null ? (
          <span className="text-faint">chegarasiz</span>
        ) : (
          <span className={m.limitToldi ? "text-expense font-medium" : ""}>
            {m.qarzLimit.toLocaleString("uz-UZ")}
            {m.limitToldi && <span className="block text-2xs">limit to&apos;ldi</span>}
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between">
        <input
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder="Ism yoki telefon bo'yicha qidirish"
          className="flex-1 min-w-0 sm:min-w-[200px] px-3 min-h-[44px] rounded-lg bg-surface-2 border border-line text-fg"
        />
        <Button onClick={() => setModal("yangi")}>Yangi mijoz</Button>
      </div>

      <Card>
        <Jadval
          ustunlar={ustunlar}
          qatorlar={korinadigan}
          kalit={(m) => m.id}
          amallar={(m) => [{ label: "Tahrirlash", onClick: () => setModal(m), tur: "asosiy" }]}
          bosh={
            <EmptyState
              icon="🧑‍💼"
              title={q ? "Hech narsa topilmadi" : "Hali mijoz yo'q"}
              description="Mijoz kartochkasi barcha sotuv, qarz va bitimlarni bitta joyda ko'rsatadi. Qarz limiti esa qarzning nazoratsiz o'sishini to'xtatadi."
              action={q ? undefined : <Button onClick={() => setModal("yangi")}>Birinchi mijoz</Button>}
            />
          }
        />
      </Card>

      {modal && (
        <MijozModal
          mijoz={modal === "yangi" ? null : modal}
          boshqaruvchi={boshqaruvchi}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
