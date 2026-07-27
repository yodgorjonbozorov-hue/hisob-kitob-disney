"use client";

import { useRouter } from "next/navigation";

/** SUPERADMIN tenant nomidan kirganda ko'rinadigan doimiy ogohlantirish. */
export function ImpersonationBanner({ ism }: { ism: string }) {
  const router = useRouter();

  async function tugatish() {
    const res = await fetch("/api/superadmin/impersonate/exit", { method: "POST" });
    if (res.ok) {
      router.push("/superadmin");
      router.refresh();
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-brand bg-brand-wash text-fg px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
      <span>
        👁 Siz <span className="font-semibold">{ism}</span> nomidan SUPERADMIN sifatida kirgansiz (audit jurnalga
        yozilgan).
      </span>
      <button onClick={tugatish} className="font-medium text-brand underline shrink-0">
        Impersonatsiyani tugatish
      </button>
    </div>
  );
}
