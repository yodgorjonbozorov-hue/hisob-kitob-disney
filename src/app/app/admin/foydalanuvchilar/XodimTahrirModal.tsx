"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { RolTanlash } from "./RolTanlash";
import { BiznesTanlash } from "./BiznesTanlash";
import {
  rolBody,
  rolVariantlariXodimUchun,
  xodimRolQiymati,
  type BusinessOption,
  type MaxsusRol,
  type XodimDTO,
} from "./turlar";

/**
 * XODIMNI TAHRIRLASH — ism, login, rol, bizneslar, holat.
 *
 * Texnik maydonlar (huquq override'lari, `businessId` qulaylik nusxasi,
 * `roleId`) bu yerda KO'RSATILMAYDI: ular yo boshqa modulda boshqariladi,
 * yo serverda avtomatik hisoblanadi.
 *
 * ROL O'ZGARSA — tasdiq so'raladi. Rol bir bosishda o'zgarib ketishi
 * ilgari eng katta xavf edi (tanlagich jadval qatorida turardi).
 */
export function XodimTahrirModal({
  xodim,
  businesses,
  maxsusRollar,
  ozi,
  onClose,
  onSaqlandi,
}: {
  xodim: XodimDTO;
  businesses: BusinessOption[];
  maxsusRollar: MaxsusRol[];
  /** Tahrirlanayotgan odam — kiruvchining O'ZIMI (rol/holat qulflanadi). */
  ozi: boolean;
  onClose: () => void;
  onSaqlandi: (yangi: XodimDTO) => void;
}) {
  const boshRol = xodimRolQiymati(xodim);
  const variantlar = rolVariantlariXodimUchun(maxsusRollar, xodim);

  const [ism, setIsm] = useState(xodim.ism);
  const [login, setLogin] = useState(xodim.login);
  const [rol, setRol] = useState(boshRol);
  const [bizneslar, setBizneslar] = useState<string[]>(xodim.bizneslar.map((b) => b.id));
  const [faol, setFaol] = useState(xodim.isActive);
  const [tasdiq, setTasdiq] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  const rolOzgardi = rol !== boshRol;
  const yangiRolNomi = variantlar.find((v) => v.qiymat === rol)?.nomi ?? rol;
  // Direktor/administrator biznesga biriktirilmaydi — u doim barchasini ko'radi.
  const biznesli = rol === "CASHIER" || rol === "SELLER" || rol.startsWith("custom:");
  const kassir = rol === "CASHIER";

  async function saqla() {
    setXato(null);
    if (kassir && bizneslar.length === 0) {
      setXato("Kassir uchun kamida bitta biznes tanlang");
      return;
    }
    setSaqlanmoqda(true);
    const res = await fetch(`/api/users/${xodim.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ism: ism.trim(),
        ...(login.trim() !== xodim.login ? { login: login.trim() } : {}),
        // O'zini tahrirlaganda rol va holat umuman yuborilmaydi (server ham rad etadi).
        // Rol O'ZGARMAGAN bo'lsa ham yubormaymiz: `roleId` maydonining o'zi
        // serverda maxsus rol oqimini yoqadi, ya'ni har oddiy tahrirlash
        // keraksiz yozuvga aylanardi.
        ...(ozi ? {} : { isActive: faol }),
        ...(!ozi && rolOzgardi ? rolBody(rol) : {}),
        businessIds: biznesli ? bizneslar : [],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setXato(data.error ?? "Saqlab bo'lmadi");
      setSaqlanmoqda(false);
      setTasdiq(false);
      return;
    }
    onSaqlandi(data as XodimDTO);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Rol o'zgarsa — avval tasdiq ekrani (ruxsatlar shu bilan o'zgaradi).
    if (rolOzgardi && !tasdiq) {
      setTasdiq(true);
      return;
    }
    void saqla();
  }

  if (tasdiq) {
    return (
      <Modal open onClose={onClose} title="Rolni o'zgartirishni tasdiqlang">
        <div className="space-y-4">
          <p className="text-sm text-fg">
            <span className="font-medium">{xodim.ism}</span>ning roli{" "}
            <span className="font-medium">{xodim.rolNomi}</span> →{" "}
            <span className="font-medium">{yangiRolNomi}</span> bo&apos;ladi.
          </p>
          <p className="text-sm text-muted">
            Xodimning ruxsatlari yangi rol bo&apos;yicha qayta belgilanadi: u ba&apos;zi
            bo&apos;limlarni ko&apos;rmay qolishi yoki yangilarini ko&apos;ra boshlashi mumkin.
          </p>
          {xato && <p className="text-expense text-sm">{xato}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setTasdiq(false)} disabled={saqlanmoqda}>
              Bekor qilish
            </Button>
            <Button onClick={() => void saqla()} loading={saqlanmoqda}>
              Saqlash
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`${xodim.ism} — tahrirlash`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="tahrir-ism">Ism</label>
          <input
            id="tahrir-ism"
            value={ism}
            onChange={(e) => setIsm(e.target.value)}
            className={INPUT_CLASS}
            required
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="tahrir-login">Login</label>
          <input
            id="tahrir-login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className={INPUT_CLASS}
            minLength={3}
            required
          />
          <p className="text-2xs text-faint mt-1">Xodim shu nom bilan tizimga kiradi.</p>
        </div>

        <div>
          <span className={LABEL_CLASS}>Rol</span>
          {ozi ? (
            <p className="text-sm text-muted rounded-lg border border-line px-3 py-2.5">
              {xodim.rolNomi} — o&apos;z rolingizni o&apos;zgartira olmaysiz.
            </p>
          ) : (
            <RolTanlash variantlar={variantlar} qiymat={rol} onChange={setRol} disabled={saqlanmoqda} />
          )}
        </div>

        {biznesli && (
          <div>
            <span className={LABEL_CLASS}>Qaysi biznesda ishlaydi</span>
            <BiznesTanlash
              businesses={businesses}
              tanlangan={bizneslar}
              onChange={setBizneslar}
              kassir={kassir}
              disabled={saqlanmoqda}
            />
          </div>
        )}
        {!biznesli && (
          <p className="text-xs text-faint">Direktor barcha bizneslarni ko&apos;radi va almashadi.</p>
        )}

        {!ozi && (
          <label className="flex items-center gap-2.5 min-h-[44px] text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={faol}
              onChange={(e) => setFaol(e.target.checked)}
              className="accent-brand w-4 h-4"
            />
            <span>
              Faol — <span className="text-muted">belgilanmasa xodim tizimga kira olmaydi</span>
            </span>
          </label>
        )}

        {xato && <p className="text-expense text-sm">{xato}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saqlanmoqda}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={saqlanmoqda}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
