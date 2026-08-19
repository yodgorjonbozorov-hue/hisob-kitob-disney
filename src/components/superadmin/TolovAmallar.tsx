"use client";

import { XavfliAmal } from "./XavfliAmal";
import { formatSom } from "@/lib/format";

/**
 * TO'LOV QARORI (talab 20).
 *
 * Tasdiqlash obunani uzaytiradi — ya'ni bu pul qarori, shuning uchun
 * oqibatlari ochiq ko'rsatiladi. Rad etishda sabab MAJBURIY.
 */
export function TolovAmallar({
  paymentId,
  tenantNomi,
  amount,
  status,
}: {
  paymentId: string;
  tenantNomi: string;
  amount: number;
  status: string;
}) {
  if (status !== "PENDING") return <span className="text-2xs text-faint">qaror qabul qilingan</span>;

  return (
    <div className="flex flex-wrap gap-2">
      <XavfliAmal
        label="Tasdiqlash"
        variant="primary"
        size="sm"
        sarlavha="To'lovni tasdiqlash"
        tavsif={`${tenantNomi} · ${formatSom(amount)}`}
        nimaBoladi={[
          "Obuna 30 kunga uzaytiriladi va kompaniya holati FAOL bo'ladi.",
          "Obuna davri yozuvi yaratiladi (tarix uchun).",
          "To'lovda tarif ko'rsatilgan bo'lsa kompaniya tarifi ham o'sha tarifga o'tadi.",
        ]}
        url={`/api/superadmin/payments/${paymentId}/confirm`}
        sababKerak={false}
      />
      <XavfliAmal
        label="Rad etish"
        size="sm"
        sarlavha="To'lovni rad etish"
        tavsif={`${tenantNomi} · ${formatSom(amount)}`}
        nimaBoladi={[
          "To'lov RAD ETILGAN deb belgilanadi.",
          "Obuna muddati uzaytirilmaydi.",
          "Sabab audit jurnaliga yoziladi.",
        ]}
        url={`/api/superadmin/payments/${paymentId}/reject`}
      />
    </div>
  );
}
