"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  KUNLIK_TOLOV_BELGI,
  KUNLIK_TOLOV_NOMI,
  type KunlikTolovTuri,
} from "@/lib/validation/kunlik";
import type { KunlikDirektorDTO, KunlikReportDTO } from "@/lib/queries/kunlik";
import type { KunlikRuxsat } from "@/lib/services/kunlik";
import { TushumForm } from "./TushumForm";
import { DirektorModal } from "./DirektorModal";
import { YakunCard } from "./YakunCard";
import { sanaSur, sanaUz, soatToshkent } from "./vaqt";

export function KunlikClient({
  report,
  ruxsat,
  bugun,
  direktor,
}: {
  report: KunlikReportDTO;
  ruxsat: KunlikRuxsat;
  bugun: string;
  direktor: KunlikDirektorDTO;
}) {
  const router = useRouter();
  const [direktorModal, setDirektorModal] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const bugungi = report.sana === bugun;
  const ochiq = report.holat === "OPEN";

  async function ochir(id: string) {
    if (!confirm("Bu tushum o'chirilsinmi?")) return;
    setXato(null);
    const res = await fetch(`/api/kunlik/tushum/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setXato(data.error ?? "O'chirib bo'lmadi");
      return;
    }
    router.refresh();
  }

  const kartalar: { turi: KunlikTolovTuri; summa: number }[] = [
    { turi: "CASH", summa: report.naqdSumma },
    { turi: "CLICK", summa: report.clickSumma },
    { turi: "DEBT", summa: report.qarzSumma },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {ruxsat.tarixniKoradi && (
            <Button
              variant="secondary"
              onClick={() => router.push(`/app/kunlik?sana=${sanaSur(report.sana, -1)}`)}
            >
              ←
            </Button>
          )}
          <p className="text-lg font-semibold text-fg">
            {sanaUz(report.sana)}
            {bugungi && <span className="text-sm text-muted font-normal"> · bugun</span>}
          </p>
          {ruxsat.tarixniKoradi && !bugungi && (
            <Button
              variant="secondary"
              onClick={() => router.push(`/app/kunlik?sana=${sanaSur(report.sana, 1)}`)}
            >
              →
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ruxsat.tarixniKoradi && (
            <Link href="/app/kunlik/tarix" className="text-sm text-brand hover:underline">
              Tarix
            </Link>
          )}
          {ruxsat.boshqaruvchimi && (
            <Button variant="secondary" onClick={() => setDirektorModal(true)}>
              Direktor: {direktor.direktorIsm ?? "tayinlanmagan"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kartalar.map((k) => (
          <Card key={k.turi}>
            <p className="text-sm text-muted">
              {KUNLIK_TOLOV_BELGI[k.turi]} {KUNLIK_TOLOV_NOMI[k.turi]}
            </p>
            <div className="mt-2">
              <Money value={k.summa} size="xl" tone="neutral" />
            </div>
          </Card>
        ))}
      </div>

      <YakunCard report={report} ruxsat={ruxsat} bugungi={bugungi} />

      {bugungi && ochiq && <TushumForm onDone={() => router.refresh()} />}
      {bugungi && !ochiq && (
        <Card>
          <p className="text-sm text-muted">
            {report.holat === "SUBMITTED"
              ? "Bugungi kassa direktorga topshirilgan — yangi tushum kiritilmaydi. Kerak bo'lsa direktor kunni qayta ochadi."
              : report.holat === "LOCKED"
                ? "Bu kun yopilgan (davr qulflangan) — endi o'zgartirib bo'lmaydi."
                : "Bugungi kun yakunlangan — yangi tushum kiritilmaydi. Tuzatish kerak bo'lsa direktor kunni qayta ochadi."}
          </p>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-fg mb-3">Tushumlar ({report.items.length})</h2>
        {report.items.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Hali tushum kiritilmagan"
            description="Kun davomida kiritilgan har bir tushum shu yerda ko'rinadi."
          />
        ) : (
          <ul className="divide-y divide-line">
            {report.items.map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-fg">
                    {KUNLIK_TOLOV_BELGI[t.tolovTuri as KunlikTolovTuri] ?? ""}{" "}
                    {KUNLIK_TOLOV_NOMI[t.tolovTuri as KunlikTolovTuri] ?? t.tolovTuri}
                    {t.izoh ? <span className="text-muted"> · {t.izoh}</span> : null}
                  </p>
                  <p className="text-2xs text-faint">
                    {t.userIsm ?? "—"} · {soatToshkent(t.createdAt)}
                    {t.yozuvdan && <span> · Yozuvlardan</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Money value={t.summa} size="md" tone="neutral" />
                  {ochiq && ruxsat.tahrirlaydi && !t.yozuvdan && (
                    <button
                      onClick={() => ochir(t.id)}
                      className="text-2xs text-expense hover:underline"
                    >
                      O&apos;chirish
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {direktorModal && (
        <DirektorModal
          onClose={() => setDirektorModal(false)}
          onDone={() => {
            setDirektorModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
