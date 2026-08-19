/**
 * CSV — UMUMIY O'QISH VA YOZISH.
 *
 * Ikki joyda kerak bo'ldi: tranzaksiya importi va mahsulot import/eksporti.
 * Har biri o'z tahlilchisini yozsa ular asta-sekin farq qila boshlaydi
 * (biri qo'shtirnoqni tushunadi, ikkinchisi yo'q) — shuning uchun bitta joy.
 *
 * Faqat matn bilan ishlaydi: bazaga ham, faylga ham tegmaydi.
 */

/** Excel yaratgan fayl boshidagi BOM va CRLF ni tozalab, satrlarga bo'ladi. */
export function csvSatrlar(matn: string): string[] {
  return matn
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((s) => s.trimEnd());
}

/**
 * CSV qatorini bo'laklarga ajratadi — qo'shtirnoq ichidagi ajratgichni
 * hurmat qiladi ("Ijara, iyul" kabi izohlar buzilmasin).
 *
 * `ajratgich` berilmasa vergul ham, nuqtali vergul ham ajratgich hisoblanadi
 * (tranzaksiya importining eski xatti-harakati saqlanadi).
 */
export function csvQatorniBol(qator: string, ajratgich?: string): string[] {
  const natija: string[] = [];
  let joriy = "";
  let qoshtirnoqda = false;
  for (let i = 0; i < qator.length; i++) {
    const ch = qator[i];
    if (ch === '"') {
      if (qoshtirnoqda && qator[i + 1] === '"') {
        joriy += '"';
        i++;
      } else {
        qoshtirnoqda = !qoshtirnoqda;
      }
    } else if (!qoshtirnoqda && (ajratgich ? ch === ajratgich : ch === "," || ch === ";")) {
      natija.push(joriy);
      joriy = "";
    } else {
      joriy += ch;
    }
  }
  natija.push(joriy);
  return natija.map((x) => x.trim());
}

/**
 * Sarlavha qatoriga qarab ajratgichni topadi.
 *
 * Excel mintaqaviy sozlamaga qarab `;` bilan saqlaydi, ko'p tizim esa `,`
 * bilan. Tovar nomida vergul bo'lishi mumkin ("shar, katta"), shuning uchun
 * taxmin qilish emas — sarlavhada qaysi belgi ko'p uchrasa o'sha ajratgich.
 */
export function ajratgichniTop(sarlavha: string): string {
  const nomzodlar = [",", ";", "\t"];
  let eng = ",";
  let engSoni = 0;
  for (const a of nomzodlar) {
    const soni = sarlavha.split(a).length - 1;
    if (soni > engSoni) {
      eng = a;
      engSoni = soni;
    }
  }
  return eng;
}

/**
 * Ustun nomini solishtirish uchun soddalashtiradi: kichik harf, apostrof
 * va bo'shliqlar olib tashlanadi. Shu bilan "O'lchov birligi", "olchov_birligi"
 * va "Olchov Birligi" bir xil kalitga tushadi.
 */
export function ustunKaliti(nom: string): string {
  return nom
    .toLowerCase()
    .replace(/[‘’ʻʼ`']/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Bitta katakni CSV uchun xavfsiz qiladi (vergul, qo'shtirnoq, yangi qator). */
export function csvKatak(qiymat: string | number | null | undefined): string {
  if (qiymat === null || qiymat === undefined) return "";
  const matn = String(qiymat);
  if (/[",;\n]/.test(matn)) return `"${matn.replace(/"/g, '""')}"`;
  return matn;
}

/**
 * Sarlavha va qatorlardan CSV matn yasaydi.
 *
 * Boshiga BOM qo'yiladi: usiz Excel UTF-8 ni tanimaydi va o'zbekcha
 * apostroflar "krakozyabra" bo'lib chiqadi.
 */
export function csvYasa(sarlavha: string[], qatorlar: (string | number | null)[][]): string {
  const satrlar = [sarlavha.map(csvKatak).join(",")];
  for (const q of qatorlar) satrlar.push(q.map(csvKatak).join(","));
  return "﻿" + satrlar.join("\n");
}
