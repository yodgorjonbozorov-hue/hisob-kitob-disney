"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatSom, formatToshkentSoat } from "@/lib/format";
import type { TransferDTO } from "@/lib/queries/accounts";

/**
 * KUTILAYOTGAN TOPSHIRISHLAR — sahifadagi YAGONA harakat talab qiladigan blok.
 *
 * Pul hali ko'chmagan: u yuboruvchining kassasida turibdi va qoldiqqa
 * kirmaydi (lib/services/kassaTransfer.ts). Shu bois blok eng tepada, lekin
 * IXCHAM: topshiriq yo'q bo'lsa bitta qator matn qoladi, katta bo'sh joy
 * egallamaydi — sahifaning asosiy ishi kassalarni ko'rsatish.
 *
 * KASSA FARQI shu yerda ko'rinadi: direktor tasdiqlashdan OLDIN "tizim
 * bo'yicha qancha edi, qancha topshirildi, farq qancha" savoliga javob
 * oladi. Farq topshirish paytida MUZLATILGAN (qatordagi `hisoblangan`/
 * `farq`), shuning uchun oradan vaqt o'tsa ham raqam o'zgarmaydi.
 *
 * Qabul/rad — QABUL QILUVCHI yoki boshqaruvchi; bekor — YUBORUVCHI.
 * Server ham AYNI shu qoidani mustaqil tekshiradi: bu yerdagi tugmalar
 * shunchaki keraksizini ko'rsatmaydi.
 */
export function KutilayotganPanel({
  transferlar,
  meniUserId,
  boshqaruvchi,
  qabulQila,
}: {
  transferlar: TransferDTO[];
  meniUserId: string;
  boshqaruvchi: boolean;
  /** "pul.qabul" huquqi — qaror API'si shuni talab qiladi. */
  qabulQila: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [bandId, setBandId] = useState<string | null>(null);

  if (transferlar.length === 0) {
    return (
      <p className="text-2xs text-faint px-1">Kutilayotgan topshirish yo&apos;q</p>
    );
  }

  async function qaror(t: TransferDTO, amal: "qabul" | "rad" | "bekor") {
    if (amal !== "qabul") {
      const savol =
        amal === "rad"
          ? `${t.fromUserIsm ?? t.fromNomi} yuborgan ${formatSom(t.summa)} soʻm rad etilsinmi?`
          : "O'tkazma bekor qilinsinmi?";
      if (!confirm(savol)) return;
    }
    // IKKI MARTA BOSISHDAN HIMOYA: qator band bo'lsa tugmalar o'chadi.
    // Bazada ham himoya bor (holat = "kutilmoqda" sharti), bu esa keraksiz
    // so'rov va "allaqachon qabul qilingan" xatosini oldini oladi.
    setBandId(t.id);
    try {
      const res = await fetch(`/api/kassa-transfer/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amal }),
      });
      if (!res.ok) {
        toast({ message: (await res.json()).error ?? "Bajarib bo'lmadi", tone: "error" });
        return;
      }
      toast({
        message:
          amal === "qabul"
            ? "Qabul qilindi — pul kassangizga o'tdi"
            : amal === "rad"
              ? "Rad etildi — pul yuboruvchida qoldi"
              : "Bekor qilindi",
        tone: "success",
      });
      router.refresh();
    } finally {
      setBandId(null);
    }
  }

  return (
    <section className="bg-surface border border-debt/40 rounded-2xl shadow-card overflow-hidden">
      <h2 className="px-4 sm:px-5 py-2.5 text-2xs font-semibold uppercase tracking-wider text-debt-fg bg-debt-soft">
        Kutilayotgan topshirishlar · {transferlar.length}
      </h2>
      <ul className="divide-y divide-line">
        {transferlar.map((t) => {
          const menga = t.toUserId === meniUserId;
          const mendan = t.fromUserId === meniUserId;
          const band = bandId === t.id;
          const farq = t.farq ?? 0;
          return (
            <li key={t.id} className="px-4 sm:px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg truncate">
                    {t.fromUserIsm ?? t.fromNomi} → {t.toUserIsm ?? t.toNomi}
                  </p>
                  <p className="text-2xs text-faint mt-0.5">
                    {formatToshkentSoat(new Date(t.createdAt))}
                    {t.turi === "smena" ? " · Kassani topshirish" : " · Pul o'tkazish"}
                    {menga ? " · sizga" : mendan ? " · siz yubordingiz" : ""}
                  </p>
                  {t.izoh && <p className="text-2xs text-muted mt-0.5 break-words">{t.izoh}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display tnum text-base font-semibold text-fg whitespace-nowrap">
                    {formatSom(t.summa)}
                  </p>
                  {t.hisoblangan !== null && (
                    <p
                      className={`text-2xs tnum whitespace-nowrap ${
                        farq === 0 ? "text-faint" : "text-expense"
                      }`}
                    >
                      {farq === 0 ? "Farq yo'q" : `Farq: − ${formatSom(Math.abs(farq))}`}
                    </p>
                  )}
                </div>
              </div>

              {t.hisoblangan !== null && farq !== 0 && (
                <p className="text-2xs text-muted mt-1.5">
                  Tizim bo&apos;yicha {formatSom(t.hisoblangan)} soʻm edi — kamomad topshiruvchi
                  kassasida ochiq qoladi.
                </p>
              )}

              <div className="flex flex-wrap gap-2 mt-2.5">
                {(menga || boshqaruvchi) && qabulQila && (
                  <>
                    <Button size="sm" onClick={() => qaror(t, "qabul")} disabled={band}>
                      Qabul qilish
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => qaror(t, "rad")}
                      disabled={band}
                    >
                      Rad etish
                    </Button>
                  </>
                )}
                {/* Bekor qilish ham AYNI qaror API'sidan o'tadi, ya'ni u ham
                    "pul.qabul" huquqini talab qiladi — huquqsiz odamga
                    ishlamaydigan tugma ko'rsatilmaydi. */}
                {(mendan || boshqaruvchi) && qabulQila && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => qaror(t, "bekor")}
                    disabled={band}
                  >
                    Bekor qilish
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
