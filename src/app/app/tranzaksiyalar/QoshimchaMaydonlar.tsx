"use client";

import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { Select } from "@/components/ui/Select";
import { kassaTavsifi } from "./turlar";
import type { AccountOption, XodimOption } from "./turlar";

/**
 * KIRIM/CHIQIM formasining pastki maydonlari: sana, kassa, sotuvchi va izoh.
 * TransactionForm 250 satr chegarasidan oshmasligi uchun alohida faylda.
 *
 * KASSA endi HAR DOIM ko'rinadi (audit K-1) — ilgari u faqat 2+ kassali
 * biznesda chiqardi va bo'sh qolsa server jimgina shaxsiy kassaga yozardi.
 * Maydon majburiy: qaysi yashikka pul tushgani yozuvning o'zi kabi muhim.
 * Kassa QOLDIG'I bu yerda KO'RSATILMAYDI — u "kassa.jami" huquqiga bog'liq
 * maxfiy ma'lumot (tests/kassa-maxfiylik.test.ts); o'rniga kassa turi va
 * shaxsiy kassa egasi ko'rsatiladi.
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
  kassaKerak = true,
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
  accounts: AccountOption[];
  accountId: string;
  onAccount: (v: string) => void;
  /** Qarz yozuvida pul kassaga tushmaydi — maydon umuman ko'rsatilmaydi. */
  kassaKerak?: boolean;
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
      {/* Faol kassa umuman bo'lmasa — forma nima uchun bloklanganini aytadi
          (amalda bu holat kam: oxirgi faol kassani o'chirib bo'lmaydi). */}
      {kassaKerak && accounts.length === 0 && (
        <div>
          <span className={LABEL_CLASS}>Kassa</span>
          <p className="text-2xs text-expense-fg">
            Faol kassa yo&apos;q. Yozuv qaysi kassaga tushishini ko&apos;rsatib
            bo&apos;lmaydi — avval &laquo;Kassalar&raquo; bo&apos;limida kassa oching.
          </p>
        </div>
      )}
      {kassaKerak && accounts.length > 0 && (
        <div>
          <label className={LABEL_CLASS} htmlFor="tx-kassa">
            Kassa <span className="text-expense">*</span>
          </label>
          <Select
            id="tx-kassa"
            value={accountId}
            disabled={loading}
            onChange={onAccount}
            searchable={accounts.length > 7}
            options={accounts.map((a) => ({
              value: a.id,
              label: a.nomi,
              tavsif: kassaTavsifi(a),
            }))}
          />
          {!accountId && (
            <p className="mt-1 text-2xs text-expense-fg">
              Pul qaysi kassaga tushdi — tanlang.
            </p>
          )}
        </div>
      )}
      {sotuvchiKorinadi && (
        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="tx-sotuvchi">
            Sotuvchi / Xodim
          </label>
          <Select
            id="tx-sotuvchi"
            value={sotuvchiId}
            disabled={loading}
            onChange={onSotuvchi}
            searchable={sotuvchilar.length > 7}
            options={sotuvchilar.map((x) => ({ value: x.id, label: x.ism }))}
          />
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
