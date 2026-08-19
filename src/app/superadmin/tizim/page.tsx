import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import { can, r } from "@/lib/superadmin/rbac";
import { tizimSoglikCached, bazaOlchovlari } from "@/lib/superadmin/tizim";
import { bayroqlarRoyxati } from "@/lib/superadmin/bayroqlar";
import { formatToshkentVaqt } from "@/lib/format";
import { Bolim, SahifaSarlavha } from "@/components/superadmin/Bolim";
import { SoglikBelgisi } from "@/components/superadmin/belgilar";
import { BayroqPaneli } from "@/components/superadmin/BayroqPaneli";

export const dynamic = "force-dynamic";

/**
 * TIZIM SOG'LIG'I (talab 27-31).
 *
 * Mavjud bo'lmagan komponent (Redis, navbat) uchun soxta "SOG'LOM" yozilmaydi
 * — u SOZLANMAGAN deb ko'rsatiladi va sababi tushuntiriladi. Ma'lumotlar
 * bazasiga ixtiyoriy SQL yuborish imkoniyati bu sahifada ATAYLAB yo'q.
 */
export default async function TizimSahifasi() {
  const session = await requireSuperadminRuxsat(r("tizim", "VIEW"));
  const [soglik, olchovlar, bayroqlar] = await Promise.all([
    tizimSoglikCached("sahifa"),
    bazaOlchovlari(),
    bayroqlarRoyxati(),
  ]);

  return (
    <div className="space-y-4">
      <SahifaSarlavha
        sarlavha="Tizim"
        izoh={`${soglik.muhit} muhiti${soglik.commit ? ` · commit ${soglik.commit}` : ""} · ${formatToshkentVaqt(soglik.vaqt)}`}
        amallar={<SoglikBelgisi holat={soglik.umumiy} />}
      />

      <Bolim sarlavha="Komponentlar">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {soglik.komponentlar.map((k) => (
            <li key={k.kalit} className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-fg">{k.nomi}</p>
                <SoglikBelgisi holat={k.holat} />
              </div>
              <p className="text-2xs text-muted mt-1">{k.izoh}</p>
            </li>
          ))}
        </ul>
        <p className="text-2xs text-faint mt-3">
          Sirlar (token, parol, ulanish satri) bu sahifada hech qachon ko&apos;rsatilmaydi — faqat
          &quot;sozlanganmi&quot; degan javob beriladi.
        </p>
      </Bolim>

      <Bolim sarlavha="Ma'lumotlar bazasi" izoh="Asosiy jadvallar bo'yicha yozuvlar soni">
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {olchovlar.map((o) => (
            <li key={o.jadval} className="rounded-lg bg-surface-2 p-3">
              <p className="text-2xs text-muted">{o.jadval}</p>
              <p className="text-base font-display text-fg tabular-nums">
                {o.soni.toLocaleString("ru-RU")}
              </p>
            </li>
          ))}
        </ul>
      </Bolim>

      <Bolim
        sarlavha="Feature flag'lar"
        izoh="Global yoki tanlangan kompaniyalar uchun mahsulot bayroqlari"
      >
        {bayroqlar.length === 0 && !can(session.superRol, "tizim", "MANAGE") ? (
          <p className="text-sm text-muted">Hozircha bayroq yo&apos;q.</p>
        ) : (
          <BayroqPaneli
            bayroqlar={bayroqlar.map((b) => ({
              id: b.id,
              kalit: b.kalit,
              nomi: b.nomi,
              tavsif: b.tavsif,
              doira: b.doira,
              yoqilgan: b.yoqilgan,
              tenantSoni: b.tenantIdlar.length,
            }))}
            ozgartirishMumkin={can(session.superRol, "tizim", "MANAGE")}
          />
        )}
      </Bolim>

      <Bolim sarlavha="Zaxira siyosati">
        <ul className="text-sm text-fg space-y-1">
          <li>· Kunlik zaxira cron orqali olinadi va Telegram zaxira kanaliga yuboriladi.</li>
          <li>· Deploy oldidan kutayotgan migratsiya bo&apos;lsa, zaxirasiz build TO&apos;XTAYDI.</li>
          <li>· Zaxira fayli va kanal sirlari panelda ko&apos;rsatilmaydi.</li>
        </ul>
        <p className="text-2xs text-faint mt-2">
          Yuqoridagi &quot;Zaxira (backup)&quot; kartochkasi oxirgi muvaffaqiyatli zaxira vaqtini
          ko&apos;rsatadi.
        </p>
      </Bolim>
    </div>
  );
}
