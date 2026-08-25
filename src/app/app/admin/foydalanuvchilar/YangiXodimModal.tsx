"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { RolTanlash } from "./RolTanlash";
import { BiznesTanlash } from "./BiznesTanlash";
import { XodimYaratildi } from "./XodimYaratildi";
import { loginTaklifi, parolTaklifi } from "./yaratish";
import { rolBody, rolVariantlari, type BusinessOption, type MaxsusRol, type XodimDTO } from "./turlar";

/**
 * YANGI XODIM — QADAMBAQADAM.
 *
 * Nega bitta formada emas: bitta ekranda 6 maydon (ism, login, parol, rol,
 * bizneslar, tasdiq) telefonda klaviatura ochilgach yuborish tugmasini
 * ekrandan chiqarib yuboradi. Har qadam — bitta savol, bitta javob.
 */

const QADAMLAR = ["Ism", "Login", "Rol", "Biznes", "Parol"] as const;

export function YangiXodimModal({
  businesses,
  maxsusRollar,
  onClose,
  onYaratildi,
}: {
  businesses: BusinessOption[];
  maxsusRollar: MaxsusRol[];
  onClose: () => void;
  onYaratildi: () => void;
}) {
  const variantlar = rolVariantlari(maxsusRollar);
  const [qadam, setQadam] = useState(0);
  const [ism, setIsm] = useState("");
  const [login, setLogin] = useState("");
  const [rol, setRol] = useState("CASHIER");
  const [bizneslar, setBizneslar] = useState<string[]>(businesses[0] ? [businesses[0].id] : []);
  const [parol, setParol] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [yaratilgan, setYaratilgan] = useState<XodimDTO | null>(null);

  const kassir = rol === "CASHIER";
  const biznesli = kassir || rol === "SELLER" || rol.startsWith("custom:");
  // Direktor bizneslarga biriktirilmaydi — bu qadam unga ko'rsatilmaydi.
  const korinadigan = QADAMLAR.filter((q) => q !== "Biznes" || biznesli);
  const joriy = korinadigan[qadam];
  const oxirgi = qadam === korinadigan.length - 1;

  function keyingi() {
    setXato(null);
    if (joriy === "Ism" && !ism.trim()) return setXato("Xodimning ismini yozing");
    if (joriy === "Login") {
      if (login.trim().length < 3) return setXato("Login kamida 3 belgi bo'lishi kerak");
    }
    if (joriy === "Biznes" && kassir && bizneslar.length === 0) {
      return setXato("Kassir uchun kamida bitta biznes tanlang");
    }
    if (joriy === "Parol" && parol.length < 8) return setXato("Parol kamida 8 belgi bo'lishi kerak");
    if (oxirgi) return void yarat();
    setQadam((q) => q + 1);
  }

  async function yarat() {
    setSaqlanmoqda(true);
    setXato(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ism: ism.trim(),
        login: login.trim(),
        parol,
        ...rolBody(rol),
        businessIds: biznesli ? bizneslar : [],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setXato(data.error ?? "Xodim yaratilmadi");
      setSaqlanmoqda(false);
      // Login band bo'lsa — aynan o'sha qadamga qaytaramiz.
      if (res.status === 409) setQadam(korinadigan.indexOf("Login"));
      return;
    }
    setYaratilgan(data as XodimDTO);
  }

  if (yaratilgan) {
    return (
      <XodimYaratildi
        xodim={yaratilgan}
        parol={parol}
        onClose={() => {
          onYaratildi();
          onClose();
        }}
      />
    );
  }

  return (
    <Modal open onClose={onClose} title="Yangi xodim">
      <div className="space-y-4">
        <p className="text-2xs text-faint">
          {qadam + 1} / {korinadigan.length} — {joriy}
        </p>

        {joriy === "Ism" && (
          <div>
            <label className={LABEL_CLASS} htmlFor="yangi-ism">Xodimning ismi</label>
            <input
              id="yangi-ism"
              value={ism}
              onChange={(e) => {
                setIsm(e.target.value);
                // Login hali qo'lda tegilmagan bo'lsa — ism bilan birga yangilanadi.
                setLogin((eski) => (eski === "" || eski === loginTaklifi(ism) ? loginTaklifi(e.target.value) : eski));
              }}
              placeholder="Masalan: Fayruza"
              className={INPUT_CLASS}
              autoFocus
            />
          </div>
        )}

        {joriy === "Login" && (
          <div>
            <label className={LABEL_CLASS} htmlFor="yangi-login">Login</label>
            <input
              id="yangi-login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="fayruza"
              className={INPUT_CLASS}
              autoFocus
            />
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <p className="text-2xs text-faint">Xodim shu nom bilan tizimga kiradi.</p>
              <button
                type="button"
                onClick={() => setLogin(loginTaklifi(ism))}
                className="text-2xs text-brand hover:underline shrink-0"
              >
                Avtomatik yaratish
              </button>
            </div>
          </div>
        )}

        {joriy === "Rol" && (
          <div>
            <span className={LABEL_CLASS}>Bu xodim nima ish qiladi?</span>
            <RolTanlash variantlar={variantlar} qiymat={rol} onChange={setRol} />
          </div>
        )}

        {joriy === "Biznes" && (
          <div>
            <span className={LABEL_CLASS}>Qaysi biznesda ishlaydi?</span>
            <BiznesTanlash
              businesses={businesses}
              tanlangan={bizneslar}
              onChange={setBizneslar}
              kassir={kassir}
            />
          </div>
        )}

        {joriy === "Parol" && (
          <div>
            <label className={LABEL_CLASS} htmlFor="yangi-parol">Parol</label>
            <input
              id="yangi-parol"
              type="text"
              value={parol}
              onChange={(e) => setParol(e.target.value)}
              placeholder="Kamida 8 belgi"
              className={INPUT_CLASS}
              autoFocus
            />
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <p className="text-2xs text-faint">
                Xodim birinchi kirishda o&apos;zining parolini qo&apos;yadi.
              </p>
              <button
                type="button"
                onClick={() => setParol(parolTaklifi())}
                className="text-2xs text-brand hover:underline shrink-0"
              >
                Avtomatik yaratish
              </button>
            </div>
          </div>
        )}

        {xato && <p className="text-expense text-sm">{xato}</p>}

        {/* Tugmalar oxirida va DOIM ko'rinadi — klaviatura ochilganda ham
            varaq ichida suriladi, tugma ekran ortida qolmaydi. */}
        <div className="flex gap-2 justify-between pt-1">
          <Button
            variant="secondary"
            onClick={() => (qadam === 0 ? onClose() : setQadam((q) => q - 1))}
            disabled={saqlanmoqda}
          >
            {qadam === 0 ? "Bekor qilish" : "Orqaga"}
          </Button>
          <Button onClick={keyingi} loading={saqlanmoqda}>
            {oxirgi ? "Xodim yaratish" : "Keyingi"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
