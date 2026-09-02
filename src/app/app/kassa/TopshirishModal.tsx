"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { parseSomInput, formatSom, formatMoney } from "@/lib/format";
import type { KassaNazoratKarta } from "@/lib/queries/kassaNazorat";

const input =
  "w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-surface-2 border border-line text-fg " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/**
 * KASSANI TOPSHIRISH.
 *
 * TIZIM hisobi ko'rsatiladi va u O'ZGARTIRILMAYDI — xodim faqat haqiqatda
 * topshirayotgan summani kiritadi. Farq (kamomad) darhol ko'rinadi va sababi
 * so'raladi: nazoratning butun ma'nosi shunda. Server ham AYNI shu qoidani
 * mustaqil tekshiradi (izohsiz farq qabul qilinmaydi) va "tizim bo'yicha"
 * raqamni O'ZI hisoblaydi — so'rov tanasidan olinmaydi.
 *
 * MANFIY QOLDIQ TAQIQLANGAN (mavjud biznes qoidasi): tizim hisobidan KO'P
 * pul topshirib bo'lmaydi. Ortiqcha pul chiqsa u kassaga kirim sifatida
 * yoziladi — bu kassa harakati emas, shuning uchun bu yerda emas.
 *
 * Topshiriq DARHOL yakunlanmaydi: qabul qiluvchi pulni sanab "Qabul qilish"ni
 * bosgunicha pul topshiruvchining kassasida qoladi.
 */
export function TopshirishModal({
  kassalar,
  boshlangichId,
  nishonlar,
  onClose,
  onDone,
}: {
  /** Topshirish mumkin bo'lgan kassalar (huquq sahifada tekshirilgan). */
  kassalar: KassaNazoratKarta[];
  boshlangichId: string | null;
  /** Barcha faol kassalar — qabul qiluvchi shulardan tanlanadi. */
  nishonlar: KassaNazoratKarta[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [fromId, setFrom] = useState(boshlangichId ?? kassalar[0]?.id ?? "");
  const manba = kassalar.find((k) => k.id === fromId);
  const tizim = Math.max(manba?.mavjud ?? 0, 0);

  const [summaMatn, setSummaMatn] = useState(formatSom(tizim));
  const [toId, setTo] = useState(nishonlar.find((n) => n.id !== fromId)?.id ?? "");
  const [izoh, setIzoh] = useState("");
  const [tasdiq, setTasdiq] = useState(false);
  const [yuborilmoqda, setYuborilmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const summa = parseSomInput(summaMatn);
  const farq = summa - tizim;
  const nishon = nishonlar.find((n) => n.id === toId);
  const ortiqcha = farq > 0;
  const izohKerak = farq !== 0 && !izoh.trim();

  function manbaAlmash(id: string) {
    setFrom(id);
    const yangi = kassalar.find((k) => k.id === id);
    setSummaMatn(formatSom(Math.max(yangi?.mavjud ?? 0, 0)));
    if (toId === id) setTo(nishonlar.find((n) => n.id !== id)?.id ?? "");
  }

  async function yubor() {
    setYuborilmoqda(true);
    setXato(null);
    try {
      const res = await fetch("/api/kassa-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: fromId,
          toAccountId: toId,
          summa,
          turi: "smena",
          izoh: izoh.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        setTasdiq(false);
        return;
      }
      // Topshirilgan zahoti joriy smena 0 dan boshlanadi (server hisobi);
      // "Joriy kassa" — topshirishdan keyin kassada qoladigan mavjud pul.
      toast({
        message:
          `Kassa muvaffaqiyatli topshirildi · Topshirildi: ${formatSom(summa)} soʻm · ` +
          `Joriy kassa: ${formatSom(Math.max(tizim - summa, 0))} soʻm`,
        tone: "success",
        duration: 7000,
      });
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
      setTasdiq(false);
    } finally {
      setYuborilmoqda(false);
    }
  }

  if (tasdiq) {
    return (
      <Modal open onClose={() => setTasdiq(false)} title="Kassani topshirasizmi?">
        <div className="space-y-4">
          <dl className="rounded-xl bg-surface-2 border border-line p-4 space-y-2 text-sm">
            <Qator yorliq="Kassa" qiymat={manba?.nomi ?? "—"} />
            <Qator yorliq="Kimga" qiymat={nishon?.egaIsm ?? nishon?.nomi ?? "—"} />
            <Qator yorliq="Tizim bo'yicha" qiymat={formatMoney(tizim)} tnum />
            <Qator yorliq="Topshiriladi" qiymat={formatMoney(summa)} tnum qalin />
            {farq !== 0 && (
              <div className="flex justify-between gap-4 border-t border-line pt-2">
                <dt className="text-expense">Kamomad</dt>
                <dd className="tnum font-semibold text-expense">− {formatSom(Math.abs(farq))}</dd>
              </div>
            )}
          </dl>
          <p className="text-2xs text-muted">
            {nishon?.egaIsm ?? "Qabul qiluvchi"} tasdiqlamaguncha pul sizning kassangizda qoladi.
            {farq !== 0 && " Kamomad kassangizda ochiq qoladi va direktor uni ko'radi."}
          </p>
          {xato && <p className="text-sm text-expense">{xato}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setTasdiq(false)} disabled={yuborilmoqda}>
              Orqaga
            </Button>
            {/* Ikki marta bosish: tugma yuborilayotganda o'chadi, serverda esa
                ochiq topshiriq borligi qayta tekshiriladi. */}
            <Button loading={yuborilmoqda} onClick={yubor}>
              Topshirish
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Kassani topshirish">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTasdiq(true);
        }}
        className="space-y-3"
      >
        {kassalar.length > 1 && (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="tp-from">
              Qaysi kassa
            </label>
            <Select
              id="tp-from"
              value={fromId}
              onChange={manbaAlmash}
              searchable={kassalar.length > 7}
              options={kassalar.map((k) => ({
                value: k.id,
                label: k.nomi,
                tavsif: formatSom(k.mavjud),
              }))}
            />
          </div>
        )}

        <div className="rounded-xl bg-surface-2 border border-line p-3 text-center">
          <p className="text-2xs text-muted">Tizim bo&apos;yicha</p>
          <p className="text-xl font-display font-bold text-fg tnum">{formatMoney(tizim)}</p>
          {manba && manba.kutilayotganChiqim > 0 && (
            <p className="text-2xs text-faint mt-1">
              {formatSom(manba.kutilayotganChiqim)} soʻm boshqa o&apos;tkazmada band
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tp-summa">
            Real topshiraman
          </label>
          <div className="flex gap-2">
            <input
              id="tp-summa"
              inputMode="numeric"
              autoComplete="off"
              value={summaMatn}
              // Kiritilayotgan raqam darhol guruhlanadi ("2 400 000"):
              // kassir ekrandagi summani nol sanamasdan o'qiy oladi.
              onChange={(e) =>
                setSummaMatn(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")
              }
              required
              className={`${input} text-lg font-display tnum`}
            />
            <Button variant="secondary" onClick={() => setSummaMatn(formatSom(tizim))}>
              Hammasi
            </Button>
          </div>
          <p
            className={`text-2xs mt-1.5 tnum ${
              farq === 0 ? "text-faint" : ortiqcha ? "text-debt" : "text-expense"
            }`}
          >
            {farq === 0
              ? "Farq yo'q"
              : ortiqcha
                ? `Farq: + ${formatSom(farq)} — tizim hisobidan ko'p pul topshirib bo'lmaydi`
                : `Farq: − ${formatSom(-farq)} — kamomad kassangizda ochiq qoladi`}
          </p>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tp-to">
            Qabul qiluvchi
          </label>
          <Select
            id="tp-to"
            value={toId}
            onChange={setTo}
            placeholder="— tanlang —"
            searchable={nishonlar.length > 7}
            options={nishonlar
              .filter((n) => n.id !== fromId)
              .map((n) => ({ value: n.id, label: n.egaIsm ?? n.nomi }))}
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tp-izoh">
            {farq !== 0 ? "Kamomad sababi" : "Izoh (ixtiyoriy)"}
          </label>
          <input
            id="tp-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={300}
            placeholder={farq !== 0 ? "Masalan: mijozga qaytim ortiqcha berildi" : "Kechki smena"}
            className={input}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={summa <= 0 || !toId || ortiqcha || izohKerak}>
            Davom etish
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Qator({
  yorliq,
  qiymat,
  tnum,
  qalin,
}: {
  yorliq: string;
  qiymat: string;
  tnum?: boolean;
  qalin?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{yorliq}</dt>
      <dd className={`text-fg ${tnum ? "tnum" : ""} ${qalin ? "font-semibold" : ""}`}>{qiymat}</dd>
    </div>
  );
}
