"use client";

import { useState } from "react";
import { XavfliAmal } from "./XavfliAmal";
import { can, type SuperRol } from "@/lib/superadmin/rbac";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * FOYDALANUVCHI AMALLARI (talab 11/15/25).
 *
 * Parol tiklanganda yangi parol BIR MARTA ko'rsatiladi — u hech qayerda
 * saqlanmaydi va auditga tushmaydi, shuning uchun modal yopilgach uni qayta
 * ko'rish imkoni YO'Q. Bu ataylab shunday.
 */
export function UserAmallar({
  userId,
  ism,
  login,
  isActive,
  superRol,
  ozimi,
}: {
  userId: string;
  ism: string;
  login: string;
  isActive: boolean;
  superRol: SuperRol;
  /** Bu hisob joriy superadminning o'zimi — o'zini bloklab qo'ymasin. */
  ozimi: boolean;
}) {
  const [yangiParol, setYangiParol] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      {can(superRol, "foydalanuvchilar", "UPDATE") && (
        <>
          <XavfliAmal
            label="Parolni tiklash"
            variant="secondary"
            size="sm"
            sarlavha={`${ism} — parolni tiklash`}
            nimaBoladi={[
              "Yangi tasodifiy parol yaratiladi va BIR MARTA ko'rsatiladi.",
              "Foydalanuvchining barcha ochiq sessiyalari bekor qilinadi.",
              "Birinchi kirishda parolni almashtirish majburiy bo'ladi.",
            ]}
            url={`/api/superadmin/users/${userId}/reset-password`}
            onMuvaffaqiyat={(m) => setYangiParol((m?.yangiParol as string) ?? null)}
            muvaffaqiyatMatni="Parol tiklandi — yangi parol quyida."
          />

          <XavfliAmal
            label="Sessiyalarni bekor qilish"
            variant="secondary"
            size="sm"
            sarlavha={`${ism} — barcha sessiyalarni bekor qilish`}
            tavsif="Foydalanuvchi barcha qurilmalarda tizimdan chiqariladi."
            nimaBoladi={[
              "Barcha ochiq sessiyalar darhol kuchini yo'qotadi.",
              "Alohida qurilmani tanlash mumkin emas — bekor qilish hammasiga tegishli.",
              "Parol o'zgarmaydi: foydalanuvchi eski paroli bilan qayta kiradi.",
            ]}
            url={`/api/superadmin/users/${userId}/sessiyalar`}
          />
        </>
      )}

      {can(superRol, "foydalanuvchilar", "MANAGE") &&
        !ozimi &&
        (isActive ? (
          <XavfliAmal
            label="Bloklash"
            size="sm"
            sarlavha={`${ism} (${login}) — bloklash`}
            nimaBoladi={[
              "Hisob o'chiriladi: kirish va Telegram bot amallari to'xtaydi.",
              "Ochiq sessiyalar ham darhol bekor qilinadi.",
              "Yozuvlari va tarixi SAQLANADI.",
            ]}
            url={`/api/superadmin/users/${userId}/holat`}
            body={{ isActive: false }}
          />
        ) : (
          <XavfliAmal
            label="Faollashtirish"
            variant="primary"
            size="sm"
            sarlavha={`${ism} — faollashtirish`}
            nimaBoladi={["Hisob qayta ochiladi va foydalanuvchi tizimga kira oladi."]}
            url={`/api/superadmin/users/${userId}/holat`}
            body={{ isActive: true }}
          />
        ))}

      <Modal open={!!yangiParol} onClose={() => setYangiParol(null)} title="Yangi parol">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Bu parol faqat HOZIR ko&apos;rsatiladi. Uni foydalanuvchiga yetkazing —
            oyna yopilgach qayta ko&apos;rish imkoni bo&apos;lmaydi.
          </p>
          <p className="font-mono text-lg text-fg bg-surface-2 rounded-lg px-3 py-2 text-center select-all">
            {yangiParol}
          </p>
          <p className="text-2xs text-faint">Login: {login}</p>
          <Button variant="secondary" onClick={() => setYangiParol(null)}>
            Yopish
          </Button>
        </div>
      </Modal>
    </div>
  );
}
