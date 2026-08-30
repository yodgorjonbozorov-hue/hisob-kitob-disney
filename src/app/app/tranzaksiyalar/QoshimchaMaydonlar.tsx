"use client";

import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import type { XodimOption } from "./turlar";

/**
 * KIRIM/CHIQIM formasining pastki maydonlari: sana, kassa, sotuvchi va izoh.
 * TransactionForm 250 satr chegarasidan oshmasligi uchun alohida faylda.
 *
 * SOTUVCHI / XODIM (faqat kirimda): savdo kimning hisobiga yozilishi.
 * Standart — joriy foydalanuvchining o'zi. Tanlov faqat boshqaruvchiga
 * ko'rsatiladi (`sotuvchiTanlash`): oddiy sotuvchida maydon chiqmaydi,
 * savdo avtomatik o'zining hisobiga tushadi — server ham shuni majburlaydi
 * (lib/services/sotuvchi.ts), bu faqat qulaylik.
 */
export function QoshimchaMaydonlar({
  sana,
  onSana,
  accounts,
  accountId,
  onAccount,
  izoh,
  onIzoh,
  loading,
  kirim,
  sotuvchilar = [],
  sotuvchiId,
  onSotuvchi,
  sotuvchiTanlash = false,
}: {
  sana: string;
  onSana: (v: string) => void;
  accounts: { id: string; nomi: string }[];
  accountId: string;
  onAccount: (v: string) => void;
  izoh: string;
  onIzoh: (v: string) => void;
  loading: boolean;
  kirim: boolean;
  sotuvchilar?: XodimOption[];
  sotuvchiId: string;
  onSotuvchi: (v: string) => void;
  sotuvchiTanlash?: boolean;
}) {
  const sotuvchiKorinadi = kirim && sotuvchiTanlash && sotuvchilar.length > 1;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className={LABEL_CLASS} htmlFor="tx-sana">
          Sana
        </label>
        <input
          id="tx-sana"
          type="date"
          value={sana}
          disabled={loading}
          onChange={(e) => onSana(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      {accounts.length > 1 && (
        <div>
          <label className={LABEL_CLASS} htmlFor="tx-kassa">
            Kassa
          </label>
          <select
            id="tx-kassa"
            value={accountId}
            disabled={loading}
            onChange={(e) => onAccount(e.target.value)}
            className={INPUT_CLASS}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nomi}
              </option>
            ))}
          </select>
        </div>
      )}
      {sotuvchiKorinadi && (
        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="tx-sotuvchi">
            Sotuvchi / Xodim
          </label>
          <select
            id="tx-sotuvchi"
            value={sotuvchiId}
            disabled={loading}
            onChange={(e) => onSotuvchi(e.target.value)}
            className={INPUT_CLASS}
          >
            {sotuvchilar.map((x) => (
              <option key={x.id} value={x.id}>
                {x.ism}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <label className={LABEL_CLASS} htmlFor="tx-izoh">
          Izoh (ixtiyoriy)
        </label>
        <input
          id="tx-izoh"
          type="text"
          value={izoh}
          disabled={loading}
          onChange={(e) => onIzoh(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  );
}
