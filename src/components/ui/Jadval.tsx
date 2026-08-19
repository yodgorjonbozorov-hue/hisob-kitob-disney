import { cn } from "@/lib/cn";

/**
 * RESPONSIV MA'LUMOT JADVALI — ilova bo'ylab yagona manba.
 *
 * MUAMMO: oddiy `<table>` telefonda 6-8 ustunni siqib sig'dirolmaydi.
 * Natijada jadval qutidan chiqib ketadi va BUTUN SAHIFA yon tomonga
 * suriladi: yuqoridagi panel ekrandan chiqib ketadi, foydalanuvchi
 * qayerdaligini yo'qotadi.
 *
 * YECHIM — bitta ustun ta'rifidan ikki ko'rinish quriladi:
 *  · ≥1024px — haqiqiy jadval (ustunlar tekislangan, zich);
 *  · <1024px — har qator KARTOChKA: sarlavha + "ustun nomi / qiymat"
 *    juftliklari + barmoqqa mos amal tugmalari.
 * Gorizontal siljish faqat jadval konteynerida bo'ladi (`.jadval-siljish`).
 */

export interface Ustun<T> {
  kalit: string;
  sarlavha: string;
  /** Qator uchun katak mazmuni. */
  katak: (qator: T) => React.ReactNode;
  /** Raqamli ustun — o'ngga tekislanadi va tabular bo'ladi. */
  raqam?: boolean;
  /** Mobil kartochkada ko'rsatilmaydi (desktop jadvalda qoladi). */
  mobilYashir?: boolean;
  className?: string;
}

/** Qator amali. Desktop'da matnli tugma, mobil'da to'liq bosish zonasi. */
export interface Amal {
  label: string;
  /** Tugma amali. `href` berilsa yozilmaydi. */
  onClick?: () => void;
  /** Havola amali (chek, kartochka) — `<a>` bo'lib chiqadi. */
  href?: string;
  /** Havolani yangi oynada ochish (chek PDF). */
  yangiOyna?: boolean;
  /** Tugma ma'nosi: `xavf` — o'chirish, `ogoh` — tozalash/qaytarish. */
  tur?: "oddiy" | "asosiy" | "ijobiy" | "ogoh" | "xavf";
}

const AMAL_MATN: Record<NonNullable<Amal["tur"]>, string> = {
  oddiy: "text-muted hover:text-fg",
  asosiy: "text-muted hover:text-brand",
  ijobiy: "text-muted hover:text-income",
  ogoh: "text-muted hover:text-debt",
  xavf: "text-muted hover:text-expense",
};

/** Mobil kartochkadagi chip — bosish zonasi 36px dan kam bo'lmaydi. */
const AMAL_CHIP: Record<NonNullable<Amal["tur"]>, string> = {
  oddiy: "bg-surface-2 text-fg border-line",
  asosiy: "bg-brand-wash text-brand border-transparent",
  ijobiy: "bg-income-soft text-income-fg border-transparent",
  ogoh: "bg-debt-soft text-debt-fg border-transparent",
  xavf: "bg-expense-soft text-expense-fg border-transparent",
};

/** Bitta amal — `href` bo'lsa havola, aks holda tugma. Uslub tashqaridan. */
function AmalTugmasi({ amal, className }: { amal: Amal; className: string }) {
  if (amal.href) {
    return (
      <a
        href={amal.href}
        {...(amal.yangiOyna ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={className}
      >
        {amal.label}
      </a>
    );
  }
  return (
    <button type="button" onClick={amal.onClick} className={className}>
      {amal.label}
    </button>
  );
}

export function Jadval<T>({
  ustunlar,
  qatorlar,
  kalit,
  amallar,
  bosh,
  minKenglik,
}: {
  ustunlar: Ustun<T>[];
  qatorlar: T[];
  kalit: (qator: T) => string;
  /** Qator amallari (tahrirlash, o'chirish…). Bo'lsa oxirgi ustun bo'lib chiqadi. */
  amallar?: (qator: T) => Amal[];
  /** Ro'yxat bo'sh bo'lgandagi ko'rinish. */
  bosh?: React.ReactNode;
  /**
   * Desktop jadvalining eng kam kengligi (masalan `"min-w-[60rem]"`).
   * Ustun ko'p bo'lsa beriladi: ustunlar siqilib bir-biriga tegib qolmaydi,
   * o'rniga jadval o'z konteynerida suriladi.
   */
  minKenglik?: string;
}) {
  if (qatorlar.length === 0) return <>{bosh}</>;

  return (
    <>
      {/* ── Desktop: jadval ─────────────────────────────────────────── */}
      <div className="hidden lg:block jadval-siljish">
        <table className={cn("w-full text-sm", minKenglik)}>
          <thead>
            <tr className="text-left text-faint text-xs uppercase border-b border-line">
              {ustunlar.map((u) => (
                <th
                  key={u.kalit}
                  scope="col"
                  className={cn(
                    "pb-2 pr-4 last:pr-0 font-medium whitespace-nowrap",
                    u.raqam && "text-right"
                  )}
                >
                  {u.sarlavha}
                </th>
              ))}
              {amallar && <th className="pb-2 font-medium text-right">Amal</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {qatorlar.map((q) => (
              <tr key={kalit(q)} className="hover:bg-surface-2/50 transition">
                {ustunlar.map((u) => (
                  <td
                    key={u.kalit}
                    className={cn(
                      "py-2.5 pr-4 last:pr-0 align-middle",
                      u.raqam && "text-right tnum",
                      u.className
                    )}
                  >
                    {u.katak(q)}
                  </td>
                ))}
                {amallar && (
                  <td className="py-2.5 pl-4 text-right whitespace-nowrap">
                    {amallar(q).map((a) => (
                      <AmalTugmasi
                        key={a.label}
                        amal={a}
                        className={cn(
                          "text-xs font-medium ml-3 first:ml-0",
                          AMAL_MATN[a.tur ?? "oddiy"]
                        )}
                      />
                    ))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobil/planshet: kartochkalar ─────────────────────────────── */}
      <ul className="lg:hidden space-y-2.5 list-none">
        {qatorlar.map((q) => {
          const qatorAmallari = amallar?.(q) ?? [];
          return (
            <li
              key={kalit(q)}
              className="rounded-xl border border-line bg-surface-2/40 p-3.5"
            >
              <div className="font-medium text-fg text-base leading-snug">
                {ustunlar[0].katak(q)}
              </div>

              <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
                {ustunlar.slice(1).map((u) =>
                  u.mobilYashir ? null : (
                    <div key={u.kalit} className="min-w-0">
                      <dt className="text-2xs text-faint uppercase tracking-wide">{u.sarlavha}</dt>
                      <dd className={cn("text-sm text-fg mt-0.5", u.raqam && "tnum")}>
                        {u.katak(q)}
                      </dd>
                    </div>
                  )
                )}
              </dl>

              {qatorAmallari.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line flex flex-wrap gap-2">
                  {qatorAmallari.map((a) => (
                    <AmalTugmasi
                      key={a.label}
                      amal={a}
                      className={cn(
                        "inline-flex items-center px-3 min-h-[36px] rounded-lg border text-xs font-medium active:scale-[0.98] transition",
                        AMAL_CHIP[a.tur ?? "oddiy"]
                      )}
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
