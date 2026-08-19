import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { modulQamrovi } from "@/lib/superadmin/modullar";
import { bogliqlikGrafigi } from "@/lib/modules/bogliqlik";
import { PLANLAR } from "@/lib/billing/plans";
import { Bolim, SahifaSarlavha } from "@/components/superadmin/Bolim";
import { UstunliGrafik } from "@/components/superadmin/Grafik";
import { Belgi } from "@/components/superadmin/belgilar";

export const dynamic = "force-dynamic";

/**
 * MODULLAR — platforma kesimi (talab 12/13).
 *
 * Bu sahifa modul QAMROVINI va BOG'LIQLIK grafigini ko'rsatadi. Aniq bir
 * kompaniyaning modullari uning kartochkasida boshqariladi (Bizneslar →
 * kompaniya → Modullar) — chunki modul har doim bitta mijozga tegishli qaror.
 */
export default async function ModullarSahifasi() {
  await requireSuperadminRuxsat(r("modullar", "VIEW"));

  const [qamrov, grafik] = await Promise.all([modulQamrovi(), Promise.resolve(bogliqlikGrafigi())]);

  return (
    <div className="space-y-4">
      <SahifaSarlavha
        sarlavha="Modullar"
        izoh="Qaysi modul qancha mijozda yoqilgan va modullar bir-biriga qanday bog'liq"
      />

      <Bolim sarlavha="Modul qamrovi" izoh="Yoqilgan kompaniyalar soni">
        <UstunliGrafik
          nuqtalar={qamrov.map((x) => ({ nomi: x.nomi, qiymat: x.soni }))}
          balandlik={320}
        />
      </Bolim>

      <Bolim sarlavha="Batafsil" izoh="Tarifda mavjud bo'lgan mijozlarga nisbatan qamrov">
        <div className="jadval-siljish">
          <table className="w-full text-sm min-w-[32rem]">
            <thead>
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left text-2xs uppercase tracking-wide text-faint">Modul</th>
                <th className="px-3 py-2 text-right text-2xs uppercase tracking-wide text-faint">Yoqilgan</th>
                <th className="px-3 py-2 text-right text-2xs uppercase tracking-wide text-faint">Imkoniyat</th>
                <th className="px-3 py-2 text-right text-2xs uppercase tracking-wide text-faint">Qamrov</th>
              </tr>
            </thead>
            <tbody>
              {qamrov.map((x) => {
                const foiz = x.imkoniyat > 0 ? Math.round((x.soni / x.imkoniyat) * 100) : 0;
                return (
                  <tr key={x.code} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-fg">{x.nomi}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{x.soni}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{x.imkoniyat}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{foiz}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Bolim>

      <Bolim
        sarlavha="Modul bog'liqligi"
        izoh="Faqat KODDA haqiqatan mavjud bog'liqliklar ko'rsatiladi — o'ylab topilgani yo'q"
      >
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {grafik.map((g) => (
            <li key={g.code} className="rounded-lg border border-line p-3">
              <p className="text-sm font-medium text-fg">{g.nomi}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {g.talablar.length === 0 && g.tayanadiganlar.length === 0 && (
                  <span className="text-2xs text-faint">mustaqil modul</span>
                )}
                {g.talablar.map((t) => (
                  <Belgi key={`t-${t}`} ton="ogoh">
                    talab qiladi: {t}
                  </Belgi>
                ))}
                {g.tayanadiganlar.map((t) => (
                  <Belgi key={`b-${t}`} ton="info">
                    unga tayanadi: {t}
                  </Belgi>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Bolim>

      <Bolim sarlavha="Tarif → modul mosligi">
        <ul className="grid gap-2 sm:grid-cols-3">
          {PLANLAR.map((p) => (
            <li key={p.code} className="rounded-lg border border-line p-3">
              <p className="text-sm font-medium text-fg">{p.nomi}</p>
              <p className="text-2xs text-muted mt-1">{p.modullar.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </Bolim>
    </div>
  );
}
