"use client";

import Link from "next/link";
import { modulQisqaNomi } from "@/lib/modules/biznesModullari";
import type { BiznesTafsilot } from "@/lib/services/biznesTafsilot";
import { Almashtirgich, SozlamaQator } from "./SozlamaQator";
import { useBiznesSaqlash } from "./foydalanish";

/**
 * MODULLAR — ikki qavat ochiq ko'rsatiladi.
 *
 * 1) "Shu biznes uchun" — `Business.omborli` va `Business.magazin` bayroqlari.
 *    Ular AYNAN shu biznesga tegishli va bu yerdan boshqariladi.
 * 2) "Kompaniya bo'ylab" — `TenantModule` (CRM, Xarid, HR...). Ular BARCHA
 *    bizneslarga birdaniga ta'sir qiladi, shuning uchun bu yerda faqat holati
 *    ko'rsatiladi va o'zgartirish o'z sahifasiga yo'naltiriladi. Yangi,
 *    takrorlovchi modul tizimi YARATILMAYDI.
 */
export function ModullarBolim({
  biznes,
  rol,
  yoqilganModullar,
  tarifModullari,
}: {
  biznes: BiznesTafsilot;
  rol: string;
  yoqilganModullar: string[];
  tarifModullari: string[];
}) {
  const { saqla, band } = useBiznesSaqlash(biznes.id);
  const yoqilgan = new Set(yoqilganModullar);
  const tarif = new Set(tarifModullari);

  const omborModuli = yoqilgan.has("OMBOR");
  const magazinModuli = yoqilgan.has("MAGAZIN");

  const kompaniya = yoqilganModullar
    .filter((c) => !["MOLIYA", "OMBOR", "MAGAZIN", "BOSHQARUV"].includes(c))
    .map(modulQisqaNomi);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-fg">Shu biznes uchun</h3>
        <p className="text-xs text-muted mt-1">
          Bu ikki bo&apos;lim har bizneste alohida yoqiladi — bir kompaniyada do&apos;kon ham,
          xizmat ko&apos;rsatadigan biznes ham bo&apos;lishi mumkin.
        </p>
        <div className="mt-2">
          <SozlamaQator
            nomi="Ombor va sotuv"
            tavsif="Mahsulot qoldig'i, ombor kirimi va sotuv shu bizneste yuritiladi."
            belgi={!tarif.has("OMBOR") ? { matn: "yuqori tarifda", tur: "brand" } : undefined}
            ogohlantirish={
              biznes.omborli && !omborModuli
                ? "Bayroq yoqilgan, lekin \"Ombor va sotuv\" moduli kompaniya bo'ylab o'chiq — menyuda bo'lim ko'rinmaydi."
                : undefined
            }
            ong={
              <Almashtirgich
                yoqilgan={biznes.omborli}
                disabled={band || !tarif.has("OMBOR")}
                label="Ombor va sotuv"
                onClick={() =>
                  void saqla(
                    { omborli: !biznes.omborli },
                    biznes.omborli ? "Ombor o'chirildi" : "Ombor yoqildi"
                  )
                }
              />
            }
          />
          <SozlamaQator
            nomi="Kassa (POS)"
            tavsif="Shtrix-kod bilan savat yig'ish, chek va qaytarish. Ombor ustida ishlaydi."
            belgi={!tarif.has("MAGAZIN") ? { matn: "yuqori tarifda", tur: "brand" } : undefined}
            ogohlantirish={
              !biznes.omborli
                ? "Kassa ombor ustida ishlaydi — avval shu bizneste omborni yoqing."
                : biznes.magazin && !magazinModuli
                  ? "Bayroq yoqilgan, lekin \"Magazin\" moduli kompaniya bo'ylab o'chiq — menyuda \"Kassa (POS)\" ko'rinmaydi."
                  : undefined
            }
            ong={
              <Almashtirgich
                yoqilgan={biznes.magazin}
                disabled={band || !biznes.omborli || !tarif.has("MAGAZIN")}
                label="Kassa (POS)"
                onClick={() =>
                  void saqla(
                    { magazin: !biznes.magazin },
                    biznes.magazin ? "Kassa bo'limi yopildi" : "Kassa bo'limi yoqildi"
                  )
                }
              />
            }
          />
        </div>
        <p className="text-xs text-faint mt-2">
          O&apos;chirilganda ma&apos;lumot o&apos;chmaydi: mahsulot, sotuv va cheklar joyida
          qoladi — qayta yoqsangiz hammasi o&apos;rnida bo&apos;ladi.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-fg">Kompaniya bo&apos;ylab</h3>
        <p className="text-xs text-muted mt-1">
          Bu modullar barcha bizneslarga birdan ta&apos;sir qiladi, shuning uchun ular
          {rol === "OWNER" ? " o'z sahifasidan" : " direktor tomonidan"} boshqariladi.
        </p>
        <p className="text-sm text-fg mt-2">
          {kompaniya.length > 0 ? kompaniya.join(" · ") : "Qo'shimcha modul yoqilmagan"}
        </p>
        {rol === "OWNER" && (
          <Link
            href="/app/sozlamalar/modullar"
            className="inline-flex items-center min-h-[44px] mt-1 text-sm text-brand hover:underline"
          >
            Modullarni boshqarish →
          </Link>
        )}
      </section>
    </div>
  );
}
