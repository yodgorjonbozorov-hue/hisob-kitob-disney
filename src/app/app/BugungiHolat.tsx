import { Card } from "@/components/ui/Card";
import { formatMoneyCompact, formatSomLabel } from "@/lib/format";
import type { BugungiHolat as BugungiHolatDTO } from "@/lib/queries/dashboardPanel";

interface Korsatkich {
  nomi: string;
  qiymat: string;
  title?: string;
  rang?: string;
  izoh?: string;
}

/**
 * "BUGUNGI HOLAT" — bugungi kun kesimi.
 *
 * Faqat foydalanuvchiga OCHIQ metrikalar keladi: CRM/qarz bloklari server
 * tomonda modul va huquq bilan kesiladi (`getBugungiHolat`), shu yerda esa
 * `null` bo'lsa qator umuman chizilmaydi.
 *
 * "Kassada" ATAYLAB yo'q — u yuqoridagi KPI kartasida turibdi va joriy
 * holat (bugungi kun emas), takrorlash chalg'itardi.
 */
export function BugungiHolat({ holat }: { holat: BugungiHolatDTO }) {
  const korsatkichlar: Korsatkich[] = [
    {
      nomi: "Kirim",
      qiymat: formatMoneyCompact(holat.kirim),
      title: formatSomLabel(holat.kirim),
      rang: "text-income",
    },
    {
      nomi: "Chiqim",
      qiymat: formatMoneyCompact(holat.chiqim),
      title: formatSomLabel(holat.chiqim),
      rang: "text-expense",
    },
    {
      nomi: "Sof natija",
      qiymat: formatMoneyCompact(holat.sof),
      title: formatSomLabel(holat.sof),
      rang: holat.sof >= 0 ? "text-fg" : "text-expense",
    },
  ];

  if (holat.crm) {
    korsatkichlar.push({ nomi: "Yangi buyurtma", qiymat: `${holat.crm.yangi} ta` });
    korsatkichlar.push({
      nomi: "Yutilgan",
      qiymat: `${holat.crm.yutilgan} ta`,
      izoh: holat.crm.yutilganSumma > 0 ? formatMoneyCompact(holat.crm.yutilganSumma) : undefined,
    });
  }

  if (holat.qarzBugun) {
    korsatkichlar.push({
      nomi: "Qarzga yozildi",
      qiymat: formatMoneyCompact(holat.qarzBugun.summa),
      title: formatSomLabel(holat.qarzBugun.summa),
      rang: "text-debt",
      izoh: holat.qarzBugun.soni > 0 ? `${holat.qarzBugun.soni} ta` : undefined,
    });
  }

  const bosh = holat.kirim === 0 && holat.chiqim === 0;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="font-semibold text-fg">Bugungi holat</h2>
        {bosh && <span className="text-2xs text-faint">Hali yozuv yo&apos;q</span>}
      </div>
      {/* Blok yarim kenglikdagi ustunda turadi, shuning uchun 3 tadan ortiq
          ustun QO'YILMAYDI: 5 ustunda "125 ming" ham kesilib ketardi. */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
        {korsatkichlar.map((k) => (
          <div key={k.nomi} className="min-w-0">
            <dt className="text-2xs text-muted truncate">{k.nomi}</dt>
            <dd
              className={`font-semibold tnum text-base sm:text-lg truncate ${k.rang ?? "text-fg"}`}
              title={k.title}
            >
              {k.qiymat}
            </dd>
            {k.izoh && <p className="text-2xs text-faint tnum truncate">{k.izoh}</p>}
          </div>
        ))}
      </dl>
    </Card>
  );
}
