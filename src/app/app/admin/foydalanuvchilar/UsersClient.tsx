"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { isManager } from "@/lib/auth/roles";
import { KpiQator } from "./KpiQator";
import { Filtrlar } from "./Filtrlar";
import { XodimlarRoyxat } from "./XodimlarRoyxat";
import { XodimDetail } from "./XodimDetail";
import { XodimTahrirModal } from "./XodimTahrirModal";
import { YangiXodimModal } from "./YangiXodimModal";
import { ParolTiklashModal, LoginOzgartirishModal } from "./TiklashModal";
import { OchirishModal } from "./OchirishModal";
import { useXodimlar, type Sanoq } from "./useXodimlar";
import type { MenuAmali } from "./AmalMenu";
import type { BusinessOption, MaxsusRol, XodimDTO } from "./turlar";

type Oyna =
  | { tur: "detail" | "tahrir" | "parol" | "login" | "ochirish"; xodim: XodimDTO }
  | { tur: "yangi" }
  | null;

export function UsersClient({
  boshlangich,
  currentUserId,
  businesses,
  maxsusRollar,
  pro,
}: {
  boshlangich: { items: XodimDTO[]; total: number; sanoq: Sanoq; pageSize: number };
  currentUserId: string;
  businesses: BusinessOption[];
  maxsusRollar: MaxsusRol[];
  pro: boolean;
}) {
  const d = useXodimlar(boshlangich);
  const [oyna, setOyna] = useState<Oyna>(null);
  const [xato, setXato] = useState<string | null>(null);

  /** Holatni almashtirish — o'chirishga qaraganda xavfsiz va qaytariladigan amal. */
  async function holatniAlmashtir(x: XodimDTO) {
    setXato(null);
    const res = await fetch(`/api/users/${x.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !x.isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      setXato(data.error ?? "Holatni o'zgartirib bo'lmadi");
      return;
    }
    d.almashtir(data as XodimDTO);
    d.qaytaYukla();
    setOyna(null);
  }

  /** Xatoni QAYTARADI (modal uni o'z ichida ko'rsatadi), muvaffaqiyatda null. */
  async function ochir(x: XodimDTO): Promise<string | null> {
    const res = await fetch(`/api/users/${x.id}`, { method: "DELETE" });
    if (!res.ok) return (await res.json()).error ?? "O'chirib bo'lmadi";
    setOyna(null);
    d.qaytaYukla();
    return null;
  }

  /** Bitta xodim uchun "•••" menyusi — ruxsat va mantiq bo'yicha cheklangan. */
  function amallar(x: XodimDTO): MenuAmali[] {
    const ozi = x.id === currentUserId;
    // Kompaniyada bitta faol direktor qolgan bo'lsa — uni chiqarib bo'lmaydi.
    // Server ham shuni tekshiradi (lib/services/userGuard.ts); bu yerda faqat
    // tugmani oldindan o'chirib, SABABINI aytamiz.
    const oxirgi = x.isActive && isManager(x.rol) && d.sanoq.boshqaruvchi <= 1;
    const qulf = ozi
      ? "O'zingizga nisbatan bajarib bo'lmaydi"
      : oxirgi
        ? "Kompaniyadagi yagona direktor"
        : undefined;

    return [
      { label: "Tahrirlash", onClick: () => setOyna({ tur: "tahrir", xodim: x }) },
      { label: "Loginni o'zgartirish", onClick: () => setOyna({ tur: "login", xodim: x }) },
      { label: "Parolni tiklash", onClick: () => setOyna({ tur: "parol", xodim: x }) },
      {
        label: x.isActive ? "Nofaollashtirish" : "Faollashtirish",
        onClick: () => void holatniAlmashtir(x),
        // Faollashtirish hech kimni qulflab qo'ymaydi — u har doim ochiq.
        ochirilgan: x.isActive ? qulf : undefined,
      },
      {
        label: "O'chirish",
        tur: "xavf",
        onClick: () => setOyna({ tur: "ochirish", xodim: x }),
        ochirilgan: qulf,
      },
    ];
  }

  const sahifalar = Math.ceil(d.total / d.pageSize);
  const filtrlangan = d.filtr.q !== "" || d.filtr.holat !== "hammasi" || d.filtr.rol !== "" || d.filtr.biznes !== "";

  return (
    <div className="space-y-4">
      <KpiQator sanoq={d.sanoq} />

      <Filtrlar
        filtr={d.filtr}
        setFiltr={d.setFiltr}
        businesses={businesses}
        maxsusRollar={maxsusRollar}
        onYangi={() => setOyna({ tur: "yangi" })}
      />

      {(xato || d.xato) && (
        <p className="text-sm text-expense rounded-lg bg-expense-soft px-3 py-2">{xato ?? d.xato}</p>
      )}

      <Card className={d.yuklanmoqda ? "opacity-60 transition" : "transition"}>
        {d.xodimlar.length === 0 ? (
          <EmptyState
            icon="👤"
            title={filtrlangan ? "Hech kim topilmadi" : "Hali xodim qo'shilmagan"}
            description={
              filtrlangan
                ? "Qidiruv yoki filtrni o'zgartirib ko'ring."
                : "Birinchi xodimingizni qo'shing — u o'z logini bilan kiradi va ishini o'z nomidan yuritadi."
            }
            action={
              filtrlangan ? undefined : (
                <Button onClick={() => setOyna({ tur: "yangi" })}>+ Xodim qo&apos;shish</Button>
              )
            }
          />
        ) : (
          <XodimlarRoyxat
            xodimlar={d.xodimlar}
            onOch={(x) => setOyna({ tur: "detail", xodim: x })}
            amallar={amallar}
          />
        )}

        {sahifalar > 1 && (
          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-line">
            <Button
              variant="secondary"
              size="sm"
              disabled={d.page <= 1}
              onClick={() => d.setPage(d.page - 1)}
            >
              Oldingi
            </Button>
            <span className="text-2xs text-faint tnum">
              {d.page} / {sahifalar} — jami {d.total}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={d.page >= sahifalar}
              onClick={() => d.setPage(d.page + 1)}
            >
              Keyingi
            </Button>
          </div>
        )}
      </Card>

      {pro && (
        <p className="text-xs text-faint">
          Maxsus rollar va ularning huquqlari{" "}
          <a href="/app/admin/rollar" className="text-brand hover:underline">
            Rollar va huquqlar
          </a>{" "}
          bo&apos;limida boshqariladi.
        </p>
      )}

      {oyna?.tur === "yangi" && (
        <YangiXodimModal
          businesses={businesses}
          maxsusRollar={maxsusRollar}
          onClose={() => setOyna(null)}
          onYaratildi={d.qaytaYukla}
        />
      )}

      {oyna?.tur === "detail" && (
        <XodimDetail
          xodim={oyna.xodim}
          amallar={amallar(oyna.xodim)}
          onTahrir={() => setOyna({ tur: "tahrir", xodim: oyna.xodim })}
          onClose={() => setOyna(null)}
        />
      )}

      {oyna?.tur === "tahrir" && (
        <XodimTahrirModal
          xodim={oyna.xodim}
          businesses={businesses}
          maxsusRollar={maxsusRollar}
          ozi={oyna.xodim.id === currentUserId}
          onClose={() => setOyna(null)}
          onSaqlandi={(yangi) => {
            d.almashtir(yangi);
            d.qaytaYukla();
            setOyna(null);
          }}
        />
      )}

      {oyna?.tur === "parol" && (
        <ParolTiklashModal xodim={oyna.xodim} onClose={() => setOyna(null)} />
      )}

      {oyna?.tur === "login" && (
        <LoginOzgartirishModal
          xodim={oyna.xodim}
          onClose={() => setOyna(null)}
          onSaqlandi={(yangi) => {
            d.almashtir(yangi);
            setOyna(null);
          }}
        />
      )}

      {oyna?.tur === "ochirish" && (
        <OchirishModal
          xodim={oyna.xodim}
          onNofaollashtir={() => void holatniAlmashtir(oyna.xodim)}
          onOchir={() => ochir(oyna.xodim)}
          onClose={() => setOyna(null)}
        />
      )}
    </div>
  );
}
