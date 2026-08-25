import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatMoneyCompact, formatSomLabel } from "@/lib/format";
import type { BugungiHolat } from "@/lib/queries/bugun";

/**
 * "BUGUNGI HOLAT" — dashboardning yuqori qismidagi kunlik kesim.
 *
 * KPI kartalari TANLANGAN OY bo'yicha, bu blok esa BUGUN bo'yicha: biznes
 * egasi "bugun nima bo'ldi?" savoliga oy raqamlarini o'qimasdan javob
 * oladi. Har ko'rsatkich bosiladigan sahifaga olib boradi.
 *
 * Faqat REAL ma'lumot: CRM qatorlari CRM moduli yoqilgan biznestagina
 * keladi (`holat.crm === null` bo'lsa umuman chizilmaydi) — "0 ta buyurtma"
 * deb turish moduli yo'q biznesda chalg'itardi.
 */
export function BugungiHolatBloki({ holat }: { holat: BugungiHolat }) {
  // Yozuvlar sahifasi bugungi kun bilan filtrlangan holda ochiladi —
  // kartadagi raqam va ro'yxat bir xil davrga tegishli bo'lsin.
  const bugunFiltr = `from=${holat.sana}&to=${holat.sana}`;
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="font-semibold text-fg">Bugungi holat</h2>
        <span className="text-2xs text-faint tnum">{holat.sana}</span>
      </div>
      {/* Telefonda 2 ustun, planshetda 3, desktopda 4 — karta ham, matn ham
          siqilmasin (eng uzun yorliq "Kassalardagi joriy pul"). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Katak
          yorliq="Bugungi kirim"
          qiymat={holat.kirim}
          rang="text-income"
          href={`/app/tranzaksiyalar?turi=kirim&${bugunFiltr}`}
        />
        <Katak
          yorliq="Bugungi chiqim"
          qiymat={holat.chiqim}
          rang="text-expense"
          href={`/app/tranzaksiyalar?turi=chiqim&${bugunFiltr}`}
        />
        <Katak
          yorliq="Bugungi sof natija"
          qiymat={holat.sof}
          rang={holat.sof >= 0 ? "text-income" : "text-expense"}
        />
        <Katak
          yorliq="Kassalardagi joriy pul"
          qiymat={holat.kassaJami}
          rang="text-fg"
          href="/app/kassa"
          izoh={`${holat.kassaSoni} ta faol kassa`}
        />
        <Katak
          yorliq="Bugun qarzga yozildi"
          qiymat={holat.qarzgaYozilgan}
          rang="text-debt"
          href="/app/qarzlar?turi=olinadigan"
          izoh={`${holat.qarzSoni} ta yozuv`}
        />
        {holat.crm && (
          <>
            <Katak
              yorliq="Yangi buyurtmalar"
              qiymat={holat.crm.yangiSumma}
              rang="text-fg"
              href="/app/crm"
              izoh={`${holat.crm.yangiSoni} ta`}
            />
            <Katak
              yorliq="Yutilgan buyurtmalar"
              qiymat={holat.crm.yutilganSumma}
              rang="text-income"
              href="/app/crm"
              izoh={`${holat.crm.yutilganSoni} ta`}
            />
          </>
        )}
      </div>
    </Card>
  );
}

function Katak({
  yorliq,
  qiymat,
  rang,
  href,
  izoh,
}: {
  yorliq: string;
  qiymat: number;
  rang: string;
  href?: string;
  izoh?: string;
}) {
  const ichi = (
    <>
      <p className="text-2xs text-muted leading-tight">{yorliq}</p>
      <p className={`font-semibold tnum ${rang}`} title={formatSomLabel(qiymat)}>
        {formatMoneyCompact(qiymat)}
      </p>
      {izoh && <p className="text-2xs text-faint tnum">{izoh}</p>}
    </>
  );
  if (!href) return <div className="rounded-lg p-2 -m-2">{ichi}</div>;
  return (
    <Link
      href={href}
      className="rounded-lg p-2 -m-2 transition hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {ichi}
    </Link>
  );
}
