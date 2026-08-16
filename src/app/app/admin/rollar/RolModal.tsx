"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { huquqJsonParse, huquqlarGuruhlab } from "@/lib/permissions/katalog";

export interface RolDTO {
  id: string;
  nomi: string;
  izoh: string | null;
  /** Huquq kodlari JSON massivi (server formati). */
  huquqlar: string;
  bazaRol: string;
  isActive: boolean;
  userSoni: number;
}

/** Rol yaratish/tahrirlash modali — huquqlar guruhlangan checkbox'lar bilan. */
export function RolModal({
  rol,
  onClose,
  onSaved,
}: {
  rol: RolDTO | null;
  onClose: () => void;
  onSaved: (r: RolDTO) => void;
}) {
  const [nomi, setNomi] = useState(rol?.nomi ?? "");
  const [izoh, setIzoh] = useState(rol?.izoh ?? "");
  const [bazaRol, setBazaRol] = useState(rol?.bazaRol ?? "SELLER");
  const [tanlangan, setTanlangan] = useState<Set<string>>(
    new Set(rol ? huquqJsonParse(rol.huquqlar) : [])
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(code: string) {
    setTanlangan((prev) => {
      const yangi = new Set(prev);
      if (yangi.has(code)) yangi.delete(code);
      else yangi.add(code);
      return yangi;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const body = {
      nomi,
      izoh: izoh.trim() || null,
      huquqlar: [...tanlangan],
      bazaRol,
    };
    const res = await fetch(rol ? `/api/rollar/${rol.id}` : "/api/rollar", {
      method: rol ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Xatolik yuz berdi");
      setLoading(false);
      return;
    }
    onSaved({
      id: data.id,
      nomi: data.nomi,
      izoh: data.izoh,
      huquqlar: data.huquqlar,
      bazaRol: data.bazaRol,
      isActive: data.isActive,
      userSoni: data._count?.users ?? rol?.userSoni ?? 0,
    });
  }

  return (
    <Modal open onClose={onClose} title={rol ? `Rol: ${rol.nomi}` : "Yangi rol"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={nomi}
          onChange={(e) => setNomi(e.target.value)}
          placeholder="Rol nomi (masalan: Taminotchi, Omborchi)"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          required
          minLength={2}
        />
        <input
          type="text"
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          placeholder="Izoh (ixtiyoriy)"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Sahifalar ko'rinishi (nav skeleti)
          </label>
          <select
            value={bazaRol}
            onChange={(e) => setBazaRol(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          >
            <option value="SELLER">Sotuvchi kabi (minimal)</option>
            <option value="CASHIER">Kassir kabi (sotuv, qarz, kassa)</option>
            <option value="ADMIN">Administrator kabi (to'liq)</option>
          </select>
        </div>

        <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-line p-3">
          {huquqlarGuruhlab().map((g) => (
            <div key={g.guruh}>
              <p className="mb-1 text-xs font-semibold uppercase text-faint">{g.guruh}</p>
              <div className="space-y-1">
                {g.huquqlar.map((h) => (
                  <label key={h.code} className="flex items-center gap-2 text-sm text-fg">
                    <input
                      type="checkbox"
                      checked={tanlangan.has(h.code)}
                      onChange={() => toggle(h.code)}
                      className="rounded border-line"
                    />
                    {h.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-faint">{tanlangan.size} ta huquq tanlandi</p>

        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saqlanmoqda..." : rol ? "Saqlash" : "Yaratish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
