"use client";

import { useState } from "react";
import { csvYasa } from "@/lib/csv";
import {
  importYubor,
  csvImportYubor,
  MAKS_FAYL_HAJM,
  type Tekshiruv,
  type Natija,
} from "./importYuborish";
import {
  xlsxniBrauzerdaOqi,
  rasmlarniUstungaQoy,
  type BrauzerOqishNatijasi,
} from "./xlsxBrauzer";
import { rasmlarniYukla, saqlagichHolati } from "./rasmYuklash";

/**
 * IMPORT OQIMI — ImportModal'ning butun holati va qadamlari.
 *
 * Ikki yo'l bor:
 *  - CSV yoki kichik xlsx: fayl serverga boradi (eski yo'l).
 *  - Katta yoki rasmli xlsx: fayl BRAUZERDA ochiladi, qatorlar yengil CSV
 *    bo'lib ketadi, rasmlar esa siqilib alohida yuklanadi va "Rasm" ustuni
 *    sifatida importga qo'shiladi. 180 MB lik fayl ham serverga bormaydi.
 */
export function useImportOqimi(onDone: () => void) {
  const [fayl, setFayl] = useState<File | null>(null);
  const [rejim, setRejim] = useState<"qoshish" | "yangilash">("qoshish");
  const [tekshiruv, setTekshiruv] = useState<Tekshiruv | null>(null);
  const [natija, setNatija] = useState<Natija | null>(null);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  /** Uzoq qadam nomi ("Fayl o'qilmoqda…", "Rasmlar yuklanmoqda (3/120)…"). */
  const [bosqich, setBosqich] = useState<string | null>(null);
  /** Brauzerda o'qilgan xlsx (rasmlari bilan); server yo'lida null. */
  const [klient, setKlient] = useState<BrauzerOqishNatijasi | null>(null);
  const [csvMatn, setCsvMatn] = useState<string | null>(null);
  /** Rasm saqlagich sozlanganmi — rasmli faylda importdan oldin aniqlanadi. */
  const [saqlagichBormi, setSaqlagichBormi] = useState<boolean | null>(null);
  /** Natija oynasida ko'rsatiladigan rasm izohi ("3 ta rasm yuklanmadi"). */
  const [rasmXabar, setRasmXabar] = useState<string | null>(null);

  async function faylTanlandi(f: File) {
    setFayl(f);
    setNatija(null);
    setTekshiruv(null);
    setXato(null);
    setKlient(null);
    setCsvMatn(null);
    setSaqlagichBormi(null);
    setRasmXabar(null);
    setLoading(true);

    if (/\.xlsx$/i.test(f.name)) {
      setBosqich("Fayl o'qilmoqda…");
      try {
        const oqilgan = await xlsxniBrauzerdaOqi(f);
        const csv = csvYasa(oqilgan.satrlar[0] ?? [], oqilgan.satrlar.slice(1));
        setKlient(oqilgan);
        setCsvMatn(csv);
        setBosqich(null);
        if (oqilgan.rasmlar.size > 0) {
          setSaqlagichBormi(await saqlagichHolati());
        }
        const javob = await csvImportYubor<Tekshiruv>(csv, rejim, true);
        if (javob.ok) setTekshiruv(javob.data);
        else setXato(javob.xabar);
      } catch (e) {
        setBosqich(null);
        // Brauzerda ochilmagan KICHIK fayl eski yo'ldan (server) o'tadi —
        // eski brauzer yoki g'ayrioddiy fayl importni to'xtatmasin.
        if (f.size <= MAKS_FAYL_HAJM) {
          const javob = await importYubor<Tekshiruv>(f, rejim, true);
          if (javob.ok) setTekshiruv(javob.data);
          else setXato(javob.xabar);
        } else {
          setXato(
            e instanceof Error && e.message
              ? e.message
              : "Faylni o'qib bo'lmadi — uni bo'lib yuklab ko'ring"
          );
        }
      }
    } else {
      const javob = await importYubor<Tekshiruv>(f, rejim, true);
      if (javob.ok) setTekshiruv(javob.data);
      else setXato(javob.xabar);
    }
    setLoading(false);
  }

  async function tasdiqla() {
    if (!fayl) return;
    setLoading(true);
    setXato(null);
    setRasmXabar(null);

    let csv = csvMatn;
    if (klient && klient.rasmlar.size > 0) {
      if (saqlagichBormi) {
        const jami = klient.rasmlar.size;
        setBosqich(`Rasmlar yuklanmoqda (0/${jami})…`);
        const yuklandi = await rasmlarniYukla([...klient.rasmlar.values()], (t, j) =>
          setBosqich(`Rasmlar yuklanmoqda (${t}/${j})…`)
        );
        setBosqich(null);
        if (yuklandi.saqlagichYoq) {
          setRasmXabar("Rasm saqlagich sozlanmagan — tovarlar rasmsiz yuklandi.");
        } else if (yuklandi.yuklanmadi > 0) {
          setRasmXabar(
            `${yuklandi.yuklanmadi} ta rasm yuklanmadi — ularni keyin tovar kartasidan qo'shish mumkin.`
          );
        }
        if (yuklandi.urllar.size > 0 && csv !== null) {
          const satrlar = rasmlarniUstungaQoy(
            klient.satrlar,
            klient.varaqQatorlari,
            yuklandi.urllar
          );
          csv = csvYasa(satrlar[0], satrlar.slice(1));
        }
      } else {
        setRasmXabar("Rasm saqlagich sozlanmagan — tovarlar rasmsiz yuklandi.");
      }
    }

    const javob =
      csv !== null
        ? await csvImportYubor<Natija>(csv, rejim, false)
        : await importYubor<Natija>(fayl, rejim, false);
    if (javob.ok) {
      setNatija(javob.data);
      onDone();
    } else {
      setXato(javob.xabar);
    }
    setLoading(false);
  }

  return {
    fayl,
    rejim,
    setRejim,
    tekshiruv,
    natija,
    loading,
    xato,
    bosqich,
    rasmSoni: klient?.rasmlar.size ?? 0,
    saqlagichBormi,
    rasmXabar,
    faylTanlandi,
    tasdiqla,
  };
}
