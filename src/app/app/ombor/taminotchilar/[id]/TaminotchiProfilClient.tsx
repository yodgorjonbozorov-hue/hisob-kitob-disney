"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { formatDateUz } from "@/lib/format";
import { TaminotlarTab } from "../../TaminotlarTab";
import { QarzTolashModal } from "./QarzTolashModal";
import type { AccountDTO } from "@/lib/queries/accounts";
import type { TaminotRoyxatDTO } from "@/lib/queries/ombor";
import type { TaminotchiProfilDTO } from "@/lib/queries/taminotchi";

/**
 * Profil ekrani: yuqorida "u bilan hisobimiz", pastda ta'minotlar tarixi.
 *
 * Tarix ro'yxati Ombor sahifasidagi AYNI komponent (`TaminotlarTab`) —
 * shu bois tafsilot, tahrirlash va bekor qilish oqimlari bu yerda ham
 * o'zgarishsiz ishlaydi va ikkinchi ro'yxat ko'rinishi yaratilmaydi.
 */
export function TaminotchiProfilClient({
  profil,
  tarix,
  kassalar,
}: {
  profil: TaminotchiProfilDTO;
  tarix: TaminotRoyxatDTO;
  kassalar: AccountDTO[];
}) {
  const router = useRouter();
  const [tolov, setTolov] = useState(false);
  const yangila = () => router.refresh();

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-fg break-words">{profil.nomi}</h1>
          <p className="text-sm text-muted mt-0.5">
            {profil.tel ?? "Telefon kiritilmagan"}
            {profil.manzil ? ` · ${profil.manzil}` : ""}
          </p>
          {!profil.isActive && <p className="text-2xs text-faint mt-0.5">Nofaol ta&apos;minotchi</p>}
        </div>
        {profil.qolganQarz > 0 && (
          <Button onClick={() => setTolov(true)} className="shrink-0">
            Qarz to&apos;lash
          </Button>
        )}
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Kpi nomi="Jami ta'minot" summa={profil.jamiTaminot} tone="neutral" />
        <Kpi nomi="Jami to'langan" summa={profil.jamiTolangan + profil.qarzTolovlari} tone="income" />
        <Kpi nomi="Jami qarz" summa={profil.jamiQarz} tone="neutral" />
        <Kpi nomi="Qolgan qarz" summa={profil.qolganQarz} tone="debt" />
      </div>

      <Card>
        <dl className="divide-y divide-line">
          <Qator
            nomi="Oxirgi ta'minot"
            qiymat={
              profil.oxirgiTaminot ? formatDateUz(new Date(profil.oxirgiTaminot)) : "Hali yo'q"
            }
          />
          <Qator nomi="Ta'minotlar soni" qiymat={`${profil.taminotSoni} ta`} />
          {profil.izoh && <Qator nomi="Izoh" qiymat={profil.izoh} />}
        </dl>
      </Card>

      <div>
        <h2 className="text-base font-semibold text-fg mb-2">Ta&apos;minotlar tarixi</h2>
        <TaminotlarTab royxat={tarix} onTaminot={() => router.push("/app/ombor")} onYangilandi={yangila} />
      </div>

      {tolov && (
        <QarzTolashModal
          profil={profil}
          kassalar={kassalar}
          onClose={() => setTolov(false)}
          onDone={() => {
            setTolov(false);
            yangila();
          }}
        />
      )}
    </div>
  );
}

function Kpi({
  nomi,
  summa,
  tone,
}: {
  nomi: string;
  summa: number;
  tone: "neutral" | "income" | "debt";
}) {
  return (
    <Card className="p-3">
      <p className="text-2xs text-muted mb-1">{nomi}</p>
      <Money value={summa} size="lg" tone={tone} />
    </Card>
  );
}

function Qator({ nomi, qiymat }: { nomi: string; qiymat: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2.5">
      <dt className="text-sm text-muted shrink-0">{nomi}</dt>
      <dd className="text-sm font-medium text-fg text-right min-w-0 break-words">{qiymat}</dd>
    </div>
  );
}
