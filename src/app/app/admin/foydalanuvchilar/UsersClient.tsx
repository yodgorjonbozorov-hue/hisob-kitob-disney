"use client";

import { useState, FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatDateUZ } from "@/lib/format";

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
}

export function UsersClient({
  initialUsers,
  currentUserId,
  businesses,
}: {
  initialUsers: UserDTO[];
  currentUserId: string;
  businesses: BusinessOption[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [modalOpen, setModalOpen] = useState(false);

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

  async function changeRol(u: UserDTO, rol: string) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rol }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? { ...x, rol: updated.rol, businessId: updated.businessId, businessNomi: updated.business?.nomi ?? null }
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
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-xs uppercase">
              <th className="pb-2">Ism</th>
              <th className="pb-2">Login</th>
              <th className="pb-2">Rol</th>
              <th className="pb-2">Biznes</th>
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
                    ROL_LABEL[u.rol] ?? u.rol
                  ) : (
                    <select
                      value={u.rol}
                      onChange={(e) => changeRol(u, e.target.value)}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-sm"
                    >
                      <option value="CASHIER">Kassir</option>
                      <option value="SELLER">Sotuvchi</option>
                      <option value="OWNER">Direktor</option>
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
                <td className="py-2.5">
                  <Badge tone={u.isActive ? "kirim" : "neutral"}>{u.isActive ? "Faol" : "Nofaol"}</Badge>
                </td>
                <td className="py-2.5 text-muted">{formatDateUZ(new Date(u.createdAt))}</td>
                <td className="py-2.5 text-right whitespace-nowrap">
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
      </Card>

      {modalOpen && (
        <NewUserModal businesses={businesses} onClose={() => setModalOpen(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}

function NewUserModal({
  businesses,
  onClose,
  onCreated,
}: {
  businesses: BusinessOption[];
  onClose: () => void;
  onCreated: (u: UserDTO) => void;
}) {
  const [ism, setIsm] = useState("");
  const [login, setLogin] = useState("");
  const [parol, setParol] = useState("");
  const [rol, setRol] = useState<"OWNER" | "CASHIER" | "SELLER">("CASHIER");
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      body: JSON.stringify({ ism, login, parol, rol, businessId: rol === "CASHIER" || rol === "SELLER" ? businessId || null : null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Xatolik yuz berdi");
      setLoading(false);
      return;
    }
    onCreated(data);
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
          onChange={(e) => setRol(e.target.value as "OWNER" | "CASHIER" | "SELLER")}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        >
          <option value="CASHIER">Kassir</option>
          <option value="SELLER">Sotuvchi</option>
          <option value="OWNER">Direktor</option>
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
