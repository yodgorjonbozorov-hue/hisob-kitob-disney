import type { ModulStatistika } from "@/lib/superadmin/service";

/**
 * MODUL STATISTIKASI — qaysi modulni nechta kompaniya yoqqan.
 *
 * "Nechta mijozimizda kassa ishlayapti" savoliga javob bo'lmasa, modul
 * rivojiga qancha kuch sarflashni ham, kimga qo'ng'iroq qilishni ham bilib
 * bo'lmaydi.
 *
 * "Yarim sozlangan" raqami ayniqsa muhim: MAGAZIN moduli yoqilgan, lekin
 * hech bir bizneste kassa belgilanmagan mijoz modulni sotib olgan-u, undan
 * FOYDALANMAYAPTI — bunday mijozga yordam kerak.
 */
export function ModulStatistikasi({ stat }: { stat: ModulStatistika }) {
  return (
    <div className="bg-surface rounded-xl border border-line p-4">
      <h2 className="font-semibold text-fg mb-3">Modullar bo&apos;yicha</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <Katak label="Ombor yuritadigan bizneslar" value={stat.omborliBizneslar} />
        <Katak label="Kassa (POS) yoqilgan bizneslar" value={stat.magazinBizneslar} />
        <Katak
          label="Magazin yoqilgan, kassasi sozlanmagan"
          value={stat.magazinYarimSozlangan}
          ogoh={stat.magazinYarimSozlangan > 0}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-xs uppercase">
              <th className="pb-2">Modul</th>
              <th className="pb-2 text-right">Kompaniyalar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stat.modullar.map((m) => (
              <tr key={m.code}>
                <td className="py-2 text-fg">{m.nomi}</td>
                <td className="py-2 text-right tnum text-muted">{m.tenantlar}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Katak({ label, value, ogoh = false }: { label: string; value: number; ogoh?: boolean }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-xl font-bold tnum mt-1 ${ogoh ? "text-expense-fg" : "text-fg"}`}>
        {value}
      </p>
    </div>
  );
}
