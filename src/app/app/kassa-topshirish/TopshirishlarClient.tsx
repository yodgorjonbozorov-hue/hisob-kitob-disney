"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatSom, formatToshkentVaqt } from "@/lib/format";
import type { TransferDTO } from "@/lib/queries/accounts";
import { TopshirishQatori } from "./TopshirishQatori";

/**
 * KASSA TOPSHIRISHLARI — QABUL KUTAYOTGANLAR VA TARIX.
 *
 * ═══ QABUL QILISH NIMA QILADI ═══
 * Topshirilgan summa direktor kassasiga KIRIM bo'ladi va xodim kassasidan
 * ayriladi — ikkalasi ham AYNI ledger qatoridan
 * (`AccountTransfer.holat = "bajarildi"`), shuning uchun ikkita raqam hech
 * qachon ajralib qolmaydi. Rad etilsa pul xodim kassasida o'z holicha
 * qoladi (`holat = "rad"` — qoldiqqa umuman kirmaydi).
 *
 * Amalni server bajaradi (`PATCH /api/kassa-transfer/[id]`) va u huquqni
 * mustaqil tekshiradi: bu yerdagi shart shunchaki ishlamaydigan tugmani
 * ko'rsatmaydi.
 */
export function TopshirishlarClient({
  kutilayotganlar,
  tarix,
  qabulQila,
}: {
  kutilayotganlar: TransferDTO[];
  tarix: TransferDTO[];
  /** Qabul/rad tugmalari ko'rinadimi ("pul.qabul" + boshqaruvchi). */
  qabulQila: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [bandId, setBandId] = useState<string | null>(null);

  const kutilayotganJami = kutilayotganlar.reduce((s, t) => s + t.summa, 0);

  async function qaror(t: TransferDTO, amal: "qabul" | "rad") {
    if (amal === "rad") {
      const kim = t.fromUserIsm ?? t.fromNomi;
      if (!confirm(`${kim} topshirgan ${formatSom(t.summa)} soʻm rad etilsinmi?`)) return;
    }
    // IKKI MARTA BOSISHDAN HIMOYA. Bazada ham himoya bor
    // (`holat = "kutilmoqda"` sharti), bu esa keraksiz so'rovni to'sadi.
    setBandId(t.id);
    try {
      const res = await fetch(`/api/kassa-transfer/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amal }),
      });
      if (!res.ok) {
        toast({ message: (await res.json()).error ?? "Bajarib bo'lmadi", tone: "error" });
        return;
      }
      toast({
        message:
          amal === "qabul"
            ? "Qabul qilindi — pul kassangizga o'tdi, xodim kassasidan yechildi"
            : "Rad etildi — pul xodim kassasida qoldi",
        tone: "success",
      });
      router.refresh();
    } finally {
      setBandId(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="bg-surface border border-debt/40 rounded-2xl shadow-card overflow-hidden">
        <div className="px-4 sm:px-5 py-2.5 bg-debt-soft flex items-center justify-between gap-3">
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-debt-fg">
            Qabul kutilmoqda · {kutilayotganlar.length}
          </h2>
          {kutilayotganJami > 0 && (
            <span className="text-2xs font-semibold tnum text-debt-fg">
              {formatSom(kutilayotganJami)} soʻm
            </span>
          )}
        </div>
        {kutilayotganlar.length === 0 ? (
          <div className="px-4 sm:px-5 py-4">
            <EmptyState
              icon="✅"
              title="Qabul kutayotgan topshirish yo'q"
              description="Xodim kassasini topshirsa — shu yerda paydo bo'ladi va siz qabul qilasiz."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {kutilayotganlar.map((t) => (
              <TopshirishQatori
                key={t.id}
                t={t}
                band={bandId === t.id}
                qabulQila={qabulQila}
                onQaror={(amal) => qaror(t, amal)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="bg-surface border border-line rounded-2xl shadow-card overflow-hidden">
        <h2 className="px-4 sm:px-5 py-2.5 text-2xs font-semibold uppercase tracking-wider text-muted bg-surface-2">
          Topshirish tarixi
        </h2>
        {tarix.length === 0 ? (
          <div className="px-4 sm:px-5 py-4">
            <EmptyState icon="🗂" title="Tarix bo'sh" description="Hali topshirish bo'lmagan." />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {tarix.map((t) => (
              <li key={t.id} className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg truncate">
                    {t.fromUserIsm ?? t.fromNomi} → {t.toUserIsm ?? t.toNomi}
                  </p>
                  <p className="text-2xs text-faint mt-0.5">
                    {formatToshkentVaqt(new Date(t.createdAt))}
                    {t.tasdiqlaganIsm ? ` · qaror: ${t.tasdiqlaganIsm}` : ""}
                  </p>
                  {t.qarorIzoh && (
                    <p className="text-2xs text-muted mt-0.5 break-words">{t.qarorIzoh}</p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="font-display tnum text-base font-semibold text-fg whitespace-nowrap">
                    {formatSom(t.summa)}
                  </p>
                  <Badge tone={t.holat === "bajarildi" ? "kirim" : "chiqim"}>
                    {t.holat === "bajarildi"
                      ? "Qabul qilindi"
                      : t.holat === "bekor"
                        ? "Bekor qilindi"
                        : "Rad etildi"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!qabulQila && (
        <p className="text-2xs text-faint px-1">
          Qabul qilish huquqi sizda yo&apos;q — direktor yoki administrator bilan bog&apos;laning.
        </p>
      )}
    </div>
  );
}
