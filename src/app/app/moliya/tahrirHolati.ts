import { utcDateToDateOnlyString } from "@/lib/date";
import { sabablar } from "@/lib/moliya/sabablar";
import type { KategoriyaOption, PulFormasi, PulHarakatiDTO } from "./turlar";

/**
 * MAVJUD AMALNI FORMAGA O'TKAZISH (tuzatish oqimi).
 *
 * Sabab ikki xil bo'lishi mumkin: tayyor ro'yxatdan (kod bilan) yoki
 * direktor qo'shgan kategoriya. Yozuvda faqat kategoriya IDsi turadi,
 * shuning uchun mos tayyor sabab NOMI bo'yicha topiladi — topilmasa
 * kategoriya sifatida qo'yiladi.
 */
export function pulFormasiga(
  amal: PulHarakatiDTO,
  kategoriyalar: KategoriyaOption[]
): PulFormasi {
  const yonalish = amal.yonalish === "chiqim" ? "chiqim" : "kirim";
  const tayyor = sabablar(yonalish).find(
    (s) => s.nomi.toLowerCase() === amal.sabab.toLowerCase()
  );
  const kategoriya = kategoriyalar.find((k) => k.id === amal.categoryId);

  return {
    yonalish,
    shaxs: {
      turi: amal.shaxsTuri ?? (yonalish === "kirim" ? "mijoz" : "taminotchi"),
      id: amal.shaxsId,
      ism: amal.shaxsIsm ?? "",
    },
    sababKod: tayyor?.kod ?? "",
    categoryId: tayyor ? "" : kategoriya?.id ?? amal.categoryId,
    summa: String(amal.summa),
    usul: amal.usul,
    accountId: amal.kassaId ?? "",
    sana: utcDateToDateOnlyString(new Date(amal.sana)),
    izoh: amal.izoh ?? "",
  };
}
