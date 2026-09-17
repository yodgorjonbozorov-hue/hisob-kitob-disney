"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { parseSomInput, formatMoney } from "@/lib/format";
import { SmenaTopshirishTasdiq } from "./SmenaTopshirishTasdiq";
import type { KanalKesimDTO } from "@/lib/queries/topshirishKanali";

export interface TopshirishNishoni {
  id: string;
  nomi: string;
  egaIsm: string | null;
}
/**
 * SMENANI TOPSHIRISH — NAQD + ONLINE KANALLAR.
 *
 * NAQD: tizim hisobi ko'rsatiladi va o'zgartirilmaydi; xodim faqat
 * haqiqatda topshirayotgan summani kiritadi. Farq (kamomad/ortiqcha)
 * darhol ko'rinadi va sabab so'raladi — nazoratning ma'nosi shunda.
 *
 * ONLINE (Click / Payme / terminal): pul xodimning qo'lida EMAS, u
 * karta/hisob kassasida. Shuning uchun summa TAHRIRLANMAYDI — uni CRM
 * to'lovlaridan server hisoblaydi (`lib/queries/topshirishKanali.ts`),
 * xodim esa faqat QAYSILARINI topshirayotganini belgilaydi ("taxminan
 * 300 000 Click oldim" degan qo'lda raqam paydo bo'lmaydi). Tanlanmagan
 * kanal keyingi topshirishda yana chiqadi.
 *
 * Topshiriq DARHOL yakunlanmaydi — qabul qiluvchi "Qabul qilish"ni
 * bosgunicha naqd pul topshiruvchining kassasida qoladi.
 */
export function SmenaTopshirishModal({
  qoldiq,
  nishonlar,
  kanallar = [],
  sarlavha = "Smenani topshirish",
  onClose,
  onDone,
}: {
  /** Tizim hisoblagan joriy kassa qoldig'i (naqd). */
  qoldiq: number;
  /** Kimga topshirish mumkin — boshqa faol kassalar. */
  nishonlar: TopshirishNishoni[];
  /**
   * TO'LOV KANALI KESIMI (naqd + online). Berilmasa — faqat naqd
   * topshirish (eski chaqiruvchilar avvalgidek ishlaydi).
   */
  kanallar?: KanalKesimDTO[];
  /** Oyna sarlavhasi — chaqirilgan joyning tili bilan mos ("Kassa topshirish"). */
  sarlavha?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  // Naqd kanali alohida maydonda — ro'yxatda faqat ONLINE kanallar.
  const onlineKanallar = kanallar.filter((k) => k.kanal !== "naqd" && k.summa > 0);
  const [toAccountId, setTo] = useState(nishonlar[0]?.id ?? "");
  const [summaMatn, setSummaMatn] = useState(String(qoldiq));
  const [tanlangan, setTanlangan] = useState<string[]>(() => onlineKanallar.map((k) => k.kanal));
  const [izoh, setIzoh] = useState("");
  const [tasdiq, setTasdiq] = useState(false);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const summa = parseSomInput(summaMatn);
  // FARQ faqat naqd topshirilganda ma'noga ega: naqd 0 bo'lsa (faqat online
  // topshirilmoqda) tizim hisobiga qarshi kamomad yozilmaydi — server ham
  // AYNI qoidani qo'llaydi (`lib/services/kassaTransfer.ts`).
  const farq = summa > 0 ? summa - qoldiq : 0;
  const nishon = nishonlar.find((n) => n.id === toAccountId);
  const onlineJami = onlineKanallar
    .filter((k) => tanlangan.includes(k.kanal))
    .reduce((s, k) => s + k.summa, 0);
  const jamiTopshirish = summa + onlineJami;
  /** Farq bo'lsa sabab SHART — server ham AYNI qoidani majburlaydi. */
  const bosilmaydi = summa < 0 || (farq !== 0 && !izoh.trim());

  function kanalAlmash(kanal: string) {
    setTanlangan((oldingi) =>
      oldingi.includes(kanal) ? oldingi.filter((k) => k !== kanal) : [...oldingi, kanal]
    );
  }

  async function yubor() {
    // Ikki marta bosishdan himoya: birinchi so'rov tugamaguncha ikkinchisi ketmaydi
    // (server ham ochiq topshiriqni qayta tekshiradi).
    if (loading) return;
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kassa-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAccountId,
          summa,
          turi: "smena",
          izoh: izoh.trim() || null,
          // FAQAT KANAL NOMLARI — summani server o'zi hisoblaydi.
          kanallar: tanlangan,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        setTasdiq(false);
        return;
      }
      const online = onlineJami > 0 ? `, online ${formatMoney(onlineJami)}` : "";
      toast({
        message:
          `Kassa topshirildi · Jami: ${formatMoney(jamiTopshirish)} ` +
          `(naqd ${formatMoney(summa)}${online}) · ` +
          `Joriy naqd kassa: ${formatMoney(Math.max(qoldiq - summa, 0))}`,
        tone: "success",
        duration: 7000,
      });
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
      setTasdiq(false);
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";
  if (tasdiq) {
    return (
      <SmenaTopshirishTasdiq
        sarlavha={sarlavha}
        nishon={nishon}
        naqd={summa}
        naqdQoldiq={qoldiq}
        farq={farq}
        online={onlineKanallar.filter((k) => tanlangan.includes(k.kanal))}
        jami={jamiTopshirish}
        loading={loading}
        xato={xato}
        onOrqaga={() => setTasdiq(false)}
        onTasdiq={yubor}
      />
    );
  }

  return (
    <Modal open onClose={onClose} title={sarlavha}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTasdiq(true);
        }}
        className="space-y-3"
      >
        <div className="rounded-xl bg-surface-2 border border-line p-3 text-center">
          <p className="text-2xs text-muted">Naqd kassangizdagi hisob</p>
          <p className="text-xl font-bold text-fg tnum">{formatMoney(qoldiq)}</p>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="sm-to">
            Kimga topshiriladi
          </label>
          <Select
            id="sm-to"
            value={toAccountId}
            onChange={setTo}
            searchable={nishonlar.length > 7}
            options={nishonlar.map((n) => ({ value: n.id, label: n.egaIsm ?? n.nomi }))}
          />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="sm-summa">
            Topshiriladigan naqd summa
          </label>
          <input
            id="sm-summa"
            inputMode="numeric"
            value={summaMatn}
            onChange={(e) => setSummaMatn(e.target.value)}
            required
            className={input}
          />
          {farq !== 0 && summa > 0 && (
            <p className={`text-2xs mt-1 ${farq < 0 ? "text-expense" : "text-debt"}`}>
              Kassa farqi: {farq > 0 ? "+" : "−"}
              {Math.abs(farq).toLocaleString("ru-RU")} so&apos;m — sababini izohda yozing.
            </p>
          )}
        </div>

        {onlineKanallar.length > 0 && (
          <div className="rounded-xl border border-line p-3 space-y-2">
            <p className="text-2xs uppercase tracking-wide text-faint">
              Online tushum — CRM to&apos;lovlaridan hisoblangan
            </p>
            {onlineKanallar.map((k) => (
              <label key={k.kanal} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tanlangan.includes(k.kanal)}
                    onChange={() => kanalAlmash(k.kanal)}
                    className="w-5 h-5"
                  />
                  <span className="text-fg">{k.nomi}</span>
                </span>
                <span className="tnum text-fg font-medium">{formatMoney(k.summa)}</span>
              </label>
            ))}
            <p className="text-2xs text-faint">
              Summalar yozilgan to&apos;lovlardan olinadi va tahrirlanmaydi.
            </p>
          </div>
        )}

        <div className="rounded-xl bg-surface-2 border border-line p-3 flex items-baseline justify-between">
          <span className="text-sm font-medium text-fg">Jami topshirish</span>
          <span className="text-lg font-bold text-fg tnum">{formatMoney(jamiTopshirish)}</span>
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="sm-izoh">
            Izoh {farq !== 0 ? "(farq sababi)" : "(ixtiyoriy)"}
          </label>
          <input
            id="sm-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={300}
            placeholder={farq !== 0 ? "Masalan: mijozga qaytim ortiqcha berildi" : "Kechki smena"}
            className={input}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={jamiTopshirish <= 0 || !toAccountId || bosilmaydi}>
            Davom etish
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
