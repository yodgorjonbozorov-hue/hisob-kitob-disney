import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayCircle, type LucideIcon } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { PLANLAR } from "@/lib/billing/plans";
import { formatSom } from "@/lib/format";
import { BRAND, ESKI_NOM_IZOHI } from "@/lib/brand";
import { ikon } from "@/components/nav/ikonlar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata = {
  title: `${BRAND.nomi} — ${BRAND.tagline}`,
  description:
    "Kirim-chiqim, ombor, sotuv va qarzdorlik hisobi — hisobotlar, Telegram bot va bir nechta biznes bitta tizimda. 14 kun bepul.",
};

/**
 * Imkoniyatlar. Ikonka kaliti — ilova menyusidagi AYNI kalit (`nav/ikonlar.ts`),
 * shu bois saytda ko'rgan belgi ilovada ham o'sha bo'ladi. Emoji ishlatilmaydi:
 * u qurilmadan qurilmaga turlicha chiziladi va brend uslubiga bo'ysunmaydi.
 */
const IMKONIYATLAR: { ikon: string; nomi: string; tavsif: string }[] = [
  { ikon: "dashboard", nomi: "Boshqaruv paneli", tavsif: "Kirim, chiqim, sof foyda va dinamika — bir qarashda. Oylik hisobotlar PDF va Excel'da." },
  { ikon: "crm", nomi: "CRM", tavsif: "Bitimlar kanbani, kontaktlar, faoliyat tarixi. Yutilgan bitim 1 klikda kirimga aylanadi." },
  { ikon: "tasks", nomi: "Vazifalar", tavsif: "Jamoa vazifalari: mas'ul, muddat, kanban. Muddati kelganda Telegram eslatma." },
  { ikon: "ai", nomi: "AI yordamchi", tavsif: "\"Bu oy qanday o'tdi?\" — raqamlaringiz bo'yicha savol-javob va AI xulosalar." },
  { ikon: "package", nomi: "Ombor va sotuv", tavsif: "Mahsulot qoldig'i, sotuv (naqd/qarz), qarzdorlik va to'lovlar nazorati." },
  { ikon: "telegram", nomi: "Telegram bot", tavsif: "Kirim-chiqim va leadlarni botdan kiriting, har kuni ertalab kunlik xulosa oling." },
  { ikon: "business", nomi: "Bir nechta biznes", tavsif: "Har bir filial yoki yo'nalish alohida — raqamlar aralashmaydi." },
  { ikon: "modules", nomi: "Modulli tizim", tavsif: "Keragini yoqasiz, keraksizini o'chirasiz — interfeys ortiqcha narsasiz qoladi." },
  { ikon: "shield", nomi: "Rollar va audit", tavsif: "Direktor, kassir, sotuvchi — har kim o'z huquqi bilan. Har o'zgarish audit jurnalida." },
];

/** Ikonka plitkasi — yon menyudagi aktiv element bilan bir xil (brand-wash + brand). */
function IkonPlita({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-wash text-brand">
      <Icon className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

/** Public landing — mahsulot tavsifi va ro'yxatdan o'tish. Tizimdagi foydalanuvchi darhol ilovaga o'tadi. */
export default async function LandingPage() {
  const session = await getSession();
  if (session.userId) {
    redirect(session.rol === "SUPERADMIN" ? "/superadmin" : "/app");
  }

  return (
    <PublicShell cta>
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 pt-12 pb-10 text-center">
        <Badge tone="info">{ESKI_NOM_IZOHI}</Badge>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-fg mt-5">
          Biznesingiz <span className="text-brand">balansda</span> bo&apos;lsin
        </h1>
        <p className="text-muted mt-4 text-base max-w-xl mx-auto">
          Kirim-chiqim, ombor, sotuv va qarzdorlik — telefon va kompyuterda ishlaydigan bitta sodda tizim.
          Excel&apos;dagi tartibsizlikka chek qo&apos;ying.
        </p>
        <div className="mt-7 flex items-center justify-center gap-2 flex-wrap">
          <LinkButton href="/signup" size="lg" className="px-8">
            14 kun bepul boshlash
          </LinkButton>
          <LinkButton href="/login" size="lg" variant="ghost" className="text-brand hover:text-brand">
            Hisobim bor →
          </LinkButton>
        </div>
        <p className="text-2xs text-faint mt-3">Karta talab qilinmaydi · 2 daqiqada ishga tushadi</p>
      </section>

      {/* Demo video joyi */}
      <section className="mx-auto max-w-3xl px-4 pb-12">
        <Card className="aspect-video flex flex-col items-center justify-center text-center">
          <PlayCircle className="w-12 h-12 text-brand mb-3" strokeWidth={1.5} aria-hidden="true" />
          <p className="font-medium text-fg">Demo video</p>
          <p className="text-sm text-faint mt-1">Tez orada — tizim bilan 2 daqiqada tanishing</p>
        </Card>
      </section>

      {/* Imkoniyatlar */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <h2 className="font-heading text-lg font-semibold text-fg text-center mb-6">Nimalar qila oladi?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {IMKONIYATLAR.map((f) => (
            <Card key={f.nomi}>
              <IkonPlita Icon={ikon(f.ikon)} />
              <h3 className="font-semibold text-fg mt-3">{f.nomi}</h3>
              <p className="text-sm text-muted mt-1">{f.tavsif}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Tariflar */}
      <section className="mx-auto max-w-5xl px-4 pb-14">
        <h2 className="font-heading text-lg font-semibold text-fg text-center mb-6">Tarif</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLANLAR.map((plan) => (
            <Card key={plan.code} className="flex flex-col text-center">
              <h3 className="font-semibold text-fg text-base">{plan.nomi}</h3>
              <p className="mt-2">
                <span className="font-display text-xl font-bold text-fg tnum">{formatSom(plan.oylikNarx)}</span>
                <span className="text-muted text-sm"> soʻm / oy</span>
              </p>
              <p className="text-sm text-muted mt-3">{plan.tavsif}</p>
              <p className="text-sm text-income-fg font-medium mt-2">Avval 14 kun bepul sinaysiz</p>
              {/* `mt-auto` — tugmalar uchala kartada ham bir chiziqda turadi. */}
              <div className="mt-auto pt-5">
                <LinkButton href="/signup" size="lg" className="px-8">
                  Boshlash
                </LinkButton>
              </div>
            </Card>
          ))}
        </div>
        <p className="text-center text-2xs text-faint mt-4">
          Savollar bormi?{" "}
          <Link href="/maxfiylik" className="hover:text-fg transition">
            Maxfiylik siyosati
          </Link>
        </p>
      </section>
    </PublicShell>
  );
}
