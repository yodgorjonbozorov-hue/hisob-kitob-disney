import { ROL_LABEL, type Rol } from "@/lib/auth/roles";
import { Bolim, BolimIzoh, BolimSarlavha } from "./qismlar";

/** Jadval ustunlari — tenant ichidagi rollar (SUPERADMIN platforma roli, bu yerga kirmaydi). */
const USTUNLAR: Rol[] = ["OWNER", "ADMIN", "CASHIER", "SELLER"];

/** Har amal uchun: qaysi rollarda ruxsat bor. `src/lib/auth/guard.ts` bilan mos. */
const QATORLAR: { amal: string; ruxsat: Rol[] }[] = [
  { amal: "Yozuv kiritish", ruxsat: ["OWNER", "ADMIN", "CASHIER", "SELLER"] },
  { amal: "Barcha yozuvlarni ko'rish", ruxsat: ["OWNER", "ADMIN"] },
  { amal: "Kun yakunini tasdiqlash", ruxsat: ["OWNER", "ADMIN"] },
  { amal: "Xodim qo'shish", ruxsat: ["OWNER", "ADMIN"] },
];

const BOSH_KATAK =
  "px-3 py-4 text-[12px] font-semibold uppercase tracking-[0.04em] text-faint";

/**
 * "Har kim o'z ishini ko'radi" — rollar matritsasi. Xodim nimani ko'ra oladi
 * degan savolga javob beradi: sotuvchi va kassir boshqa yozuvlarni ko'rmaydi.
 */
export function Rollar() {
  return (
    <Bolim eni={1000}>
      <BolimSarlavha>Har kim o&apos;z ishini ko&apos;radi</BolimSarlavha>

      <div
        data-reveal
        className="mt-10 overflow-hidden rounded-[24px] border border-line bg-surface shadow-lift max-[900px]:overflow-x-auto"
      >
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="bg-surface-2">
              <th scope="col" className={`${BOSH_KATAK} px-6 text-left`}>
                Amal
              </th>
              {USTUNLAR.map((rol) => (
                <th key={rol} scope="col" className={BOSH_KATAK}>
                  {ROL_LABEL[rol]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {QATORLAR.map((q) => (
              <tr key={q.amal}>
                <th
                  scope="row"
                  className="border-t border-line px-6 py-[18px] text-left text-[16px] font-normal text-fg"
                >
                  {q.amal}
                </th>
                {USTUNLAR.map((rol) => {
                  const bor = q.ruxsat.includes(rol);
                  return (
                    <td key={rol} className="border-t border-line text-center">
                      <span className={bor ? "text-income" : "text-faint"}>
                        {bor ? "✓" : "—"}
                      </span>
                      <span className="sr-only">{bor ? "ruxsat bor" : "ruxsat yo'q"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p data-reveal className="m-0 mt-5 max-w-[60ch] text-[16px] leading-[1.6] text-muted">
        Kassir faqat o&apos;zi kiritgan yozuvni ko&apos;radi. Har o&apos;zgarish audit jurnalida
        qoladi.
      </p>

      <BolimIzoh savol="«Xodimlarim hammasini ko'rib qolmaydimi?»" />
    </Bolim>
  );
}
