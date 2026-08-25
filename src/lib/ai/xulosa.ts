import { davrniHal } from "./davr";
import {
  crmYakuni,
  davrYakuni,
  kassaYakuni,
  kategoriyaKesimi,
  qarzYakuni,
  vazifaYakuni,
  type Havola,
} from "./analitika";
import { sohaOchiq, type AiRuxsat } from "./ruxsat";

/**
 * "BUGUNGI XULOSA" — AI'SIZ, DETERMINISTIK.
 *
 * Bosh ekrandagi 2-4 ta muhim kuzatuv har safar model chaqirib olinmaydi:
 * bu sof agregat va uni serverda hisoblash ham tez, ham tekin, ham
 * xatosiz. Model faqat foydalanuvchi SAVOL bergandagina ishlaydi.
 *
 * Har kuzatuv faqat foydalanuvchiga OCHIQ sohadan olinadi (`AiRuxsat`).
 */

export interface Kuzatuv {
  /** Qisqa yorliq: "Bugungi kirim". */
  yorliq: string;
  /** Tayyor qiymat matni: "4,8 mln so'm". */
  qiymat: string;
  /** Ogohlantirish ohangida ko'rsatilsinmi (muddati o'tgan qarz kabi). */
  ogoh?: boolean;
  havola?: Havola;
}

export interface BugungiXulosa {
  sana: string;
  kuzatuvlar: Kuzatuv[];
}

/** Bugungi kesim — sahifa ochilganda va `bugungi_holat` tool'ida ishlatiladi. */
export async function bugungiXulosa(ruxsat: AiRuxsat): Promise<BugungiXulosa> {
  const bugun = davrniHal("bugun");
  const kuzatuvlar: Kuzatuv[] = [];

  if (sohaOchiq(ruxsat, "moliya")) {
    const yakun = await davrYakuni(ruxsat.businessId, bugun);
    kuzatuvlar.push({
      yorliq: "Bugungi kirim",
      qiymat: yakun.kirimMatn,
      havola: { yorliq: "Yozuvlar", href: `/app/tranzaksiyalar?from=${bugun.fromStr}&to=${bugun.toStr}&turi=kirim` },
    });
    kuzatuvlar.push({
      yorliq: "Bugungi chiqim",
      qiymat: yakun.chiqimMatn,
      havola: { yorliq: "Yozuvlar", href: `/app/tranzaksiyalar?from=${bugun.fromStr}&to=${bugun.toStr}&turi=chiqim` },
    });

    if (sohaOchiq(ruxsat, "hisobot") && yakun.chiqim > 0) {
      const chiqimlar = await kategoriyaKesimi(ruxsat.businessId, bugun, "chiqim", 1);
      const eng = chiqimlar.kategoriyalar[0];
      if (eng) {
        kuzatuvlar.push({
          yorliq: "Bugungi eng katta chiqim",
          qiymat: `${eng.kategoriya} — ${eng.summaMatn}`,
          havola: { yorliq: "Ko'rish", href: eng.havola },
        });
      }
    }
  }

  if (sohaOchiq(ruxsat, "qarz")) {
    const qarz = await qarzYakuni(ruxsat.businessId, 1);
    if (qarz.muddatiOtganSoni > 0) {
      kuzatuvlar.push({
        yorliq: "Muddati o'tgan qarz",
        qiymat: `${qarz.muddatiOtganSoni} ta · ${qarz.muddatiOtganJami}`,
        ogoh: true,
        havola: { yorliq: "Qarzdorlar", href: "/app/qarzlar?turi=olinadigan" },
      });
    }
  }

  if (sohaOchiq(ruxsat, "kassa")) {
    const kassa = await kassaYakuni(ruxsat.businessId);
    kuzatuvlar.push({
      yorliq: "Kassalarda jami",
      qiymat: kassa.jamiMatn,
      havola: { yorliq: "Kassalar", href: "/app/kassa" },
    });
  }

  if (sohaOchiq(ruxsat, "crm")) {
    const crm = await crmYakuni(ruxsat.businessId, bugun);
    if (crm.bugungiBuyurtmalar > 0) {
      kuzatuvlar.push({
        yorliq: "Bugungi buyurtmalar",
        qiymat: `${crm.bugungiBuyurtmalar} ta`,
        havola: { yorliq: "CRM", href: "/app/crm" },
      });
    }
  }

  if (sohaOchiq(ruxsat, "vazifalar")) {
    const v = await vazifaYakuni(ruxsat.businessId);
    if (v.muddatiOtgan > 0 || v.bugungaBelgilangan > 0) {
      kuzatuvlar.push({
        yorliq: v.muddatiOtgan > 0 ? "Muddati o'tgan vazifa" : "Bugungi vazifalar",
        qiymat: `${v.muddatiOtgan > 0 ? v.muddatiOtgan : v.bugungaBelgilangan} ta`,
        ogoh: v.muddatiOtgan > 0,
        havola: { yorliq: "Vazifalar", href: "/app/vazifalar" },
      });
    }
  }

  // Ekranni to'ldirib yubormaslik uchun eng muhim 5 tasi.
  return { sana: bugun.fromStr, kuzatuvlar: kuzatuvlar.slice(0, 5) };
}
