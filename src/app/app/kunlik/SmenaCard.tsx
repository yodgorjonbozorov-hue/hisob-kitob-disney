"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SmenaHolatDTO } from "@/lib/queries/smena";
import type { KunlikRuxsat } from "@/lib/services/kunlik";
import { SmenaYopishModal } from "./SmenaYopishModal";
import { SmenaQatori, Qator } from "./SmenaQatori";
import { soatToshkent } from "./vaqt";

/**
 * SMENA NAZORATI — kassa solishtiruvi (cash reconciliation).
 *
 * ═══ NIMA KO'RSATILADI ═══
 * Ilgari bu yerda faqat "Kassada bo'lishi kerak: N" degan yalang'och raqam
 * turardi va u qayerdan chiqqani ko'rinmasdi. Endi zanjir to'liq:
 *   smena boshi → +naqd kirim → −naqd chiqim → tizim bo'yicha kassada.
 * Foydalanuvchi raqamni tekshira oladi, ishonmasa qaysi qadam noto'g'ri
 * ekanini ko'radi.
 *
 * ═══ OYNA — BIZNES BO'YICHA ═══
 * Smena oynasi butun biznesning naqd harakati (kim kiritganidan qat'i nazar).
 * Shaxsiy kassa rejimidagi biznesda "sizning kassangiz" raqami ALOHIDA —
 * u kun yakuni kartasida ko'rsatiladi. Ikkalasi ataylab turlicha nomlangan,
 * chunki ular turli savolga javob beradi.
 */
export function SmenaCard({
  holat,
  ruxsat,
  bugungi,
}: {
  holat: SmenaHolatDTO;
  ruxsat: KunlikRuxsat;
  bugungi: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const joriy = holat.joriy;
  const oxirgiId = holat.yopilganlar[holat.yopilganlar.length - 1]?.id;

  async function qaytaOch(smenaId: string) {
    if (!confirm("Bu smena qayta ochilsinmi? Yozuvi o'chadi, raqamlari joriy smenaga qaytadi.")) {
      return;
    }
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kunlik/smena/qayta-ochish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smenaId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Qayta ochib bo'lmadi");
        return;
      }
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">🔁 Smena nazorati</p>
          {joriy ? (
            <p className="text-base sm:text-lg font-semibold text-fg mt-0.5">
              {joriy.raqam}-smena · ochiq
              <span className="text-sm text-muted font-normal">
                {" "}
                · {soatToshkent(joriy.boshlanishAt)} dan beri
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted mt-1">
              O&apos;tgan kun — shu kunda yopilgan smenalar quyida.
            </p>
          )}
        </div>
      </div>

      {joriy && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
          {joriy.boshlangichQoldiq > 0 && (
            <Qator belgi="🔓" nomi="Smena boshida kassada" summa={joriy.boshlangichQoldiq} />
          )}
          <Qator belgi="📈" nomi="Naqd kirim" summa={joriy.naqd} tone="income" signed />
          <Qator belgi="📉" nomi="Naqd chiqim" summa={-joriy.naqdChiqim} tone="expense" signed />
          <div className="border-t border-line mt-1 pt-1">
            <Qator
              belgi="💵"
              nomi="Tizim bo'yicha kassada"
              summa={joriy.kutilganNaqd}
              tone={joriy.kutilganNaqd < 0 ? "expense" : "brand"}
              kuchli
            />
          </div>
          {(joriy.click > 0 || joriy.qarz > 0) && (
            <p className="text-2xs text-faint mt-1.5">
              💳 Click {joriy.click.toLocaleString("uz-UZ")} · 📋 Qarz{" "}
              {joriy.qarz.toLocaleString("uz-UZ")} — bu pul jismoniy kassada emas, shuning uchun
              yuqoridagi hisobga kirmaydi.
            </p>
          )}

          {/* MANFIY QOLDIQ — sabab bilan tushuntiriladi, jim qoldirilmaydi. */}
          {joriy.kutilganNaqd < 0 && (
            <div className="mt-2 rounded-lg bg-expense-soft p-2.5">
              <p className="text-2xs text-expense-fg">
                ⚠ Kassa qoldig&apos;i manfiy. Bu odatda naqd chiqim naqd kirimdan ko&apos;p
                bo&apos;lganini bildiradi: masalan pul boshqa kassadan olib ishlatilgan yoki
                chiqim to&apos;lov turi xato tanlangan.
              </p>
              <p className="text-2xs text-muted mt-1">
                Tekshirish: pastdagi &quot;Bugungi operatsiyalar&quot; ro&apos;yxatida naqd
                chiqimlarni ko&apos;rib chiqing.
              </p>
            </div>
          )}

          {!ruxsat.tarixniKoradi && (
            <p className="text-2xs text-faint mt-2">
              Smena oxirida kassadagi naqdni SANAB kiriting — tizim solishtiradi.
            </p>
          )}
        </div>
      )}

      {joriy && bugungi && (
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setModal(true)}>
            🔒 Smenani yopish
          </Button>
          <p className="text-2xs text-faint mt-1">
            Pul topshiriladi, keyingi smena 0 dan boshlanadi
          </p>
        </div>
      )}

      {holat.yopilganlar.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {holat.yopilganlar.map((s) => (
            <SmenaQatori
              key={s.id}
              s={s}
              oxirgimi={s.id === oxirgiId && bugungi}
              ruxsat={ruxsat}
              onQaytaOch={qaytaOch}
              loading={loading}
            />
          ))}
        </ul>
      )}

      {holat.yopilganlar.length === 0 && joriy && (
        <p className="text-2xs text-faint mt-3">
          Bugun hali smena yopilmagan. Birinchi smena tugaganda kassani sanab yoping — ikkinchi
          smena o&apos;z puli bilan alohida hisoblanadi.
        </p>
      )}

      {xato && <p className="text-sm text-expense mt-3">{xato}</p>}

      {modal && joriy && (
        <SmenaYopishModal
          raqam={joriy.raqam}
          kutilganNaqd={ruxsat.tarixniKoradi ? joriy.kutilganNaqd : null}
          onClose={() => setModal(false)}
          onDone={() => {
            setModal(false);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}
