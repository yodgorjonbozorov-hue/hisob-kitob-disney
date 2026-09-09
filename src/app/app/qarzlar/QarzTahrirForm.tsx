"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatSom, parseSomInput } from "@/lib/format";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { MijozTanlash, type MijozTanlov } from "@/components/qarz/MijozTanlash";

/**
 * QARZNI TUZATISH — FAQAT DIREKTOR (6-talab).
 *
 * Tuzatiladigan maydonlar: SUMMA, MIJOZ, BERILGAN SANA, muddat va IZOH —
 * qarz kiritilayotganda xato ketishi mumkin bo'lgan hammasi.
 *
 * MIJOZ ALMASHTIRISH oddiy matn maydoni EMAS: qarz kartochkaga bog'langan
 * bo'lsa (`contactId`) ismni qo'lda o'zgartirish yetmaydi — yozuv baribir
 * eski mijozning kartochkasida qolib ketardi, chunki qarzdorlar aynan
 * kartochka bo'yicha jamlanadi (`qarzdorKalit`). Shuning uchun bu yerda
 * qarz yaratishdagi AYNI `MijozTanlash` ishlatiladi.
 *
 * Sabab MAJBURIY: audit jurnalida "nega o'zgardi" savoli javobsiz
 * qolmasligi kerak (7-talab). Summani to'langan qismdan past qilib
 * bo'lmaydi — server ham shu qoidani tekshiradi
 * (lib/services/qarzTuzatish.ts).
 */
export function QarzTahrirForm({
  debtId,
  jamiSumma,
  tolangan,
  contactId,
  mijozNomi,
  mijozTel,
  sana,
  muddat,
  izoh,
  onCancel,
  onDone,
}: {
  debtId: string;
  jamiSumma: number;
  tolangan: number;
  contactId: string | null;
  mijozNomi: string;
  mijozTel: string | null;
  /** "YYYY-MM-DD" — qarz berilgan sana. */
  sana: string;
  /** "YYYY-MM-DD" yoki bo'sh. */
  muddat: string;
  izoh: string;
  onCancel: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [summa, setSumma] = useState(formatSom(jamiSumma));
  const [mijoz, setMijoz] = useState<MijozTanlov>({
    contactId,
    ism: mijozNomi,
    tel: mijozTel ?? "",
  });
  const [yangiSana, setYangiSana] = useState(sana);
  const [yangiMuddat, setYangiMuddat] = useState(muddat);
  const [yangiIzoh, setYangiIzoh] = useState(izoh);
  const [sabab, setSabab] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const yangiSumma = parseSomInput(summa);
  const past = yangiSumma > 0 && yangiSumma < tolangan;

  async function saqla() {
    if (yangiSumma <= 0) return setXato("Summani kiriting");
    if (past) return setXato(`Summa to'langan qismdan (${formatSom(tolangan)}) past bo'lmasligi kerak`);
    if (!mijoz.ism.trim()) return setXato("Mijozni tanlang yoki ismini kiriting");
    if (!yangiSana) return setXato("Berilgan sanani kiriting");
    if (sabab.trim().length < 3) return setXato("Tuzatish sababini yozing");
    setLoading(true);
    setXato(null);
    try {
      // TELEFON faqat O'ZGARGAN bo'lsa yuboriladi: kalit yuborilmasa server
      // maydonga tegmaydi va tegilmagan raqam saqlanib qoladi.
      const tel = mijoz.tel.trim();
      const telOzgardi = tel !== (mijozTel ?? "");
      const res = await fetch(`/api/debts/${debtId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jamiSumma: yangiSumma,
          contactId: mijoz.contactId,
          mijozNomi: mijoz.ism.trim(),
          ...(telOzgardi ? { mijozTel: tel || null } : {}),
          sana: yangiSana,
          muddat: yangiMuddat || null,
          izoh: yangiIzoh,
          sabab: sabab.trim(),
        }),
      });
      const javob = await res.json();
      if (!res.ok) {
        setXato(javob.error ?? "Saqlab bo'lmadi");
        return;
      }
      await onDone();
    } catch {
      setXato("Tarmoq xatosi — qayta urinib ko'ring");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3 space-y-3">
      <p className="text-sm font-medium text-fg">Qarzni tuzatish</p>

      <div>
        <label className={LABEL_CLASS} htmlFor="qarz-tahrir-summa">Qarz summasi</label>
        <input
          id="qarz-tahrir-summa"
          type="text"
          inputMode="numeric"
          value={summa}
          onChange={(e) => setSumma(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
          className={INPUT_CLASS}
        />
        {tolangan > 0 && (
          <p className={`text-2xs mt-1 ${past ? "text-expense" : "text-faint"}`}>
            To&apos;langan: {formatSom(tolangan)} so&apos;m — summa bundan past bo&apos;lmaydi.
          </p>
        )}
      </div>

      {/* Qarzni boshqa mijozga ko'chirish — kartochka bilan birga. */}
      <MijozTanlash
        qiymat={mijoz}
        onChange={setMijoz}
        disabled={loading}
        qarzPanel={false}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className={LABEL_CLASS} htmlFor="qarz-tahrir-sana">Berilgan sana</label>
          <input
            id="qarz-tahrir-sana"
            type="date"
            value={yangiSana}
            onChange={(e) => setYangiSana(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="qarz-tahrir-muddat">To&apos;lov muddati</label>
          <input
            id="qarz-tahrir-muddat"
            type="date"
            value={yangiMuddat}
            onChange={(e) => setYangiMuddat(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="qarz-tahrir-izoh">Izoh</label>
        <input
          id="qarz-tahrir-izoh"
          type="text"
          value={yangiIzoh}
          onChange={(e) => setYangiIzoh(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="qarz-tahrir-sabab">
          Tuzatish sababi <span className="text-expense">*</span>
        </label>
        <input
          id="qarz-tahrir-sabab"
          type="text"
          value={sabab}
          onChange={(e) => setSabab(e.target.value)}
          placeholder="Masalan: summa xato kiritilgan"
          className={INPUT_CLASS}
        />
        <p className="text-2xs text-faint mt-1">
          Audit tarixida saqlanadi: kim, qachon, eski va yangi qiymat.
        </p>
      </div>

      {tolangan > 0 && (
        <p className="text-2xs text-faint">
          Bu qarzga {formatSom(tolangan)} so&apos;m to&apos;langan — tuzatish
          to&apos;lovlarga tegmaydi, faqat qoldiq qayta hisoblanadi.
        </p>
      )}

      {xato && <p className="text-sm text-expense">{xato}</p>}

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          Bekor
        </Button>
        <Button onClick={saqla} loading={loading} disabled={loading}>
          Saqlash
        </Button>
      </div>
    </div>
  );
}
