"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { parolTaklifi } from "./yaratish";
import type { XodimDTO } from "./turlar";

/**
 * PAROL VA LOGINNI YANGILASH.
 *
 * NOM ANIQLIGI: ilgari ikkalasi ham "tiklash" deb atalardi. Server esa
 * ikki xil ish qiladi — parolda ESKISI SO'RALMAY yangisi qo'yiladi
 * ("tiklash" to'g'ri), loginda esa shunchaki yangi qiymat yoziladi
 * ("o'zgartirish" to'g'ri). Endi nomlar shu amallarga mos.
 */

/**
 * Parolni tiklash — eski parol so'ralmaydi (direktor huquqi bilan).
 * Yangi parol qo'yilgach, xodim birinchi kirishda o'zinikini qo'yishi
 * majburiy bo'ladi (server `mustChangePassword` ni yoqadi).
 */
export function ParolTiklashModal({
  xodim,
  onClose,
}: {
  xodim: XodimDTO;
  onClose: () => void;
}) {
  const [parol, setParol] = useState("");
  const [tasdiq, setTasdiq] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bajarildi, setBajarildi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setXato(null);
    if (parol.length < 8) {
      setXato("Parol kamida 8 belgi bo'lishi kerak");
      return;
    }
    if (parol !== tasdiq) {
      setXato("Parollar bir xil emas");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/users/${xodim.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parol }),
    });
    if (!res.ok) {
      setXato((await res.json()).error ?? "Parolni tiklab bo'lmadi");
      setLoading(false);
      return;
    }
    setBajarildi(true);
    setLoading(false);
  }

  if (bajarildi) {
    return (
      <Modal open onClose={onClose} title="Parol tiklandi">
        <div className="space-y-4">
          <p className="text-sm text-fg">
            <span className="font-medium">{xodim.ism}</span> uchun yangi parol o&apos;rnatildi.
            Eski parol endi ishlamaydi.
          </p>
          <p className="text-xs text-muted rounded-lg bg-surface-2 px-3 py-2">
            Yangi parolni xodimga bering. U birinchi kirishda o&apos;zining parolini qo&apos;yadi.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Yopish</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Parolni tiklash">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{xodim.ism}</span> ({xodim.login}) uchun yangi
          parol qo&apos;yiladi. Eski parol so&apos;ralmaydi va bundan keyin ishlamaydi.
        </p>
        <div>
          <label className={LABEL_CLASS} htmlFor="yangi-parol-1">Yangi parol</label>
          <input
            id="yangi-parol-1"
            type="text"
            value={parol}
            onChange={(e) => setParol(e.target.value)}
            placeholder="Kamida 8 belgi"
            className={INPUT_CLASS}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              const p = parolTaklifi();
              setParol(p);
              setTasdiq(p);
            }}
            className="text-2xs text-brand hover:underline mt-1.5"
          >
            Avtomatik parol yaratish
          </button>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="yangi-parol-2">Takrorlang</label>
          <input
            id="yangi-parol-2"
            type="text"
            value={tasdiq}
            onChange={(e) => setTasdiq(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        {xato && <p className="text-expense text-sm">{xato}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={loading}>
            Parolni tiklash
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Loginni o'zgartirish — yangi qiymat butun tizim bo'ylab band bo'lmasligi kerak. */
export function LoginOzgartirishModal({
  xodim,
  onClose,
  onSaqlandi,
}: {
  xodim: XodimDTO;
  onClose: () => void;
  onSaqlandi: (yangi: XodimDTO) => void;
}) {
  const [login, setLogin] = useState(xodim.login);
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setXato(null);
    if (login.trim() === xodim.login) {
      onClose();
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/users/${xodim.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: login.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setXato(data.error ?? "Loginni o'zgartirib bo'lmadi");
      setLoading(false);
      return;
    }
    onSaqlandi(data as XodimDTO);
  }

  return (
    <Modal open onClose={onClose} title="Loginni o'zgartirish">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{xodim.ism}</span> bundan keyin yangi login
          bilan kiradi. Joriy login: <span className="font-medium text-fg">{xodim.login}</span>
        </p>
        <div>
          <label className={LABEL_CLASS} htmlFor="ozgargan-login">Yangi login</label>
          <input
            id="ozgargan-login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Kamida 3 belgi"
            className={INPUT_CLASS}
            minLength={3}
            autoFocus
            required
          />
        </div>
        <p className="text-2xs text-faint">Paroli o&apos;zgarmaydi.</p>
        {xato && <p className="text-expense text-sm">{xato}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={loading}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
