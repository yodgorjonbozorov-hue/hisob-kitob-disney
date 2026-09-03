import { prisma } from "@/lib/prisma";
import { monthRangeUTC } from "@/lib/date";

/**
 * IJROCHI QATNASHUVI — oylik uchun HAQIQAT MANBAI.
 *
 * Sotuvchi oyligi pul yozuvidan (`Transaction`) keladi, ijrochiniki esa
 * QATNASHUVDAN: xodim oy ichida nechta zakazga chiqqan. Manba —
 * `DealEmployee`, ya'ni sotuvchi biriktiruvi bilan AYNI jadval; alohida
 * hisoblagich saqlanmaydi, zakaz tahrirlansa raqam o'z-o'zidan to'g'rilanadi.
 *
 * XODIM KALITI — `Employee.id`, `User.id` EMAS. Bu ataylab: Disney
 * Navoiydagi videochi, shofyor va bezakchilarning tizim hisobi yo'q va
 * hech qachon bo'lmasligi ham mumkin. Oylik hisobi tizim hisobiga
 * bog'lanib qolsa ular abadiy nolda qolardi.
 *
 * FAQAT TASDIQLANGAN biriktiruv sanaladi (`tasdiqlangan = true`).
 * Mashina taxmin qilib qo'ygan (masalan eski migratsiya) biriktiruv
 * odam tasdiqlamaguncha pulga aylanmaydi.
 *
 * DAVR — zakaz sanasi (`Deal.sana`), u bo'lmasa `Deal.createdAt`; sotuvchi
 * KPI'si bilan bir xil qoida (`lib/queries/xodimJamoaKpi.ts`).
 */

export interface QatnashuvJami {
  /** Davrdagi tasdiqlangan qatnashuvlar (zakazga chiqdi). */
  jami: number;
  bajarildi: number;
  bekor: number;
  /** Lavozim haqi × qatnashuv — shu lavozimdagi hisoblangan summa (so'm). */
  summa: number;
  ortachaBaho: number | null;
}

export interface XodimQatnashuvi {
  jami: number;
  bajarildi: number;
  bekor: number;
  /** Barcha lavozimlar bo'yicha jami haq (so'm). */
  summa: number;
  ortachaBaho: number | null;
  /** Lavozim kesimi — oylik kartochkasida qatorlab ko'rsatish uchun. */
  lavozimlar: (QatnashuvJami & { categoryId: string; nomi: string; zakazHaqi: number })[];
}

interface Yigindi {
  jami: number;
  bajarildi: number;
  bekor: number;
  bahoYigindi: number;
  bahoSoni: number;
}

const yangi = (): Yigindi => ({ jami: 0, bajarildi: 0, bekor: 0, bahoYigindi: 0, bahoSoni: 0 });

const ortacha = (yigindi: number, soni: number): number | null =>
  soni > 0 ? Math.round((yigindi / soni) * 10) / 10 : null;

/**
 * Oy bo'yicha BARCHA xodimlarning qatnashuvi (kalit: `Employee.id`).
 * Bitta so'rov — xodim boshiga alohida so'rov YO'Q.
 */
export async function qatnashuvJamlari(
  businessId: string,
  oy: string
): Promise<Map<string, XodimQatnashuvi>> {
  const { from, to } = monthRangeUTC(oy);

  const qatorlar = await prisma.dealEmployee.findMany({
    where: {
      businessId,
      tasdiqlangan: true,
      // Sotuvchi turidagi lavozim BU YERDA sanalmaydi: sotuvchi oyligi
      // pul yozuvidan hisoblanadi, ikki marta to'lanib ketmasin.
      category: { turi: { not: "sotuvchi" } },
      deal: {
        deletedAt: null,
        OR: [{ sana: { gte: from, lt: to } }, { sana: null, createdAt: { gte: from, lt: to } }],
      },
    },
    select: {
      employeeId: true,
      baho: true,
      category: { select: { id: true, nomi: true, zakazHaqi: true } },
      deal: { select: { holat: true } },
    },
  });

  const jamlar = new Map<string, Map<string, Yigindi>>();
  const kategoriyalar = new Map<string, { nomi: string; zakazHaqi: number }>();

  for (const q of qatorlar) {
    kategoriyalar.set(q.category.id, { nomi: q.category.nomi, zakazHaqi: q.category.zakazHaqi });
    let boyicha = jamlar.get(q.employeeId);
    if (!boyicha) {
      boyicha = new Map();
      jamlar.set(q.employeeId, boyicha);
    }
    const y = boyicha.get(q.category.id) ?? yangi();
    y.jami += 1;
    if (q.deal.holat === "YUTILDI") y.bajarildi += 1;
    else if (q.deal.holat === "YOQOTILDI") y.bekor += 1;
    if (q.baho !== null) {
      y.bahoYigindi += q.baho;
      y.bahoSoni += 1;
    }
    boyicha.set(q.category.id, y);
  }

  const natija = new Map<string, XodimQatnashuvi>();
  for (const [employeeId, boyicha] of jamlar) {
    const lavozimlar: XodimQatnashuvi["lavozimlar"] = [];
    let jami = 0;
    let bajarildi = 0;
    let bekor = 0;
    let summa = 0;
    let bahoYigindi = 0;
    let bahoSoni = 0;

    for (const [categoryId, y] of boyicha) {
      const kat = kategoriyalar.get(categoryId)!;
      const lavozimSumma = kat.zakazHaqi * y.jami;
      lavozimlar.push({
        categoryId,
        nomi: kat.nomi,
        zakazHaqi: kat.zakazHaqi,
        jami: y.jami,
        bajarildi: y.bajarildi,
        bekor: y.bekor,
        summa: lavozimSumma,
        ortachaBaho: ortacha(y.bahoYigindi, y.bahoSoni),
      });
      jami += y.jami;
      bajarildi += y.bajarildi;
      bekor += y.bekor;
      summa += lavozimSumma;
      bahoYigindi += y.bahoYigindi;
      bahoSoni += y.bahoSoni;
    }

    lavozimlar.sort((a, b) => b.jami - a.jami || a.nomi.localeCompare(b.nomi));
    natija.set(employeeId, { jami, bajarildi, bekor, summa, ortachaBaho: ortacha(bahoYigindi, bahoSoni), lavozimlar });
  }
  return natija;
}
