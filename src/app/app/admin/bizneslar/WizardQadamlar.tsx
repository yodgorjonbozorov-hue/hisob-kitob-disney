"use client";

import { FAOLIYATLAR } from "@/lib/biznesFaoliyati";
import { cn } from "@/lib/cn";

export interface ModulTanlov {
  code: string;
  nomi: string;
  tavsif: string;
  /** Yoqib bo'lmaydi (core yoki tarifda yo'q). */
  qulf: "core" | "tarif" | null;
}

const maydon =
  "w-full h-11 px-3 rounded-xl bg-surface border border-line text-sm text-fg placeholder:text-faint focus:outline-none focus:border-brand";

/** 1-qadam: nomi va faoliyat turi. */
export function QadamBiznes({
  nomi,
  faoliyat,
  onNomi,
  onFaoliyat,
}: {
  nomi: string;
  faoliyat: string;
  onNomi: (v: string) => void;
  onFaoliyat: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-fg mb-1.5" htmlFor="wiz-nomi">
          Biznes nomi
        </label>
        <input
          id="wiz-nomi"
          value={nomi}
          onChange={(e) => onNomi(e.target.value)}
          placeholder="Masalan: Disney Navoiy"
          className={maydon}
          autoFocus
        />
      </div>
      <div>
        <span className="block text-sm font-medium text-fg mb-2">Faoliyat turi</span>
        <div className="space-y-2">
          {FAOLIYATLAR.map((f) => (
            <label
              key={f.code}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition",
                faoliyat === f.code ? "border-brand bg-brand-wash" : "border-line hover:border-muted"
              )}
            >
              <input
                type="radio"
                name="wiz-faoliyat"
                value={f.code}
                checked={faoliyat === f.code}
                onChange={() => onFaoliyat(f.code)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">{f.nomi}</span>
                <span className="block text-xs text-faint mt-0.5">{f.tavsif}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 2-qadam: modullar (mavjud registry va tarifdan — yangi tizim emas). */
export function QadamModullar({
  modullar,
  tanlangan,
  onToggle,
}: {
  modullar: ModulTanlov[];
  tanlangan: Set<string>;
  onToggle: (code: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Kerakli bo&apos;limlarni tanlang. Keyin ham Bizneslar → Modullar bo&apos;limidan
        o&apos;zgartirasiz.
      </p>
      {modullar.map((m) => {
        const belgili = m.qulf === "core" || tanlangan.has(m.code);
        const ochiq = m.qulf === null;
        return (
          <label
            key={m.code}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3 transition",
              ochiq ? "cursor-pointer border-line hover:border-muted" : "border-line opacity-70",
              belgili && ochiq && "border-brand bg-brand-wash"
            )}
          >
            <input
              type="checkbox"
              checked={belgili}
              disabled={!ochiq}
              onChange={() => onToggle(m.code)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-fg">{m.nomi}</span>
                {m.qulf === "core" && (
                  <span className="text-2xs px-2 py-0.5 rounded-full bg-surface-2 text-muted">
                    doim yoqiq
                  </span>
                )}
                {m.qulf === "tarif" && (
                  <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-wash text-brand">
                    yuqori tarifda
                  </span>
                )}
              </span>
              <span className="block text-xs text-faint mt-0.5">{m.tavsif}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** 3-qadam: boshlang'ich kassa nomi (kassa MAJBURIY — faqat nomi so'raladi). */
export function QadamKassa({ kassaNomi, onKassa }: { kassaNomi: string; onKassa: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Har biznesda kamida bitta kassa bo&apos;lishi shart — yozuv qayerga tushishini shu
        belgilaydi. Nomini o&apos;zingizga qulay qilib qo&apos;ying.
      </p>
      <div>
        <label className="block text-sm font-medium text-fg mb-1.5" htmlFor="wiz-kassa">
          Boshlang&apos;ich kassa nomi
        </label>
        <input
          id="wiz-kassa"
          value={kassaNomi}
          onChange={(e) => onKassa(e.target.value)}
          placeholder="Naqd kassa"
          className={maydon}
        />
      </div>
      <p className="text-xs text-faint">Keyin Kassalar bo&apos;limidan yana kassa qo&apos;shasiz.</p>
    </div>
  );
}

/** 4-qadam: xodimlar — ixtiyoriy, mavjud biriktirish oqimiga yo'naltiradi. */
export function QadamXodimlar() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Xodimlar biznes yaratilgandan keyin biriktiriladi — mavjud
        &quot;Foydalanuvchilar&quot; bo&apos;limida har xodimga qaysi bizneslarda ishlashi
        belgilanadi.
      </p>
      <p className="text-xs text-faint">
        Bu qadamni o&apos;tkazib yuborsangiz ham biznes to&apos;liq ishlaydi: direktor va
        administrator barcha bizneslarni ko&apos;radi.
      </p>
    </div>
  );
}
