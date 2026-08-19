"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { BiznesTanlash } from "./BiznesTanlash";
import type { BusinessOption, RoleOption, UserDTO } from "./turlar";

/** Yangi xodim qo'shish oynasi. Kassir/sotuvchi uchun bir nechta biznes belgilanadi. */
export function YangiUserModal({
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
  // KO'P-BIZNESLIK: boshlanishida birinchi biznes belgilanadi (kassir uchun
  // kamida bittasi shart), keyin direktor kerakligicha qo'shadi.
  const [businessIds, setBusinessIds] = useState<string[]>(
    businesses[0] ? [businesses[0].id] : []
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const custom = rol.startsWith("custom:");
  const biznesli = rol === "CASHIER" || rol === "SELLER" || custom;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (rol === "CASHIER" && businessIds.length === 0) {
      setError("Kassir uchun kamida bitta biznes tanlang");
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
        businessIds: biznesli ? businessIds : [],
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
      businessIds: (data.bizneslar ?? []).map((b: { businessId: string }) => b.businessId),
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
        {biznesli && (
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Bizneslar {rol !== "CASHIER" && <span className="text-faint">(ixtiyoriy)</span>}
            </label>
            <BiznesTanlash
              businesses={businesses}
              tanlangan={businessIds}
              onChange={setBusinessIds}
              kassir={rol === "CASHIER"}
              disabled={loading}
            />
          </div>
        )}
        {rol === "OWNER" && (
          <p className="text-xs text-faint">Direktor barcha bizneslarni ko'radi va almashadi.</p>
        )}
        {rol === "SELLER" && (
          <p className="text-xs text-faint">
            Sotuvchi faqat sotadi (kirim/chiqim/sotuv/qarzlar) — sof foyda va hisobotlarni ko'rmaydi. Bir
            nechta biznes belgilansa — o'shalar orasida almashadi. Hech biri belgilanmasa — barcha
            bizneslarni ko'radi.
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
