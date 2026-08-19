"use client";

import { formatRelative, formatDate } from "@/lib/format";
import { Jadval, type Ustun } from "../Jadval";
import { Belgi } from "../belgilar";
import { BoshHolat } from "../Holatlar";
import { UserAmallar } from "../UserAmallar";
import type { SuperRol } from "@/lib/superadmin/rbac";

export interface UserQatorDto {
  id: string;
  ism: string;
  login: string;
  rolLabel: string;
  isActive: boolean;
  lastLoginAt: Date | string | null;
  createdAt: Date | string;
  telegramUlangan: boolean;
  businessNomi: string | null;
}

/** Kompaniya ichidagi foydalanuvchilar va ular ustidagi amallar (talab 11). */
export function BiznesUserlar({
  qatorlar,
  superRol,
  ozId,
}: {
  qatorlar: UserQatorDto[];
  superRol: SuperRol;
  ozId: string;
}) {
  const ustunlar: Ustun<UserQatorDto>[] = [
    { kalit: "ism", sarlavha: "Ism", katak: (q) => q.ism },
    { kalit: "login", sarlavha: "Login", katak: (q) => q.login },
    { kalit: "rol", sarlavha: "Rol", katak: (q) => q.rolLabel },
    { kalit: "biznes", sarlavha: "Biznes", katak: (q) => q.businessNomi ?? "—", ikkinchiDarajali: true },
    {
      kalit: "holat",
      sarlavha: "Holat",
      katak: (q) => (
        <Belgi ton={q.isActive ? "muvaffaqiyat" : "xavf"}>{q.isActive ? "faol" : "bloklangan"}</Belgi>
      ),
    },
    {
      kalit: "tg",
      sarlavha: "Telegram",
      katak: (q) => (q.telegramUlangan ? "ulangan" : "—"),
      ikkinchiDarajali: true,
    },
    {
      kalit: "kirish",
      sarlavha: "Oxirgi kirish",
      katak: (q) => (q.lastLoginAt ? formatRelative(new Date(q.lastLoginAt)) : "hech qachon"),
    },
    {
      kalit: "yaratilgan",
      sarlavha: "Yaratilgan",
      katak: (q) => formatDate(new Date(q.createdAt)),
      ikkinchiDarajali: true,
    },
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
      bosh={<BoshHolat sarlavha="Bu kompaniyada foydalanuvchi yo'q" />}
    />
  );
}
