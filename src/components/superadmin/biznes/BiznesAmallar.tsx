"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { XavfliAmal } from "../XavfliAmal";
import { TarifOzgartirish } from "./TarifOzgartirish";
import { MuddatUzaytirish } from "./MuddatUzaytirish";
import { can, type SuperRol } from "@/lib/superadmin/rbac";

interface Tarif {
  code: string;
  nomi: string;
}

/**
 * KOMPANIYA AMALLARI (talab 9/46).
 *
 * Har xavfli amal `XavfliAmal` modalidan o'tadi: oqibatlar ro'yxati + sabab,
 * eng xavflilarida esa so'zni qo'lda yozish. Tugmalar rolga qarab ko'rinadi,
 * lekin HIMOYA serverda — bu yerdagi `can()` faqat keraksiz tugmani yashiradi.
 */
export function BiznesAmallar({
  tenantId,
  nomi,
  status,
  plan,
  bepul,
  superRol,
  tariflar,
}: {
  tenantId: string;
  nomi: string;
  status: string;
  plan: string;
  bepul: boolean;
  superRol: SuperRol;
  tariflar: Tarif[];
}) {
  const router = useRouter();
  const bloklangan = status === "BLOCKED";
  const [tarifOchiq, setTarifOchiq] = useState(false);
  const [muddatOchiq, setMuddatOchiq] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      {can(superRol, "obunalar", "UPDATE") && (
        <>
          <Button size="sm" variant="secondary" onClick={() => setMuddatOchiq(true)}>
            Muddatni uzaytirish
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setTarifOchiq(true)}>
            Tarifni o&apos;zgartirish
          </Button>
        </>
      )}

      {can(superRol, "bizneslar", "MANAGE") &&
        (bloklangan ? (
          <XavfliAmal
            label="Blokdan chiqarish"
            variant="primary"
            sarlavha={`${nomi} — blokdan chiqarish`}
            nimaBoladi={[
              "Kompaniya holati sanalarga qarab tiklanadi (sinov / faol / muddati o'tgan).",
              "Foydalanuvchilar tizimga qayta kira oladi.",
            ]}
            url={`/api/superadmin/tenants/${tenantId}/block`}
            body={{ blocked: false }}
          />
        ) : (
          <XavfliAmal
            label="Bloklash"
            sarlavha={`${nomi} — bloklash`}
            tavsif="Bloklash mijozning ishini to'xtatadi. Buni faqat to'lov yoki shartnoma buzilganda qiling."
            nimaBoladi={[
              "Barcha foydalanuvchilar faqat to'lov sahifasini ko'radi.",
              "MA'LUMOT O'CHIRILMAYDI — blokdan chiqarilsa hammasi joyida qoladi.",
              "Telegram bot orqali yozuv kiritish ham to'xtaydi.",
            ]}
            url={`/api/superadmin/tenants/${tenantId}/block`}
            body={{ blocked: true }}
            yozibTasdiqlash="BLOKLASH"
          />
        ))}

      {can(superRol, "bizneslar", "UPDATE") && (
        <XavfliAmal
          label={bepul ? "Bepulni bekor qilish" : "Doimiy bepul qilish"}
          variant="secondary"
          sarlavha={bepul ? "Bepul rejimni bekor qilish" : "Doimiy bepul rejim"}
          nimaBoladi={
            bepul
              ? [
                  "Kompaniya odatdagi to'lov qoidasiga qaytadi.",
                  "Muddat tugagan bo'lsa kirish darhol cheklanishi mumkin.",
                ]
              : [
                  "To'lov va muddat tekshirilmaydi — kirish har doim ochiq.",
                  "Obuna eslatmalari yuborilmaydi.",
                  "Bloklash bu rejimdan USTUN turadi.",
                ]
          }
          url={`/api/superadmin/tenants/${tenantId}/bepul`}
          body={{ bepul: !bepul }}
        />
      )}

      {can(superRol, "impersonatsiya", "CREATE") && (
        <XavfliAmal
          label="Nomidan kirish"
          variant="secondary"
          sarlavha={`${nomi} nomidan kirish`}
          tavsif="Siz mijozning direktori sifatida ishlaysiz. Bu eng kuchli amallardan biri."
          nimaBoladi={[
            "Sessiyangiz mijozning direktoriga almashadi.",
            "Ekran yuqorisida impersonatsiya banneri turadi.",
            "Bu amal va sababi audit jurnaliga yoziladi.",
            'Qaytish uchun bannerdagi "Chiqish" tugmasi ishlatiladi.',
          ]}
          url={`/api/superadmin/tenants/${tenantId}/impersonate`}
          yozibTasdiqlash="KIRISH"
          onMuvaffaqiyat={() => router.push("/app")}
        />
      )}

      {can(superRol, "bizneslar", "DELETE") && (
        <XavfliAmal
          label="O'chirish"
          sarlavha={`${nomi} — butunlay o'chirish`}
          tavsif="Faqat xatoga ochilgan BO'SH kompaniya uchun. Ish ma'lumoti yoki to'lovi bo'lsa server rad etadi."
          nimaBoladi={[
            "Kompaniya, uning foydalanuvchilari va bizneslari o'chiriladi.",
            "AUDIT JURNALI SAQLANADI — kim, qachon va nega o'chirgani qoladi.",
            "Bu amalni QAYTARIB BO'LMAYDI.",
          ]}
          url={`/api/superadmin/tenants/${tenantId}`}
          method="DELETE"
          yozibTasdiqlash="OCHIRISH"
          onMuvaffaqiyat={() => router.push("/superadmin/bizneslar")}
        />
      )}

      <MuddatUzaytirish
        tenantId={tenantId}
        ochiq={muddatOchiq}
        onYopish={() => setMuddatOchiq(false)}
      />
      <TarifOzgartirish
        tenantId={tenantId}
        joriy={plan}
        tariflar={tariflar}
        ochiq={tarifOchiq}
        onYopish={() => setTarifOchiq(false)}
      />
    </div>
  );
}
