"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { BiznesTafsilot } from "@/lib/services/biznesTafsilot";
import { TozalashModal } from "./TozalashModal";
import { OchirishModal } from "./OchirishModal";

/**
 * XAVFLI ZONA — qaytarib bo'lmaydigan amallar.
 *
 * Ular ATAYLAB sahifaning eng pastida, alohida bo'limda: ro'yxatdagi qatorda
 * "Ochish" tugmasi yonida turgan "O'chirish" bir kunmas-bir kun tasodifan
 * bosiladi. Bu yerga yetib kelish uchun biznesni ochish, "Xavfsizlik"
 * bo'limiga o'tish va biznes nomini QO'LDA yozish kerak.
 *
 * Ruxsat: bo'lim faqat DIREKTOR (OWNER) ga ko'rinadi va server ham shu
 * darajani talab qiladi — frontendni yashirish himoya hisoblanmaydi.
 */
export function XavfliZona({ biznes }: { biznes: BiznesTafsilot }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tozalash, setTozalash] = useState(false);
  const [ochirish, setOchirish] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-expense/40 bg-expense-soft/40 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-fg text-sm">Ma&apos;lumotlarni tozalash</p>
            <p className="text-xs text-muted mt-1 max-w-xl">
              O&apos;chadi: yozuvlar, pul o&apos;tkazmalari, sotuvlar, qarzlar, kunlik hisobotlar,
              smenalar va xaridlar — barcha balans va hisobot 0 bo&apos;ladi.
              <br />
              Qoladi: kategoriyalar, mahsulotlar, mijozlar, xodimlar, foydalanuvchilar va audit
              jurnali.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setTozalash(true)}
            className="shrink-0 min-h-[44px]"
          >
            Tozalash…
          </Button>
        </div>

        <div className="border-t border-expense/30 pt-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-fg text-sm">Biznesni butunlay o&apos;chirish</p>
            <p className="text-xs text-muted mt-1 max-w-xl">
              Bu amalni qaytarib bo&apos;lmaydi. Faqat BO&apos;SH biznes o&apos;chadi — yozuv,
              mahsulot, sotuv, qarz yoki biriktirilgan foydalanuvchi bo&apos;lsa server rad etadi.
            </p>
          </div>
          <Button variant="danger" onClick={() => setOchirish(true)} className="shrink-0 min-h-[44px]">
            O&apos;chirish…
          </Button>
        </div>
      </div>

      {tozalash && (
        <TozalashModal
          biznes={biznes}
          onClose={() => setTozalash(false)}
          onDone={(xabar) => {
            setTozalash(false);
            toast({ message: xabar, tone: "success" });
            router.refresh();
          }}
        />
      )}
      {ochirish && (
        <OchirishModal
          biznes={biznes}
          onClose={() => setOchirish(false)}
          onDone={() => {
            setOchirish(false);
            toast({ message: `"${biznes.nomi}" o'chirildi`, tone: "success" });
            router.push("/app/admin/bizneslar");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
