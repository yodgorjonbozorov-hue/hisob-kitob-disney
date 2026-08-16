"use client";

import { useState, FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatDateUZ } from "@/lib/format";
import { ParolTiklashModal, LoginTiklashModal } from "./TiklashModal";

interface BusinessOption {
  id: string;
  nomi: string;
}

const ROL_LABEL: Record<string, string> = {
  OWNER: "Direktor",
  ADMIN: "Administrator",
  CASHIER: "Kassir",
  SELLER: "Sotuvchi",
};

interface UserDTO {
  id: string;
  ism: string;
  login: string;
  rol: string;
  isActive: boolean;
  createdAt: string;
  businessId: string | null;
  businessNomi: string | null;
  /** Maxsus rol (PRO) — tayinlangan bo'lsa rol select "custom:<id>" ko'rsatadi. */
  roleId: string | null;
  rolNomi: string | null;
  /** Shaxsiy kassalari qoldig'i (ledger'dan, joriy biznes). */
  balans: number;
  /** Ta'minotchi sifatida ochiq qarz (biznes shu odamga qarzdor). */
  qarz: number;
  /** Pul harakatlari soni: tranzaksiyalar + o'tkazmalar. */
  amallar: number;
}

interface RoleOption {
  id: string;
  nomi: string;
}

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
              }
            : x
        )
      );
    } else {
      alert((await res.json()).error ?? "Rolni o'zgartirib bo'lmadi");
    }
  }

  async function changeBusiness(u: UserDTO, businessId: string) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    if (res.ok) {
      const nomi = businesses.find((b) => b.id === businessId)?.nomi ?? null;
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, businessId, businessNomi: nomi } : x))
      );
    } else {
      alert((await res.json()).error ?? "Biznesni o'zgartirib bo'lmadi");
    }
  }

  function handleCreated(u: UserDTO) {
    setUsers((prev) => [...prev, u]);
    setModalOpen(false);
  }

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
        {/* Ustunlar ko'p — tor ekranda jadval o'zi suriladi, sahifa emas. */}
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-faint text-xs uppercase">
              <th className="pb-2">Ism</th>
              <th className="pb-2">Login</th>
              <th className="pb-2">Rol</th>
              <th className="pb-2">Biznes</th>
              {moliyaBiznes && <th className="pb-2 text-right">Balans</th>}
              {moliyaBiznes && <th className="pb-2 text-right">Qarz</th>}
              {moliyaBiznes && <th className="pb-2 text-right">Yozuvlar</th>}
              <th className="pb-2">Holati</th>
              <th className="pb-2">Qo'shilgan</th>
              <th className="pb-2 text-right">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2.5">{u.ism}</td>
                <td className="py-2.5 text-muted">{u.login}</td>
                <td className="py-2.5">
                  {u.id === currentUserId ? (
                    u.rolNomi ?? ROL_LABEL[u.rol] ?? u.rol
                  ) : (
                    <select
                      value={u.roleId ? `custom:${u.roleId}` : u.rol}
                      onChange={(e) => changeRol(u, e.target.value)}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-sm"
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
                  )}
                </td>
                <td className="py-2.5 text-muted">
                  {u.rol === "CASHIER" || u.rol === "SELLER" ? (
                    <select
                      value={u.businessId ?? ""}
                      onChange={(e) => changeBusiness(u, e.target.value)}
                      className="rounded-lg border border-line px-2 py-1 text-sm"
                    >
                      {u.rol === "SELLER" && <option value="">Barcha bizneslar</option>}
                      {u.rol === "CASHIER" && u.businessId === null && <option value="">— (biriktirilmagan)</option>}
                      {businesses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nomi}
                        </option>
                      ))}
                    </select>
                  ) : (
                    "Barcha"
                  )}
                </td>
                {moliyaBiznes && (
                  <>
                    {/* Balans manfiy bo'lishi normal: xodim biznes nomidan pul
                        sarflagan bo'lsa (masalan xarid to'lovi) qarzdorlik emas,
                        shunchaki uning kassasidan chiqqan pul. */}
                    <td className="py-2.5 text-right tnum whitespace-nowrap">
                      <span
                        className={
                          u.balans > 0 ? "text-income" : u.balans < 0 ? "text-expense" : "text-muted"
                        }
                      >
                        {u.balans > 0 ? "+" : ""}
                        {u.balans.toLocaleString("uz-UZ")}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tnum whitespace-nowrap">
                      <span className={u.qarz > 0 ? "text-expense" : "text-muted"}>
                        {u.qarz.toLocaleString("uz-UZ")}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tnum text-muted">{u.amallar}</td>
                  </>
                )}
                <td className="py-2.5">
                  <Badge tone={u.isActive ? "kirim" : "neutral"}>{u.isActive ? "Faol" : "Nofaol"}</Badge>
                </td>
                <td className="py-2.5 text-muted">{formatDateUZ(new Date(u.createdAt))}</td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => setParolUser(u)}
                    className="text-xs font-medium text-muted hover:text-brand mr-3"
                  >
                    Parol tiklash
                  </button>
                  <button
                    onClick={() => setLoginUser(u)}
                    className="text-xs font-medium text-muted hover:text-brand mr-3"
                  >
                    Login tiklash
                  </button>
                  {u.id !== currentUserId && (
                    <>
                      <button
                        onClick={() => toggleActive(u)}
                        className="text-xs font-medium text-muted hover:text-income mr-3"
                      >
                        {u.isActive ? "Nofaollashtirish" : "Faollashtirish"}
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        className="text-xs font-medium text-muted hover:text-expense"
                      >
                        O'chirish
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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
        <NewUserModal
          businesses={businesses}
          customRoles={pro ? customRoles : []}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
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

function NewUserModal({
  businesses,
  customRoles,
  onClose,
  onCreated,
}: {
  businesses: BusinessOption[];
  customRoles: RoleOption[];
  onClose: () => void;
  onCreated: (u: UserDTO) => void;
}) {
  const [ism, setIsm] = useState("");
  const [login, setLogin] = useState("");
  const [parol, setParol] = useState("");
  // Tizim roli yoki "custom:<id>" (maxsus rol, PRO).
  const [rol, setRol] = useState<string>("CASHIER");
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const custom = rol.startsWith("custom:");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (rol === "CASHIER" && !businessId) {
      setError("Kassir uchun biznes tanlang");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ism,
        login,
        parol,
        rol: custom ? "SELLER" : rol,
        roleId: custom ? rol.slice(7) : null,
        businessId: rol === "CASHIER" || rol === "SELLER" ? businessId || null : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Xatolik yuz berdi");
      setLoading(false);
      return;
    }
    // Yangi foydalanuvchining hali birorta yozuvi yo'q — moliya ustunlari nol.
    onCreated({
      ...data,
      rolNomi: data.role?.nomi ?? null,
      businessNomi: data.business?.nomi ?? null,
      balans: 0,
      qarz: 0,
      amallar: 0,
    });
  }

  return (
    <Modal open onClose={onClose} title="Yangi foydalanuvchi">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={ism}
          onChange={(e) => setIsm(e.target.value)}
          placeholder="Ism"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          required
        />
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Login"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          required
        />
        <input
          type="password"
          value={parol}
          onChange={(e) => setParol(e.target.value)}
          placeholder="Parol (kamida 8 belgi)"
          minLength={8}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          required
        />
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        >
          <option value="CASHIER">Kassir</option>
          <option value="SELLER">Sotuvchi</option>
          <option value="OWNER">Direktor</option>
          {customRoles.length > 0 && (
            <optgroup label="Maxsus rollar">
              {customRoles.map((r) => (
                <option key={r.id} value={`custom:${r.id}`}>
                  {r.nomi}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {(rol === "CASHIER" || rol === "SELLER") && (
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Biznes {rol === "SELLER" && <span className="text-faint">(ixtiyoriy)</span>}
            </label>
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              {rol === "SELLER" && <option value="">Barcha bizneslar (ko'p-biznesli)</option>}
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nomi}
                </option>
              ))}
            </select>
          </div>
        )}
        {rol === "OWNER" && (
          <p className="text-xs text-faint">Direktor barcha bizneslarni ko'radi va almashadi.</p>
        )}
        {rol === "SELLER" && (
          <p className="text-xs text-faint">
            Sotuvchi faqat sotadi (kirim/chiqim/sotuv/qarzlar) — sof foyda va hisobotlarni ko'rmaydi. Biznes
            tanlansa — yozuvlari doim shu biznesga tushadi (adashmaydi). Tanlanmasa — barcha bizneslarni ko'radi.
          </p>
        )}
        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saqlanmoqda..." : "Qo'shish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
