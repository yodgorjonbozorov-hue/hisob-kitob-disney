"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between">
        <input
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder="Ism yoki telefon bo'yicha qidirish"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg"
        />
        <Button onClick={() => setModal("yangi")}>Yangi mijoz</Button>
      </div>

      <Card>
        {korinadigan.length === 0 ? (
          <EmptyState
            icon="🧑‍💼"
            title={q ? "Hech narsa topilmadi" : "Hali mijoz yo'q"}
            description="Mijoz kartochkasi barcha sotuv, qarz va bitimlarni bitta joyda ko'rsatadi. Qarz limiti esa qarzning nazoratsiz o'sishini to'xtatadi."
            action={q ? undefined : <Button onClick={() => setModal("yangi")}>Birinchi mijoz</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-faint text-xs uppercase">
                  <th className="pb-2">Mijoz</th>
                  <th className="pb-2 text-right">Jami sotuv</th>
                  <th className="pb-2 text-right">Ochiq qarz</th>
                  <th className="pb-2 text-right">Limit</th>
                  <th className="pb-2 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {korinadigan.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 font-medium">
                      <Link href={`/app/mijozlar/${m.id}`} className="text-brand hover:underline">
                        {m.ism}
                      </Link>
                      {m.tel && <span className="block text-2xs text-faint">{m.tel}</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      <Money value={m.jamiSotuv} size="sm" tone="neutral" />
                      <span className="block text-2xs text-faint tnum">{m.sotuvSoni} ta sotuv</span>
                    </td>
                    <td className="py-2.5 text-right">
                      {m.ochiqQarz > 0 ? (
                        <Money value={m.ochiqQarz} size="sm" tone="expense" />
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right tnum">
                      {m.qarzLimit === null ? (
                        <span className="text-faint">chegarasiz</span>
                      ) : (
                        <span className={m.limitToldi ? "text-expense font-medium" : ""}>
                          {m.qarzLimit.toLocaleString("uz-UZ")}
                          {m.limitToldi && <span className="block text-2xs">limit to&apos;ldi</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setModal(m)}
                        className="text-2xs text-brand hover:underline"
                      >
                        Tahrirlash
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
