"use client";

import { useState, FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatDateUZ } from "@/lib/format";

interface UserDTO {
  id: string;
  ism: string;
  login: string;
  rol: string;
  isActive: boolean;
  createdAt: string;
}

export function UsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserDTO[];
  currentUserId: string;
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
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? { ...updated } : x)));
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
            <tr className="text-left text-slate-400 text-xs uppercase">
              <th className="pb-2">Ism</th>
              <th className="pb-2">Login</th>
              <th className="pb-2">Rol</th>
              <th className="pb-2">Holati</th>
              <th className="pb-2">Qo'shilgan</th>
              <th className="pb-2 text-right">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2.5">{u.ism}</td>
                <td className="py-2.5 text-slate-500">{u.login}</td>
                <td className="py-2.5">{u.rol === "admin" ? "Direktor" : "Kassir"}</td>
                <td className="py-2.5">
                  <Badge tone={u.isActive ? "kirim" : "neutral"}>{u.isActive ? "Faol" : "Nofaol"}</Badge>
                </td>
                <td className="py-2.5 text-slate-500">{formatDateUZ(new Date(u.createdAt))}</td>
                <td className="py-2.5 text-right">
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => toggleActive(u)}
                      className="text-xs font-medium text-slate-500 hover:text-emerald-600"
                    >
                      {u.isActive ? "Nofaollashtirish" : "Faollashtirish"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {modalOpen && <NewUserModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </div>
  );
}

function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: UserDTO) => void }) {
  const [ism, setIsm] = useState("");
  const [login, setLogin] = useState("");
  const [parol, setParol] = useState("");
  const [rol, setRol] = useState<"admin" | "kassir">("kassir");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ism, login, parol, rol }),
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Login"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <input
          type="password"
          value={parol}
          onChange={(e) => setParol(e.target.value)}
          placeholder="Parol"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as "admin" | "kassir")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="kassir">Kassir</option>
          <option value="admin">Direktor (admin)</option>
        </select>
        {error && <p className="text-rose-600 text-sm">{error}</p>}
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
