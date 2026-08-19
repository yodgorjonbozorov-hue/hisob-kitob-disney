"use client";

import { useEffect, useState } from "react";

interface ModulHolat {
  code: string;
  nomi: string;
  core: boolean;
  tarifdaBor: boolean;
  yoqilgan: boolean;
}

/**
 * BITTA KOMPANIYANING MODULLARI — superadmin paneli uchun.
 *
 * O'CHIRISH MA'LUMOTGA TEGMAYDI: faqat kirish yopiladi. Sotuvlar, cheklar,
 * mahsulotlar, ombor harakati va tarix bazada joyida qoladi va modul qayta
 * yoqilganda hammasi ko'rinadi. Shu holat panelda ham yozib qo'yilgan —
 * superadmin "o'chirsam ma'lumot yo'qoladimi" deb ikkilanmasligi kerak.
 */
export function TenantModullar({
  tenantId,
  tenantNomi,
  btn,
  onXabar,
}: {
  tenantId: string;
  tenantNomi: string;
  btn: string;
  onXabar: (matn: string) => void;
}) {
  const [modullar, setModullar] = useState<ModulHolat[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let bekor = false;
    (async () => {
      try {
        const res = await fetch(`/api/superadmin/tenants/${tenantId}/modules`);
        const data = await res.json();
        if (bekor) return;
        if (!res.ok) {
          onXabar(`Xato: ${data.error ?? res.status}`);
          return;
        }
        setModullar(data);
      } catch {
        if (!bekor) onXabar("Serverga ulanib bo'lmadi");
      }
    })();
    return () => {
      bekor = true;
    };
    // onXabar har renderda yangi funksiya bo'lishi mumkin — faqat tenantId'ga bog'laymiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function toggle(m: ModulHolat) {
    if (
      m.yoqilgan &&
      !confirm(
        `${tenantNomi}: "${m.nomi}" moduli o'chirilsinmi?\n\n` +
          "Ma'lumot O'CHMAYDI — sotuvlar, cheklar, mahsulotlar va tarix bazada qoladi. " +
          "Faqat bo'limga kirish yopiladi va modul qayta yoqilsa hammasi ko'rinadi."
      )
    ) {
      return;
    }
    setBusy(m.code);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: m.code, isActive: !m.yoqilgan }),
      });
      const data = await res.json();
      if (!res.ok) {
        onXabar(`Xato: ${data.error ?? res.status}`);
        return;
      }
      setModullar((prev) =>
        prev ? prev.map((x) => (x.code === m.code ? { ...x, yoqilgan: !m.yoqilgan } : x)) : prev
      );
      onXabar(`${tenantNomi}: "${m.nomi}" ${m.yoqilgan ? "o'chirildi" : "yoqildi"}.`);
    } catch {
      onXabar("Serverga ulanib bo'lmadi");
    } finally {
      setBusy(null);
    }
  }

  if (!modullar) {
    return <p className="text-xs text-muted py-2">Modullar yuklanmoqda...</p>;
  }

  return (
    <div className="py-1 space-y-1.5">
      {modullar.map((m) => (
        <div key={m.code} className="flex items-center gap-3 text-xs flex-wrap">
          <span className="font-medium text-fg w-52">{m.nomi}</span>
          <span className={m.yoqilgan ? "text-income-fg" : "text-faint"}>
            {m.yoqilgan ? "ON" : "OFF"}
          </span>
          {!m.tarifdaBor && <span className="text-faint">tarifda yo&apos;q</span>}
          {m.core ? (
            <span className="text-faint">asosiy — o&apos;chirilmaydi</span>
          ) : (
            <button
              className={btn}
              disabled={busy === m.code || (!m.yoqilgan && !m.tarifdaBor)}
              onClick={() => toggle(m)}
            >
              {m.yoqilgan ? "O'chirish" : "Yoqish"}
            </button>
          )}
        </div>
      ))}
      <p className="text-2xs text-faint pt-1">
        Modul o&apos;chirilganda ma&apos;lumot o&apos;chmaydi — faqat kirish yopiladi.
      </p>
    </div>
  );
}
