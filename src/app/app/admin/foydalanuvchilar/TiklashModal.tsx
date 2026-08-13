"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface TiklashUser {
  id: string;
  ism: string;
  login: string;
}

/** Parolni tiklash — eski parol SO'RALMAYDI (direktor/admin huquqi bilan yangisi qo'yiladi). */
export function ParolTiklashModal({
  user,
  onClose,
}: {
  user: TiklashUser;
  onClose: () => void;
}) {
  const [parol, setParol] = useState("");
  const [tasdiq, setTasdiq] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (parol !== tasdiq) {
      setError("Parollar bir xil emas");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parol }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Parolni tiklab bo'lmadi");
      setLoading(false);
      return;
    }
    alert(`"${user.ism}" (${user.login}) uchun yangi parol o'rnatildi.`);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Parolni tiklash">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{user.ism}</span> ({user.login}) uchun yangi parol
          o'rnatiladi. Eski parol so'ralmaydi.
        </p>
        <input
          type="password"
          value={parol}
          onChange={(e) => setParol(e.target.value)}
          placeholder="Yangi parol (kamida 8 belgi)"
          minLength={8}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          autoFocus
          required
        />
        <input
          type="password"
          value={tasdiq}
          onChange={(e) => setTasdiq(e.target.value)}
          placeholder="Yangi parolni takrorlang"
          minLength={8}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          required
        />
        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saqlanmoqda..." : "Parolni tiklash"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Loginni tiklash — foydalanuvchiga yangi login qo'yiladi (tizim bo'ylab band bo'lmasligi kerak). */
export function LoginTiklashModal({
  user,
  onClose,
  onSaved,
}: {
  user: TiklashUser;
  onClose: () => void;
  onSaved: (yangiLogin: string) => void;
}) {
  const [login, setLogin] = useState(user.login);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (login.trim() === user.login) {
      onClose();
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: login.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Loginni o'zgartirib bo'lmadi");
      setLoading(false);
      return;
    }
    onSaved(data.login);
  }

  return (
    <Modal open onClose={onClose} title="Loginni tiklash">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{user.ism}</span> uchun yangi login qo'yiladi. Joriy
          login: <span className="font-medium text-fg">{user.login}</span>
        </p>
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Yangi login (kamida 3 belgi)"
          minLength={3}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          autoFocus
          required
        />
        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saqlanmoqda..." : "Loginni saqlash"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
