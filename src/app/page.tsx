import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PLANLAR } from "@/lib/billing/plans";
import { SETUP_FEE_USD, TRIAL_KUNLARI } from "@/lib/billing/constants";
import { DisneyLogo } from "@/components/DisneyLogo";

export const metadata = {
  title: "Hisob-Kitob — biznesingiz uchun kirim-chiqim tizimi",
  description:
    "Kirim-chiqim, ombor, sotuv va qarzdorlik hisobi — hisobotlar, Telegram bot va bir nechta biznes bitta tizimda. Akkauntni o'zimiz sozlab topshiramiz.",
};

const IMKONIYATLAR = [
  { icon: "📊", nomi: "Boshqaruv paneli", tavsif: "Kirim, chiqim, sof foyda va dinamika — bir qarashda. Oylik hisobotlar PDF va Excel'da." },
  { icon: "🤝", nomi: "CRM", tavsif: "Bitimlar kanbani, kontaktlar, faoliyat tarixi. Yutilgan bitim 1 klikda kirimga aylanadi." },
  { icon: "✅", nomi: "Vazifalar", tavsif: "Jamoa vazifalari: mas'ul, muddat, kanban. Muddati kelganda Telegram eslatma." },
  { icon: "✨", nomi: "AI yordamchi", tavsif: "\"Bu oy qanday o'tdi?\" — raqamlaringiz bo'yicha savol-javob va AI xulosalar." },
  { icon: "📦", nomi: "Ombor va sotuv", tavsif: "Mahsulot qoldig'i, sotuv (naqd/qarz), qarzdorlik va to'lovlar nazorati." },
  { icon: "🤖", nomi: "Telegram bot", tavsif: "Kirim-chiqim va leadlarni botdan kiriting, har kuni ertalab kunlik xulosa oling." },
  { icon: "🏪", nomi: "Bir nechta biznes", tavsif: "Har bir filial yoki yo'nalish alohida — raqamlar aralashmaydi." },
  { icon: "🧩", nomi: "Modulli tizim", tavsif: "Keragini yoqasiz, keraksizini o'chirasiz — interfeys ortiqcha narsasiz qoladi." },
  { icon: "👥", nomi: "Rollar va audit", tavsif: "Direktor, kassir, sotuvchi — har kim o'z huquqi bilan. Har o'zgarish audit jurnalida." },
];

/** Public landing — mahsulot tavsifi va demo so'rovi. Tizimdagi foydalanuvchi darhol ilovaga o'tadi. */
export default async function LandingPage() {
  const session = await getSession();
  if (session.userId) {
    redirect(session.rol === "SUPERADMIN" ? "/superadmin" : "/app");
  }

  return (
    <div className="min-h-screen bg-app">
      {/* Header */}
      <header className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <DisneyLogo className="w-7 h-9 text-fg" />
          <span className="font-semibold text-fg text-lg">Hisob-Kitob</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-muted hover:text-fg">
            Kirish
          </Link>
          <Link
            href="/demo"
            className="text-sm font-medium bg-income text-white rounded-lg px-4 py-2 hover:brightness-110 transition"
          >
            Demo so'rash
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 pt-14 pb-12 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-fg leading-tight">
          Biznesingiz pulini <span className="text-brand">aniq hisobda</span> tuting
        </h1>
        <p className="text-muted mt-5 text-lg max-w-xl mx-auto">
          Kirim-chiqim, ombor, sotuv va qarzdorlik — telefon va kompyuterda ishlaydigan bitta sodda tizim.
          Excel'dagi tartibsizlikka chek qo'ying.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/demo"
            className="bg-income text-white font-medium rounded-xl px-8 py-3.5 text-lg hover:brightness-110 transition"
          >
            Demo so'rash
          </Link>
          <Link href="/login" className="text-brand font-medium px-4 py-3.5 hover:underline">
            Hisobim bor →
          </Link>
        </div>
        <p className="text-xs text-faint mt-3">
          {TRIAL_KUNLARI} kun sizga bepul · Akkauntni o'zimiz sozlab, login-parol bilan topshiramiz
        </p>
      </section>

      {/* Demo video joyi */}
      <section className="max-w-3xl mx-auto px-4 pb-14">
        <div className="aspect-video rounded-2xl border border-line bg-surface shadow-card flex flex-col items-center justify-center text-center p-6">
          <span className="text-5xl mb-3">▶️</span>
          <p className="font-medium text-fg">Demo video</p>
          <p className="text-sm text-faint mt-1">Tez orada — tizim bilan 2 daqiqada tanishing</p>
        </div>
      </section>

      {/* Imkoniyatlar */}
      <section className="max-w-5xl mx-auto px-4 pb-14">
        <h2 className="text-2xl font-bold text-fg text-center mb-8">Nimalar qila oladi?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {IMKONIYATLAR.map((f) => (
            <div key={f.nomi} className="bg-surface rounded-2xl border border-line p-5">
              <span className="text-2xl">{f.icon}</span>
              <h3 className="font-semibold text-fg mt-2">{f.nomi}</h3>
              <p className="text-sm text-muted mt-1">{f.tavsif}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tariflar */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-fg text-center mb-8">Tariflar</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {PLANLAR.map((plan) => (
            <div key={plan.code} className="bg-surface rounded-2xl border border-line shadow-card p-7 text-center">
              <h3 className="font-semibold text-fg text-lg">{plan.nomi}</h3>
              <p className="mt-3">
                <span className="text-4xl font-bold text-fg tnum">{plan.oylikNarx.toLocaleString("ru-RU")}</span>
                <span className="text-muted"> so'm / oy</span>
              </p>
              <p className="text-sm text-muted mt-3">{plan.tavsif}</p>
            </div>
          ))}
        </div>
        <div className="bg-surface rounded-2xl border border-line p-6 mt-4 text-center">
          <p className="text-fg font-medium">
            Bir martalik o'rnatish: <span className="tnum">{SETUP_FEE_USD}$</span>
          </p>
          <p className="text-sm text-muted mt-1">
            Tizimga tushirish, sozlash va jamoangizni o'qitish — bir marta to'lanadi.
          </p>
          <p className="text-sm text-income-fg font-medium mt-3">
            {TRIAL_KUNLARI} kun sizga bepul — akkauntni o'zimiz sozlab, login-parol bilan topshiramiz.
          </p>
          <Link
            href="/demo"
            className="inline-block mt-5 bg-income text-white font-medium rounded-xl px-8 py-3 hover:brightness-110 transition"
          >
            Demo so'rash
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-8 text-center text-sm text-faint">
        <p>Hisob-Kitob · biznes uchun kirim-chiqim tizimi</p>
        <p className="mt-1">
          <Link href="/login" className="hover:text-fg">Kirish</Link> ·{" "}
          <Link href="/demo" className="hover:text-fg">Demo so'rash</Link>
        </p>
      </footer>
    </div>
  );
}
