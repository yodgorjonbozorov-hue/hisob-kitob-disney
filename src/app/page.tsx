import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { Boshlash } from "@/components/landing/Boshlash";
import { Hero } from "@/components/landing/Hero";
import { Hisobotlar } from "@/components/landing/Hisobotlar";
import { Imkoniyatlar } from "@/components/landing/Imkoniyatlar";
import { KunYakuni } from "@/components/landing/KunYakuni";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { LandingNav } from "@/components/landing/LandingNav";
import { Muammolar } from "@/components/landing/Muammolar";
import { Narx } from "@/components/landing/Narx";
import { Rollar } from "@/components/landing/Rollar";
import { Savollar } from "@/components/landing/Savollar";
import { Telegram } from "@/components/landing/Telegram";
import { YakuniyCta } from "@/components/landing/YakuniyCta";

export const metadata = {
  title: `${BRAND.nomi} — ${BRAND.tagline}`,
  description:
    "Kirim-chiqim, kunlik hisobot, ombor va qarzdorlik — bitta tizimda. Xodim kassani sanab " +
    "topshiradi, siz Telegramdan tasdiqlaysiz. 14 kun bepul.",
};

/**
 * Bosh sahifa (landing) — `Balansa Landing.dc.html` dizayni bo'yicha.
 *
 * Bo'limlar tartibi ataylab shunday: har biri xaridorning navbatdagi savoliga
 * javob beradi (bo'lim oxiridagi punktir izohga qarang) — muammo → yechim →
 * bot → imkoniyatlar → rollar → hisobot → boshlash → narx → savollar.
 *
 * Bu sahifa `PublicShell` ni ISHLATMAYDI: uning o'z qorong'i paneli va footeri
 * bor (hero ustidan suzadigan panel). Qolgan public sahifalar (kirish,
 * ro'yxatdan o'tish, maxfiylik) avvalgidek `PublicShell` da qoladi.
 *
 * Tizimga kirgan foydalanuvchi bu yerni umuman ko'rmaydi — darhol ilovaga.
 */
export default async function LandingPage() {
  const session = await getSession();
  if (session.userId) {
    redirect(session.rol === "SUPERADMIN" ? "/superadmin" : "/app");
  }

  return (
    // `data-landing` — globals.css dagi landing qoidalarining va
    // `LandingMotion` ning ildizi. `overflow-hidden` gradientlar sahifadan
    // gorizontal siljish yaratmasligi uchun.
    <div data-landing className="overflow-hidden bg-app text-fg">
      <LandingNav />
      <Hero />
      <Muammolar />
      <KunYakuni />
      <Telegram />
      <Imkoniyatlar />
      <Rollar />
      <Hisobotlar />
      <Boshlash />
      <Narx />
      <Savollar />
      <YakuniyCta />
      <LandingFooter />
      <LandingMotion />
    </div>
  );
}
