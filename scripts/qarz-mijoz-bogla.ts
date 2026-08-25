/**
 * MAVJUD QARZLARNI MIJOZ KARTOCHKASIGA BOG'LASH.
 *
 * MUAMMO. Ilgari kassa (`services/pos.ts`) va Sotuv oynasi
 * (`services/inventory.ts`) qarzga sotganda mijoz kartochkasi yaratmasdi —
 * `Debt.contactId` bo'sh qolardi. Bunday qarzlar qarzdorlar ro'yxatida faqat
 * ISM MATNI bo'yicha jamlanadi, ya'ni "Ali" va "Ali Valiyev" ikki qarzdor
 * bo'lib ko'rinadi. Yozish yo'li tuzatildi (`services/mijozAniqla.ts`), bu
 * skript esa ESKI yozuvlarni kartochkaga bog'laydi.
 *
 * NIMA QILADI. `contactId = null` bo'lgan har qarz uchun shu biznesdan
 * mos kartochka qidiradi:
 *   1. telefon aynan mos kelsa — o'sha kartochka;
 *   2. telefon mos kelmasa, ISM bo'yicha AYNAN BITTA kartochka topilsa — o'sha.
 * Faqat `Debt.contactId` yoziladi.
 *
 * NIMA QILMAYDI — ATAYLAB:
 *   - hech narsa O'CHIRMAYDI va summalarga tegmaydi;
 *   - YANGI kartochka yaratmaydi (kim kim ekanini skript hal qilmaydi);
 *   - bir xil ismli bir nechta kartochka bo'lsa TAXMIN QILMAYDI — bunday
 *     qarz "ikkilanish" ro'yxatiga tushadi va odam qo'lda hal qiladi;
 *   - mavjud kartochkalarni BIRLASHTIRMAYDI (dublikat kartochkalarni qo'shish
 *     qaytarib bo'lmaydigan amal — u alohida, ko'rib chiqilgan qaror).
 *
 * XAVFSIZLIK. Standart holatda FAQAT HISOBOT chiqaradi, bazaga yozmaydi.
 * Yozish uchun ataylab `--yoz` bayrog'i kerak:
 *
 *   npx ts-node -r tsconfig-paths/register scripts/qarz-mijoz-bogla.ts        (ko'rish)
 *   npx ts-node -r tsconfig-paths/register scripts/qarz-mijoz-bogla.ts --yoz  (yozish)
 *
 * Build zanjiriga ATAYLAB QO'SHILMAGAN: bu bir martalik, ko'rib chiqiladigan
 * amal — har deploy'da o'z-o'zidan ishlashi kerak emas.
 *
 * IDEMPOTENT: faqat `contactId = null` yozuvlar o'qiladi, shuning uchun
 * qayta ishga tushirish xavfsiz.
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { telNormalize } from "@/lib/validation/qarz";

/** Ism solishtirish kaliti — `services/mijozAniqla.ts` bilan AYNI qoida. */
function ismKalit(ism: string): string {
  return ism.trim().toLowerCase().replace(/\s+/g, " ");
}

interface Hisobot {
  boglandi: number;
  ikkilanish: Array<{ debtId: string; ism: string; nechta: number }>;
  topilmadi: number;
}

async function biznesniIshla(businessId: string, yoz: boolean): Promise<Hisobot> {
  const hisobot: Hisobot = { boglandi: 0, ikkilanish: [], topilmadi: 0 };

  const [contacts, debts] = await Promise.all([
    rawPrisma.contact.findMany({
      where: { businessId, deletedAt: null },
      select: { id: true, ism: true, tel: true },
    }),
    rawPrisma.debt.findMany({
      where: { businessId, contactId: null },
      select: { id: true, mijozNomi: true, mijozTel: true },
    }),
  ]);

  if (contacts.length === 0 || debts.length === 0) return hisobot;

  const telBoyicha = new Map<string, string>();
  const ismBoyicha = new Map<string, string[]>();
  for (const c of contacts) {
    const t = telNormalize(c.tel);
    // Bir raqamda ikki kartochka bo'lsa birinchisi qoladi — bu holat
    // kartochkalarni birlashtirishni talab qiladi, skript hal qilmaydi.
    if (t && !telBoyicha.has(t)) telBoyicha.set(t, c.id);
    const k = ismKalit(c.ism);
    ismBoyicha.set(k, [...(ismBoyicha.get(k) ?? []), c.id]);
  }

  for (const d of debts) {
    const tel = telNormalize(d.mijozTel);
    let contactId = tel ? telBoyicha.get(tel) : undefined;

    if (!contactId) {
      const nomzodlar = ismBoyicha.get(ismKalit(d.mijozNomi)) ?? [];
      if (nomzodlar.length === 1) {
        contactId = nomzodlar[0];
      } else if (nomzodlar.length > 1) {
        hisobot.ikkilanish.push({
          debtId: d.id,
          ism: d.mijozNomi,
          nechta: nomzodlar.length,
        });
        continue;
      }
    }

    if (!contactId) {
      hisobot.topilmadi += 1;
      continue;
    }

    if (yoz) {
      // `businessId` sharti QO'LDA — xom klient tenant filtrini qo'ymaydi.
      await rawPrisma.debt.updateMany({
        where: { id: d.id, businessId, contactId: null },
        data: { contactId },
      });
    }
    hisobot.boglandi += 1;
  }

  return hisobot;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL yo'q — o'tkazib yuborildi.");
    return;
  }
  const yoz = process.argv.includes("--yoz");

  const bizneslar = await rawPrisma.business.findMany({ select: { id: true, nomi: true } });
  let jamiBoglandi = 0;
  let jamiTopilmadi = 0;
  const jamiIkkilanish: Array<{ debtId: string; ism: string; nechta: number }> = [];

  for (const b of bizneslar) {
    const h = await biznesniIshla(b.id, yoz);
    if (h.boglandi === 0 && h.topilmadi === 0 && h.ikkilanish.length === 0) continue;
    console.log(
      `${b.nomi}: bog'lanadi ${h.boglandi}, kartochkasi yo'q ${h.topilmadi}, ikkilanish ${h.ikkilanish.length}`
    );
    jamiBoglandi += h.boglandi;
    jamiTopilmadi += h.topilmadi;
    jamiIkkilanish.push(...h.ikkilanish);
  }

  console.log("");
  console.log(yoz ? "YOZILDI" : "KO'RISH REJIMI (bazaga yozilmadi)");
  console.log(`  Kartochkaga bog'landi : ${jamiBoglandi}`);
  console.log(`  Mos kartochka yo'q    : ${jamiTopilmadi}`);
  console.log(`  Ikkilanish (qo'lda)   : ${jamiIkkilanish.length}`);

  if (jamiIkkilanish.length > 0) {
    console.log("");
    console.log("Bir xil ismli bir nechta kartochka — qarz kimga tegishli ekani noaniq:");
    for (const i of jamiIkkilanish.slice(0, 50)) {
      console.log(`  ${i.debtId}  "${i.ism}"  — ${i.nechta} ta kartochka`);
    }
    if (jamiIkkilanish.length > 50) {
      console.log(`  ... yana ${jamiIkkilanish.length - 50} ta`);
    }
  }

  if (!yoz && jamiBoglandi > 0) {
    console.log("");
    console.log("Yozish uchun: qo'shimcha `--yoz` bayrog'i bilan qayta ishga tushiring.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => rawPrisma.$disconnect());
