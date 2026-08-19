"use client";

import { Jadval, type Ustun } from "./Jadval";
import { Belgi } from "./belgilar";
import { FiltrBoshHolat } from "./Holatlar";
import { UserAmallar } from "./UserAmallar";
import { SUPER_ROL_LABEL, type SuperRol } from "@/lib/superadmin/rbac";

export interface GlobalUserQator {
  id: string;
  ism: string;
  login: string;
  rolLabel: string;
  superadminRol: SuperRol | null;
  isActive: boolean;
  telegramUlangan: boolean;
  tenantNomi: string | null;
  /** Oldindan formatlangan matn — server komponentda tayyorlanadi. */
  lastLoginAt: string;
  createdAt: string;
}

/**
 * Global foydalanuvchilar jadvali.
 *
 * Sana matnlari SERVERDA formatlanadi va bu yerga tayyor satr sifatida
 * keladi — client va server o'rtasidagi vaqt mintaqasi farqi tufayli
 * gidratatsiya nomuvofiqligi bo'lmasligi uchun.
 */
export function UserlarJadvali({
  qatorlar,
  superRol,
  ozId,
}: {
  qatorlar: GlobalUserQator[];
  superRol: SuperRol;
  ozId: string;
}) {
  const ustunlar: Ustun<GlobalUserQator>[] = [
    { kalit: "ism", sarlavha: "Ism", katak: (q) => q.ism },
    { kalit: "login", sarlavha: "Login", katak: (q) => q.login },
    {
      kalit: "rol",
      sarlavha: "Rol",
      katak: (q) => (
        <span className="flex flex-wrap items-center gap-1">
          {q.rolLabel}
          {q.superadminRol && <Belgi ton="brend">{SUPER_ROL_LABEL[q.superadminRol]}</Belgi>}
        </span>
      ),
    },
    { kalit: "tenant", sarlavha: "Kompaniya", katak: (q) => q.tenantNomi ?? "— (platforma)" },
    {
      kalit: "holat",
      sarlavha: "Holat",
      katak: (q) => (
        <Belgi ton={q.isActive ? "muvaffaqiyat" : "xavf"}>
          {q.isActive ? "faol" : "bloklangan"}
        </Belgi>
      ),
    },
    {
      kalit: "tg",
      sarlavha: "Telegram",
      katak: (q) => (q.telegramUlangan ? "ulangan" : "—"),
      ikkinchiDarajali: true,
    },
    { kalit: "kirish", sarlavha: "Oxirgi kirish", katak: (q) => q.lastLoginAt },
    { kalit: "yaratilgan", sarlavha: "Yaratilgan", katak: (q) => q.createdAt, ikkinchiDarajali: true },
    {
      kalit: "amallar",
      sarlavha: "Amallar",
      katak: (q) => (
        <UserAmallar
          userId={q.id}
          ism={q.ism}
          login={q.login}
          isActive={q.isActive}
          superRol={superRol}
          ozimi={q.id === ozId}
        />
      ),
    },
  ];

  return (
    <Jadval
      ustunlar={ustunlar}
      qatorlar={qatorlar}
      kalit={(q) => q.id}
      qatorHref={(q) => `/superadmin/foydalanuvchilar/${q.id}`}
      bosh={<FiltrBoshHolat tozalaHref="/superadmin/foydalanuvchilar" />}
    />
  );
}
