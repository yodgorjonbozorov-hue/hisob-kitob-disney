import Link from "next/link";
import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import {
  can,
  r,
  SUPER_ROLLAR,
  SUPER_ROL_LABEL,
  SUPER_ROL_TAVSIF,
  rolMatritsasi,
  RESURS_LABEL,
  type Resurs,
} from "@/lib/superadmin/rbac";
import { foydalanuvchilarRoyxati } from "@/lib/superadmin/foydalanuvchilar";
import { PLANLAR } from "@/lib/billing/plans";
import { MODULLAR } from "@/lib/modules/registry";
import { formatSom, formatRelative } from "@/lib/format";
import { Bolim, SahifaSarlavha } from "@/components/superadmin/Bolim";
import { Belgi } from "@/components/superadmin/belgilar";

export const dynamic = "force-dynamic";

const RESURSLAR = Object.keys(RESURS_LABEL) as Resurs[];

/**
 * SOZLAMALAR (talab 59).
 *
 * Bu yerda platforma KONFIGURATSIYASI ko'rinadi: admin hisoblar, rol
 * matritsasi, tariflar va modullar. Tarif/modul ta'rifi KODDA saqlanadi
 * (`lib/billing/plans.ts`, `lib/modules/registry.ts`) — ular deploy bilan
 * o'zgaradi, panel orqali emas. Buni yashirmasdan, ochiq yozamiz.
 */
export default async function SozlamalarSahifasi() {
  const session = await requireSuperadminRuxsat(r("sozlamalar", "VIEW"));
  const adminlar = await foydalanuvchilarRoyxati(
    { rol: "SUPERADMIN" },
    { sahifa: 1, limit: 50 }
  );

  return (
    <div className="space-y-4">
      <SahifaSarlavha
        sarlavha="Sozlamalar"
        izoh="Admin hisoblar, rol matritsasi, tariflar va modul katalogi"
      />

      <Bolim
        sarlavha="Superadmin hisoblari"
        izoh={
          can(session.superRol, "sozlamalar", "MANAGE")
            ? "Rolni o'zgartirish uchun hisob kartochkasiga o'ting"
            : "Rolni faqat ROOT superadmin o'zgartira oladi"
        }
      >
        <ul className="divide-y divide-line">
          {adminlar.qatorlar.map((u) => (
            <li key={u.id} className="py-2 flex flex-wrap items-center gap-2">
              <Link
                href={`/superadmin/foydalanuvchilar/${u.id}`}
                className="text-sm text-brand hover:underline flex-1 min-w-[140px]"
              >
                {u.ism}
              </Link>
              <span className="text-2xs text-muted">{u.login}</span>
              {u.superadminRol && <Belgi ton="brend">{SUPER_ROL_LABEL[u.superadminRol]}</Belgi>}
              <Belgi ton={u.isActive ? "muvaffaqiyat" : "xavf"}>
                {u.isActive ? "faol" : "bloklangan"}
              </Belgi>
              <span className="text-2xs text-faint">
                {u.lastLoginAt ? formatRelative(u.lastLoginAt) : "hech qachon kirmagan"}
              </span>
            </li>
          ))}
        </ul>
      </Bolim>

      <Bolim
        sarlavha="Rollar va huquqlar matritsasi"
        izoh="Yagona manba: lib/superadmin/rbac.ts — API ham, panel ham shu jadvalga tayanadi"
      >
        <div className="jadval-siljish">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-line">
                <th className="px-2 py-2 text-left text-2xs uppercase tracking-wide text-faint">
                  Bo&apos;lim
                </th>
                {SUPER_ROLLAR.map((rol) => (
                  <th
                    key={rol}
                    className="px-2 py-2 text-left text-2xs uppercase tracking-wide text-faint"
                  >
                    {SUPER_ROL_LABEL[rol]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESURSLAR.map((resurs) => (
                <tr key={resurs} className="border-b border-line last:border-0">
                  <td className="px-2 py-2 text-fg whitespace-nowrap">{RESURS_LABEL[resurs]}</td>
                  {SUPER_ROLLAR.map((rol) => {
                    const amallar = rolMatritsasi(rol)[resurs];
                    return (
                      <td key={rol} className="px-2 py-2 text-2xs">
                        {amallar.length === 0 ? (
                          <span className="text-faint">—</span>
                        ) : (
                          <span className="text-fg">{amallar.join(" ")}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-1">
          {SUPER_ROLLAR.map((rol) => (
            <li key={rol} className="text-2xs text-muted">
              <span className="text-fg font-medium">{SUPER_ROL_LABEL[rol]}:</span>{" "}
              {SUPER_ROL_TAVSIF[rol]}
            </li>
          ))}
        </ul>
      </Bolim>

      <Bolim
        sarlavha="Tariflar"
        izoh="Tarif ta'rifi kodda (lib/billing/plans.ts) — o'zgarish deploy bilan qo'llanadi"
      >
        <ul className="grid gap-2 sm:grid-cols-3">
          {PLANLAR.map((p) => (
            <li key={p.code} className="rounded-lg border border-line p-3">
              <p className="text-sm font-medium text-fg">
                {p.nomi} · {formatSom(p.oylikNarx)}/oy
              </p>
              <p className="text-2xs text-muted mt-1">{p.tavsif}</p>
              <p className="text-2xs text-faint mt-1">{p.modullar.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </Bolim>

      <Bolim sarlavha="Modul katalogi" izoh="lib/modules/registry.ts — navigatsiya va huquqlar manbai">
        <ul className="grid gap-2 sm:grid-cols-2">
          {MODULLAR.filter((m) => !m.korinmas).map((m) => (
            <li key={m.code} className="rounded-lg border border-line p-3">
              <p className="text-sm font-medium text-fg flex items-center gap-2">
                {m.nomi}
                {m.core && <Belgi ton="info">asosiy</Belgi>}
              </p>
              <p className="text-2xs text-muted mt-1">{m.tavsif}</p>
            </li>
          ))}
        </ul>
      </Bolim>

      <Bolim sarlavha="Feature flag'lar va tizim">
        <p className="text-sm text-muted">
          Feature flag&apos;lar va tizim komponentlari{" "}
          <Link href="/superadmin/tizim" className="text-brand hover:underline">
            Tizim
          </Link>{" "}
          sahifasida boshqariladi.
        </p>
      </Bolim>
    </div>
  );
}
