"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * SHAXSIY KASSA REJIMI (faqat boshqaruvchi).
 *
 * Yoqilganda naqd yozuv uni KIRITGAN xodimning kassasiga tushadi va har faol
 * xodimga kassa ochiladi (api/businesses/[id]). O'chirilganda mavjud kassalar
 * va ularning tarixi TEGILMAYDI — faqat yangi yozuvlar yana umumiy kassaga
 * tusha boshlaydi.
 *
 * Panel endi sahifaning o'rtasida emas, "Kassa sozlamalari" ichida: bu
 * kuniga bir marta ham bosilmaydigan sozlama, pul nazorati esa har kuni
 * ochiladi — ekranning asosiy joyi o'shanga tegishli.
 */
export function RejimPaneli({
  businessId,
  yoqilgan,
}: {
  businessId: string;
  yoqilgan: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [band, setBand] = useState(false);

  async function almashtir() {
    if (
      !yoqilgan &&
      !confirm(
        "Har faol xodimga shaxsiy kassa ochiladi va naqd yozuvlar o'sha kassalarga tusha boshlaydi. Davom etamizmi?"
      )
    ) {
      return;
    }
    setBand(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shaxsiyKassa: !yoqilgan }),
      });
      if (!res.ok) {
        toast({ message: (await res.json()).error ?? "Saqlab bo'lmadi", tone: "error" });
        return;
      }
      toast({
        message: yoqilgan ? "Shaxsiy kassa rejimi o'chirildi" : "Shaxsiy kassa rejimi yoqildi",
        tone: "success",
      });
      router.refresh();
    } finally {
      setBand(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">
          Shaxsiy kassa rejimi ·{" "}
          <span className={yoqilgan ? "text-income" : "text-faint"}>
            {yoqilgan ? "yoqilgan" : "o'chiq"}
          </span>
        </p>
        <p className="text-2xs text-muted mt-1 max-w-xl">
          Yoqilganda naqd pul yozuvni kiritgan xodimning o&apos;z kassasiga tushadi — &quot;kimning
          qo&apos;lida qancha bor&quot; savoliga kassalar ro&apos;yxati javob beradi. O&apos;chiq
          bo&apos;lsa hamma naqd umumiy kassaga tushadi.
        </p>
      </div>
      <Button variant="secondary" onClick={almashtir} loading={band}>
        {yoqilgan ? "O'chirish" : "Yoqish"}
      </Button>
    </div>
  );
}
