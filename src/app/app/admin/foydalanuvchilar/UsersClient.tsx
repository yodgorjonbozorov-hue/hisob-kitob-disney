"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Jadval, type Ustun } from "@/components/ui/Jadval";
import { formatDateUZ } from "@/lib/format";
import { ParolTiklashModal, LoginTiklashModal } from "./TiklashModal";
import { BiznesModal } from "./BiznesTanlash";
import { YangiUserModal } from "./YangiUserModal";
import { ROL_LABEL, type BusinessOption, type RoleOption, type UserDTO } from "./turlar";

export function UsersClient({
  initialUsers,
  currentUserId,
  businesses,
  customRoles,
  pro,
  moliyaBiznes,
}: {
  initialUsers: UserDTO[];
  currentUserId: string;
  businesses: BusinessOption[];
  customRoles: RoleOption[];
  pro: boolean;
  /** Balans/qarz ustunlari qaysi biznes kesimida (null — biznes tanlanmagan). */
  moliyaBiznes: string | null;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [modalOpen, setModalOpen] = useState(false);
  const [parolUser, setParolUser] = useState<UserDTO | null>(null);
  const [loginUser, setLoginUser] = useState<UserDTO | null>(null);
  // Ko'p-bizneslik: xodim bizneslarini o'zgartirish oynasi.
  const [biznesUser, setBiznesUser] = useState<UserDTO | null>(null);

  async function toggleActive(u: UserDTO) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((x) =>
          x.id === updated.id
            ? { ...x, isActive: updated.isActive }
            : x
        )
      );
    }
  }

  async function deleteUser(u: UserDTO) {
    if (!confirm(`"${u.ism}" (${u.login}) foydalanuvchisini butunlay o'chirasizmi?\n\nYozuvlari bo'lsa — o'chmaydi (o'rniga "Nofaollashtiring").`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } else {
      alert((await res.json()).error ?? "O'chirib bo'lmadi");
    }
  }

  async function changeRol(u: UserDTO, qiymat: string) {
    // "custom:<id>" — maxsus rol (PRO); aks holda tizim roli (maxsus roldan chiqariladi).
    const body = qiymat.startsWith("custom:")
      ? { roleId: qiymat.slice(7) }
      : { rol: qiymat, roleId: null };
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? {
                ...x,
                rol: updated.rol,
                roleId: updated.roleId ?? null,
                rolNomi: updated.role?.nomi ?? null,
                businessId: updated.businessId,
                businessNomi: updated.business?.nomi ?? null,
                businessIds: (updated.bizneslar ?? []).map(
                  (b: { businessId: string }) => b.businessId
                ),
              }
            : x
        )
      );
    } else {
      alert((await res.json()).error ?? "Rolni o'zgartirib bo'lmadi");
    }
  }

  /** KO'P-BIZNESLIK: xodimning biznes ro'yxatini to'liq almashtiradi. */
  async function saqlaBizneslar(u: UserDTO, businessIds: string[]) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessIds }),
    });
    if (!res.ok) {
      alert((await res.json()).error ?? "Bizneslarni o'zgartirib bo'lmadi");
      return;
    }
    const updated = await res.json();
    setUsers((prev) =>
      prev.map((x) =>
        x.id === u.id
          ? {
              ...x,
              businessId: updated.businessId,
              businessNomi: businesses.find((b) => b.id === updated.businessId)?.nomi ?? null,
              businessIds,
            }
          : x
      )
    );
    setBiznesUser(null);
  }

  function handleCreated(u: UserDTO) {
    setUsers((prev) => [...prev, u]);
    setModalOpen(false);
  }

  /** Rol tanlagich — jadvalda ham, mobil kartochkada ham bir xil. */
  function rolKatak(u: UserDTO) {
    if (u.id === currentUserId) return u.rolNomi ?? ROL_LABEL[u.rol] ?? u.rol;
    return (
      <select
        value={u.roleId ? `custom:${u.roleId}` : u.rol}
        onChange={(e) => changeRol(u, e.target.value)}
        aria-label={`${u.ism} — rol`}
        className="w-full max-w-[190px] rounded-lg border border-line bg-surface px-2 py-1 text-sm"
      >
        <option value="CASHIER">Kassir</option>
        <option value="SELLER">Sotuvchi</option>
        <option value="OWNER">Direktor</option>
        {pro && customRoles.length > 0 && (
          <optgroup label="Maxsus rollar">
            {customRoles.map((r) => (
              <option key={r.id} value={`custom:${r.id}`}>
                {r.nomi}
              </option>
            ))}
            {u.roleId && !customRoles.some((r) => r.id === u.roleId) && (
              <option value={`custom:${u.roleId}`}>{u.rolNomi ?? "Maxsus rol"}</option>
            )}
          </optgroup>
        )}
      </select>
    );
  }

  /**
   * Bizneslar katagi — faqat kassir/sotuvchida ma'noga ega.
   * Xodim bir nechta biznesga biriktirilishi mumkin, shuning uchun tanlash
   * alohida oynada (checkbox ro'yxati) bajariladi.
   */
  function biznesKatak(u: UserDTO) {
    if (u.rol !== "CASHIER" && u.rol !== "SELLER") return "Barcha";
    const nomlar = u.businessIds
      .map((id) => businesses.find((b) => b.id === id)?.nomi)
      .filter(Boolean) as string[];
    return (
      <button
        type="button"
        onClick={() => setBiznesUser(u)}
        aria-label={`${u.ism} — bizneslar`}
        className="w-full max-w-[190px] text-left rounded-lg border border-line bg-surface px-2 py-1 text-sm hover:border-brand"
      >
        {nomlar.length === 0
          ? "Barcha bizneslar"
          : nomlar.length <= 2
            ? nomlar.join(", ")
            : `${nomlar.length} ta biznes`}
      </button>
    );
  }

  // Ustun ta'rifi BITTA — desktop jadval ham, mobil kartochka ham shundan.
  const ustunlar: Ustun<UserDTO>[] = [
    {
      kalit: "ism",
      sarlavha: "Ism",
      katak: (u) => (
        <>
          {u.ism}
          {/* Login mobil kartochkada sarlavha ostiga tushadi — alohida ustun shart emas. */}
          <span className="block text-2xs text-faint font-normal lg:hidden">{u.login}</span>
        </>
      ),
    },
    { kalit: "login", sarlavha: "Login", mobilYashir: true, katak: (u) => u.login, className: "text-muted" },
    { kalit: "rol", sarlavha: "Rol", katak: rolKatak },
    { kalit: "biznes", sarlavha: "Bizneslar", katak: biznesKatak, className: "text-muted" },
    // Balans manfiy bo'lishi normal: xodim biznes nomidan pul sarflagan bo'lsa
    // (masalan xarid to'lovi) qarzdorlik emas, uning kassasidan chiqqan pul.
    ...(moliyaBiznes
      ? [
          {
            kalit: "balans",
            sarlavha: "Balans",
            raqam: true,
            className: "whitespace-nowrap",
            katak: (u: UserDTO) => (
              <span className={u.balans > 0 ? "text-income" : u.balans < 0 ? "text-expense" : "text-muted"}>
                {u.balans > 0 ? "+" : ""}
                {u.balans.toLocaleString("uz-UZ")}
              </span>
            ),
          },
          {
            kalit: "qarz",
            sarlavha: "Qarz",
            raqam: true,
            className: "whitespace-nowrap",
            katak: (u: UserDTO) => (
              <span className={u.qarz > 0 ? "text-expense" : "text-muted"}>
                {u.qarz.toLocaleString("uz-UZ")}
              </span>
            ),
          },
          {
            kalit: "amallar",
            sarlavha: "Yozuvlar",
            raqam: true,
            className: "text-muted",
            katak: (u: UserDTO) => u.amallar,
          },
        ]
      : []),
    {
      kalit: "holati",
      sarlavha: "Holati",
      katak: (u) => <Badge tone={u.isActive ? "kirim" : "neutral"}>{u.isActive ? "Faol" : "Nofaol"}</Badge>,
    },
    {
      kalit: "qoshilgan",
      sarlavha: "Qo'shilgan",
      className: "text-muted",
      katak: (u) => formatDateUZ(new Date(u.createdAt)),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModalOpen(true)}>+ Yangi foydalanuvchi</Button>
      </div>

      <Card>
        {moliyaBiznes && (
          <p className="text-2xs text-faint mb-2">
            Balans, qarz va yozuvlar — <span className="font-medium">{moliyaBiznes}</span> kesimida.
          </p>
        )}
        <Jadval
          ustunlar={ustunlar}
          qatorlar={users}
          kalit={(u) => u.id}
          minKenglik="min-w-[60rem]"
          amallar={(u) => [
            { label: "Parol tiklash", onClick: () => setParolUser(u), tur: "asosiy" as const },
            { label: "Login tiklash", onClick: () => setLoginUser(u), tur: "asosiy" as const },
            ...(u.id !== currentUserId
              ? [
                  {
                    label: u.isActive ? "Nofaollashtirish" : "Faollashtirish",
                    onClick: () => void toggleActive(u),
                    tur: "ijobiy" as const,
                  },
                  { label: "O'chirish", onClick: () => void deleteUser(u), tur: "xavf" as const },
                ]
              : []),
          ]}
        />
      </Card>

      {pro && (
        <p className="text-xs text-faint">
          Maxsus rollar (Taminotchi, Omborchi, Haydovchi...) va ularning huquqlari{" "}
          <a href="/app/admin/rollar" className="text-brand hover:underline">
            Rollar va huquqlar
          </a>{" "}
          bo'limida boshqariladi.
        </p>
      )}

      {modalOpen && (
        <YangiUserModal
          businesses={businesses}
          customRoles={pro ? customRoles : []}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {biznesUser && (
        <BiznesModal
          ism={biznesUser.ism}
          businesses={businesses}
          boshlangich={biznesUser.businessIds}
          kassir={biznesUser.rol === "CASHIER"}
          onClose={() => setBiznesUser(null)}
          onSaqla={(idlar) => saqlaBizneslar(biznesUser, idlar)}
        />
      )}

      {parolUser && <ParolTiklashModal user={parolUser} onClose={() => setParolUser(null)} />}

      {loginUser && (
        <LoginTiklashModal
          user={loginUser}
          onClose={() => setLoginUser(null)}
          onSaved={(yangiLogin) => {
            setUsers((prev) =>
              prev.map((x) => (x.id === loginUser.id ? { ...x, login: yangiLogin } : x))
            );
            setLoginUser(null);
          }}
        />
      )}
    </div>
  );
}
