"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";

/** Audit lentasining filtri — amal turi va qarzdor nomi. */
export function QarzAuditFiltr({ amal, q }: { amal: string; q: string }) {
  const router = useRouter();
  const [qidiruv, setQidiruv] = useState(q);

  function yubor(yangiAmal: string, yangiQ: string) {
    const sp = new URLSearchParams();
    if (yangiAmal) sp.set("amal", yangiAmal);
    if (yangiQ.trim()) sp.set("q", yangiQ.trim());
    router.push(`/app/qarzlar/audit${sp.toString() ? `?${sp}` : ""}`);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Select
        value={amal}
        onChange={(v) => yubor(v, qidiruv)}
        aria-label="Amal turi"
        options={[
          { value: "", label: "Barcha amallar" },
          { value: "update", label: "Tuzatildi" },
          { value: "delete", label: "O'chirildi" },
          { value: "create", label: "Yaratildi" },
        ]}
      />
      <input
        type="search"
        value={qidiruv}
        onChange={(e) => setQidiruv(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") yubor(amal, qidiruv);
        }}
        onBlur={() => yubor(amal, qidiruv)}
        placeholder="Mijoz yoki ta'minotchi nomi..."
        className={INPUT_CLASS}
        aria-label="Qarzdor bo'yicha qidiruv"
      />
    </div>
  );
}
