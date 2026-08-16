import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/Logo";

/**
 * Maxfiylik siyosati — Play Market (va umuman do'konlar) uchun majburiy sahifa.
 * Statik, ma'lumot so'ramaydi.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `Maxfiylik siyosati — ${BRAND.nomi}`,
  description: `${BRAND.nomi} foydalanuvchi ma'lumotlarini qanday saqlaydi va himoya qiladi`,
};

export default function MaxfiylikPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10 space-y-6 text-sm text-fg leading-relaxed">
      <Logo variant="full" height={32} />
      <h1 className="text-2xl font-bold">Maxfiylik siyosati</h1>
      <p className="text-muted">Oxirgi yangilanish: 2026-yil 16-avgust</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Qanday ma&apos;lumot yig&apos;amiz</h2>
        <p>
          {BRAND.nomi} — biznes boshqaruv platformasi. Siz kiritgan ma&apos;lumotlar:
          kompaniya nomi, foydalanuvchi ismi va telefon raqami (login), hamda
          biznesingizning moliyaviy yozuvlari (kirim-chiqim, ombor, sotuv, qarzlar).
          Bu ma&apos;lumotlar faqat xizmatni ko&apos;rsatish uchun ishlatiladi.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Ma&apos;lumotlar qayerda saqlanadi</h2>
        <p>
          Ma&apos;lumotlar shifrlangan aloqa (HTTPS) orqali uzatiladi va himoyalangan
          bulutli bazada saqlanadi. Har bir kompaniyaning ma&apos;lumoti boshqalardan
          qat&apos;iy ajratilgan — bir kompaniya boshqasining yozuvlarini ko&apos;ra olmaydi.
          Kunlik zaxira nusxalari avtomatik olinadi.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Uchinchi shaxslarga berish</h2>
        <p>
          Ma&apos;lumotlaringiz sotilmaydi va reklama maqsadida uchinchi shaxslarga
          berilmaydi. Ixtiyoriy ulangan xizmatlar (masalan, Telegram-bot orqali
          bildirishnomalar) faqat siz yoqqan holatda va faqat o&apos;z vazifasi
          doirasida ishlaydi.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Ma&apos;lumotni o&apos;chirish</h2>
        <p>
          Hisobni o&apos;chirishni <span className="font-medium">ilovaning o&apos;zidan</span>{" "}
          boshlashingiz mumkin: <span className="font-medium">Sozlamalar → Hisobni
          o&apos;chirish</span>. Buni kompaniya egasi bajaradi va tasdiq uchun kompaniya
          nomi yoziladi.
        </p>
        <p>
          So&apos;rovdan keyin ilovaga kirish darhol yopiladi. Ma&apos;lumotlar 30 kun
          saqlanadi — shu muddat ichida o&apos;chirishni bekor qilib, hamma narsani
          tiklash mumkin. 30 kun o&apos;tgach kompaniyaga tegishli barcha ma&apos;lumot —
          yozuvlar, ombor, qarzlar, hisobotlar, xodimlar hisoblari va foydalanuvchi
          profillari — bazadan butunlay o&apos;chiriladi va tiklab bo&apos;lmaydi.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Bog&apos;lanish</h2>
        <p>
          Savollar va ma&apos;lumotni o&apos;chirish so&apos;rovlari uchun:{" "}
          <a className="text-brand underline" href={BRAND.url}>{BRAND.url}</a>{" "}
          saytidagi aloqa kanallari orqali murojaat qiling.
        </p>
      </section>
    </div>
  );
}
