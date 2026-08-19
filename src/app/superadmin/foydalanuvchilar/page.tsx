import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import { can, r } from "@/lib/superadmin/rbac";
import { foydalanuvchilarRoyxati } from "@/lib/superadmin/foydalanuvchilar";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { formatRelative, formatDate } from "@/lib/format";
import { SahifaSarlavha } from "@/components/superadmin/Bolim";
import { Filtrlar } from "@/components/superadmin/Filtrlar";
import { Sahifalash } from "@/components/superadmin/Sahifalash";
import { Eksport } from "@/components/superadmin/Eksport";
import { UserlarJadvali } from "@/components/superadmin/UserlarJadvali";

export const dynamic = "force-dynamic";

/** GLOBAL FOYDALANUVCHILAR (talab 14). */
export default async function FoydalanuvchilarSahifasi({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const session = await requireSuperadminRuxsat(r("foydalanuvchilar", "VIEW"));
  const p = new URLSearchParams(
    Object.entries(searchParams).filter((e): e is [string, string] => e[1] !== undefined)
  );

  const natija = await foydalanuvchilarRoyxati(
    {
      qidiruv: searchParams.qidiruv ?? null,
      rol: searchParams.rol ?? null,
      faol: searchParams.faol === "ha" ? true : searchParams.faol === "yoq" ? false : null,
      telegram:
        searchParams.telegram === "ha" ? true : searchParams.telegram === "yoq" ? false : null,
    },
    sahifaParametrlari(p)
  );

  return (
    <div className="space-y-4">
      <SahifaSarlavha
        sarlavha="Foydalanuvchilar"
        izoh={`${natija.jami.toLocaleString("ru-RU")} ta hisob (barcha kompaniyalar bo'ylab)`}
        amallar={can(session.superRol, "eksport", "VIEW") ? <Eksport turi="foydalanuvchilar" /> : null}
      />

      <Filtrlar
        qidiruvPlaceholder="Ism, login yoki ID"
        tanlovlar={[
          {
            kalit: "rol",
            label: "Rol",
            variantlar: [
              { qiymat: "SUPERADMIN", label: "Super admin" },
              { qiymat: "OWNER", label: "Direktor" },
              { qiymat: "ADMIN", label: "Administrator" },
              { qiymat: "CASHIER", label: "Kassir" },
              { qiymat: "SELLER", label: "Sotuvchi" },
            ],
          },
          {
            kalit: "faol",
            label: "Holat",
            variantlar: [
              { qiymat: "ha", label: "Faol" },
              { qiymat: "yoq", label: "Bloklangan" },
            ],
          },
          {
            kalit: "telegram",
            label: "Telegram",
            variantlar: [
              { qiymat: "ha", label: "Ulangan" },
              { qiymat: "yoq", label: "Ulanmagan" },
            ],
          },
        ]}
      />

      <UserlarJadvali
        qatorlar={natija.qatorlar.map((q) => ({
          id: q.id,
          ism: q.ism,
          login: q.login,
          rolLabel: q.rolLabel,
          superadminRol: q.superadminRol,
          isActive: q.isActive,
          telegramUlangan: q.telegramUlangan,
          tenantNomi: q.tenantNomi,
          lastLoginAt: q.lastLoginAt ? formatRelative(q.lastLoginAt) : "hech qachon",
          createdAt: formatDate(q.createdAt),
        }))}
        superRol={session.superRol}
        ozId={session.userId}
      />

      <Sahifalash
        sahifa={natija.sahifa}
        sahifalar={natija.sahifalar}
        jami={natija.jami}
        limit={natija.limit}
      />
    </div>
  );
}
