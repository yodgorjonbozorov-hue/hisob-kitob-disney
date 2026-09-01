/**
 * KPI HISOB YADROSI TESTLARI — sof funksiyalar, bazasiz.
 *
 * Qamrov: progressiv sotuv bonusi (kelishilgan 9 ta nazorat nuqtasi va
 * interval CHEGARALARI), ball → to'lov foizi jadvalining har bir chegarasi,
 * plan bonusi chegarasi, ballning vazifa haqiga ta'siri va — eng muhimi —
 * ball SOTUV BONUSIGA TA'SIR QILMASLIGI.
 *
 * Ishga tushirish: npm run test:kpi-hisob
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ballChegarasi,
  ballFoizi,
  ballHolati,
  foizdan,
  jamiOylik,
  planBonusi,
  planFoizi,
  progressivSotuvBonusi,
  vazifaHaqi,
} from "@/lib/kpi/hisob";
import { STANDART_BALL_QOIDALARI, STANDART_INTERVALLAR } from "@/lib/kpi/sozlama";

const mln = (n: number) => n * 1_000_000;
const bonus = (sotuv: number) => progressivSotuvBonusi(sotuv, STANDART_INTERVALLAR).jami;
const foiz = (ball: number) => ballFoizi(ball, STANDART_BALL_QOIDALARI);

// ---------- Progressiv sotuv bonusi ----------

test("sotuv bonusi: kelishilgan nazorat nuqtalari", () => {
  // Har interval O'Z foizi bilan hisoblanadi — umumiy summaga bitta foiz EMAS.
  assert.equal(bonus(0), 0);
  assert.equal(bonus(mln(40)), 800_000);
  assert.equal(bonus(mln(60)), 1_400_000);
  assert.equal(bonus(mln(80)), 2_000_000);
  assert.equal(bonus(mln(100)), 2_800_000);
  assert.equal(bonus(mln(120)), 3_600_000);
  assert.equal(bonus(mln(150)), 5_100_000);
  assert.equal(bonus(mln(180)), 6_600_000);
  assert.equal(bonus(mln(200)), 7_600_000);
});

test("sotuv bonusi: butun summaga bitta foiz QO'LLANMAYDI", () => {
  // 150 mln × 5% = 7 500 000 bo'lardi — bu XATO natija.
  assert.notEqual(bonus(mln(150)), 7_500_000);
  assert.equal(bonus(mln(150)), 5_100_000);
});

test("sotuv bonusi: interval chegaralarida uzilish yo'q", () => {
  // Chegaradan bir so'm oldin va keyin farq faqat o'sha bir so'mning foizi.
  assert.equal(bonus(mln(40) - 1), 800_000 - foizdan(1, 200));
  assert.equal(bonus(mln(40) + 1), 800_000 + foizdan(1, 300));
  assert.equal(bonus(mln(120) + 1), 3_600_000 + foizdan(1, 500));
});

test("sotuv bonusi: manfiy va nol sotuvda 0", () => {
  assert.equal(bonus(0), 0);
  assert.equal(bonus(-1_000), 0);
});

test("sotuv bonusi: breakdown qatorlari jamiga teng va oxirgi interval ochiq", () => {
  const n = progressivSotuvBonusi(mln(150), STANDART_INTERVALLAR);
  assert.equal(n.qatorlar.length, 4);
  assert.deepEqual(
    n.qatorlar.map((q) => q.summa),
    [mln(40), mln(40), mln(40), mln(30)]
  );
  assert.deepEqual(
    n.qatorlar.map((q) => q.bonus),
    [800_000, 1_200_000, 1_600_000, 1_500_000]
  );
  assert.equal(
    n.qatorlar.reduce((s, q) => s + q.bonus, 0),
    n.jami,
    "qatorlar yig'indisi jami bilan bir xil bo'lishi shart"
  );
  assert.equal(n.qatorlar[3].gacha, null, "oxirgi interval yuqori chegarasiz");
});

test("sotuv bonusi: intervalsiz sozlamada bonus 0 (fail-closed)", () => {
  assert.equal(progressivSotuvBonusi(mln(150), []).jami, 0);
});

// ---------- Ball → to'lov foizi ----------

test("ball foizi: har bir chegara aniq", () => {
  assert.equal(foiz(100), 11_000, "100 ball → 110%");
  assert.equal(foiz(99), 10_000);
  assert.equal(foiz(85), 10_000);
  assert.equal(foiz(84), 8_500);
  assert.equal(foiz(70), 8_500);
  assert.equal(foiz(69), 7_000);
  assert.equal(foiz(55), 7_000);
  assert.equal(foiz(54), 5_000);
  assert.equal(foiz(40), 5_000);
  assert.equal(foiz(39), 0);
  assert.equal(foiz(0), 0);
});

test("vazifa haqi: ball foizidan chiqadi", () => {
  assert.equal(vazifaHaqi(1_000_000, foiz(100)), 1_100_000, "100 ball → 110%");
  assert.equal(vazifaHaqi(1_000_000, foiz(73)), 850_000, "73 ball → 85%");
  assert.equal(vazifaHaqi(1_000_000, foiz(90)), 1_000_000);
  assert.equal(vazifaHaqi(500_000, foiz(60)), 350_000, "70% dan 500k");
  assert.equal(vazifaHaqi(1_000_000, foiz(20)), 0, "40 balldan past — haq yo'q");
});

test("ball chegarasi: [0, boshlang'ich] oralig'ida qoladi", () => {
  assert.equal(ballChegarasi(97, 100), 97);
  assert.equal(ballChegarasi(-13, 100), 0, "manfiy xom yig'indi 0 ga tushadi");
  assert.equal(ballChegarasi(140, 100), 100, "boshlang'ichdan oshmaydi");
});

test("ball holati: kartochka belgisi chegaralari", () => {
  assert.equal(ballHolati(91), "yaxshi");
  assert.equal(ballHolati(85), "yaxshi");
  assert.equal(ballHolati(84), "ogohlantirish");
  assert.equal(ballHolati(70), "ogohlantirish");
  assert.equal(ballHolati(69), "risk");
  assert.equal(ballHolati(55), "risk");
  assert.equal(ballHolati(54), "kritik");
});

// ---------- Plan bonusi ----------

test("plan bonusi: chegara aniq — 99 mln bonus bermaydi, 100 mln beradi", () => {
  assert.equal(planBonusi(mln(99), mln(100), 1_000_000), 0);
  assert.equal(planBonusi(mln(100), mln(100), 1_000_000), 1_000_000);
  assert.equal(planBonusi(mln(150), mln(100), 1_000_000), 1_000_000, "oshirib bajarish ham bitta bonus");
  assert.equal(planBonusi(mln(150), 0, 1_000_000), 0, "plan qo'yilmagan — bonus yo'q");
});

test("plan foizi: 100 dan oshishi mumkin, plansizda 0", () => {
  assert.equal(planFoizi(mln(97.5), mln(100)), 98);
  assert.equal(planFoizi(mln(112), mln(100)), 112);
  assert.equal(planFoizi(mln(50), 0), 0);
});

// ---------- Jami oylik va ballning ta'sir doirasi ----------

test("jami oylik = vazifa haqi + sotuv bonusi + plan bonusi (+ tuzatish)", () => {
  assert.equal(
    jamiOylik({ vazifaHaqi: 4_250_000, sotuvBonusi: 2_700_000, planBonusi: 0 }),
    6_950_000
  );
  assert.equal(
    jamiOylik({ vazifaHaqi: 4_250_000, sotuvBonusi: 2_700_000, planBonusi: 0, tuzatish: -250_000 }),
    6_700_000
  );
});

test("BALL SOTUV BONUSIGA VA PLAN BONUSIGA TA'SIR QILMAYDI", () => {
  // Bir xil sotuv, ikki xil ball: vazifa haqi farq qiladi, bonuslar YO'Q.
  const sotuv = mln(150);
  const sotuvBonusi = bonus(sotuv);
  const plan = planBonusi(sotuv, mln(100), 1_000_000);

  const yuqoriBall = vazifaHaqi(1_000_000, foiz(100));
  const pastBall = vazifaHaqi(1_000_000, foiz(50));
  assert.notEqual(yuqoriBall, pastBall, "ball vazifa haqini o'zgartiradi");

  assert.equal(bonus(sotuv), sotuvBonusi, "sotuv bonusi balldan mustaqil");
  assert.equal(planBonusi(sotuv, mln(100), 1_000_000), plan, "plan bonusi balldan mustaqil");

  assert.equal(
    jamiOylik({ vazifaHaqi: yuqoriBall, sotuvBonusi, planBonusi: plan }) -
      jamiOylik({ vazifaHaqi: pastBall, sotuvBonusi, planBonusi: plan }),
    yuqoriBall - pastBall,
    "jami farqi FAQAT vazifa haqidan kelib chiqadi"
  );
});

test("har vazifa O'Z balli bilan hisoblanadi — o'rtacha bilan EMAS", () => {
  // Ikki vazifa: 100 va 60 ball. O'rtacha 80 → 85% bo'lardi va IKKALASI ham
  // noto'g'ri to'lanardi. To'g'ri yo'l: 110% va 70%.
  const togri = vazifaHaqi(1_000_000, foiz(100)) + vazifaHaqi(1_000_000, foiz(60));
  const ortachaBilan = vazifaHaqi(1_000_000, foiz(80)) * 2;
  assert.equal(togri, 1_100_000 + 700_000);
  assert.equal(ortachaBilan, 1_700_000);
  assert.notEqual(togri, ortachaBilan);
});

// ---------- Pul butunligi ----------

test("pul har doim butun son — float qoldiq yo'q", () => {
  for (const sotuv of [1, 7, 333, 1_234_567, mln(37) + 7, mln(199) + 999]) {
    const n = bonus(sotuv);
    assert.ok(Number.isInteger(n), `${sotuv} uchun bonus butun emas: ${n}`);
  }
  for (const haq of [1, 999, 333_333, 1_000_001]) {
    for (const b of [100, 84, 69, 54, 39]) {
      assert.ok(Number.isInteger(vazifaHaqi(haq, foiz(b))));
    }
  }
});
