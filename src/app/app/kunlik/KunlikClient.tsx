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
import { sanaSur, sanaUz, soatToshkent, vaqtUzToshkent } from "./vaqt";

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
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const bugungi = report.sana === bugun;
  const ochiq = report.holat === "OPEN";

  async function amal(url: string) {
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sana: report.sana }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

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

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">💰 Jami tushum · kunlik yakun</p>
            <Money value={report.jamiSumma} size="display" tone="brand" />
          </div>
          <div className="text-right space-y-2">
            {ochiq ? (
              <p className="text-sm">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 text-fg border border-line">
                  🟡 Tasdiqlanmagan
                </span>
              </p>
            ) : (
              <div className="text-sm space-y-1">
                <p>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-wash text-brand border border-line">
                    🟢 Tasdiqlangan
                  </span>
                </p>
                <p className="text-2xs text-muted">
                  Tasdiqlagan: <span className="text-fg">{report.confirmedByIsm ?? "—"}</span>
                </p>
                {report.confirmedAt && (
                  <p className="text-2xs text-faint">{vaqtUzToshkent(report.confirmedAt)}</p>
                )}
              </div>
            )}
            {ochiq && ruxsat.tasdiqlaydi && (
              <Button onClick={() => amal("/api/kunlik/tasdiqlash")} loading={loading}>
                ✅ Kun yakunini tasdiqlash
              </Button>
            )}
            {!ochiq && ruxsat.tahrirlaydi && (
              <Button
                variant="secondary"
                onClick={() => amal("/api/kunlik/qayta-ochish")}
                loading={loading}
              >
                Qayta ochish (tuzatish uchun)
              </Button>
            )}
          </div>
        </div>
        {xato && <p className="text-sm text-expense mt-3">{xato}</p>}
        {ochiq && !ruxsat.tasdiqlaydi && (
          <p className="text-2xs text-faint mt-3">
            Kun yakunini faqat tayinlangan direktor tasdiqlaydi.
          </p>
        )}
      </Card>

      {bugungi && ochiq && <TushumForm onDone={() => router.refresh()} />}
      {bugungi && !ochiq && (
        <Card>
          <p className="text-sm text-muted">
            Bugungi kun yakunlangan — yangi tushum kiritilmaydi. Tuzatish kerak bo&apos;lsa
            direktor kunni qayta ochadi.
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
