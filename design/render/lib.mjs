/**
 * BALANSA iOS — EKRAN QURISH KUTUBXONASI
 *
 * NEGA BOR: 100+ ekranni qo'lda HTML yozib chiqish — takrorlanish va
 * nomuvofiqlik manbai. Bu yerda har komponent BITTA funksiya; ekran esa
 * shu funksiyalardan yig'iladi. Komponent o'zgarsa — BARCHA ekran o'zgaradi.
 *
 * Qat'iy qoida: bu yerda inline `style` FAQAT o'lchov/joylashuv uchun
 * (kenglik, grid) — RANG hech qachon inline yozilmaydi, u components.css
 * dagi klass orqali keladi.
 */

// ─────────────────────────── Ikonalar ───────────────────────────
// SF Symbols o'rniga sodda chiziqli SVG. `stroke: currentColor` —
// rang doim ota elementdan meros bo'ladi.

const P = (d, w = 1.8) =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const IKONA = {
  // Moliya
  kirim: P("M12 5v14M6 13l6 6 6-6", 1.9),
  chiqim: P("M12 19V5M6 11l6-6 6 6", 1.9),
  wallet: P("M3 8.5A2.5 2.5 0 0 1 5.5 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5v-8Z") + P("M16.5 12.5h.01", 2.4),
  qarz: P("M12 7.5v5M12 16h.01", 1.9) + `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  cash: P("M2.5 7.5h19v9h-19z") + `<circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  transfer: P("M4 8h13l-3-3M20 16H7l3 3"),
  // Sotuv / ombor
  cart: P("M2.5 3.5h2.2l2 8.6h8.4l1.8-6.2H5.6") + `<circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/>`,
  box: P("M4 8.2 12 4l8 4.2v7.6L12 20l-8-4.2V8.2Z") + P("M4 8.2 12 12.4l8-4.2M12 12.4V20"),
  tag: P("M4 4h7l9 9-7 7-9-9V4Z") + `<circle cx="8" cy="8" r="1.4"/>`,
  scan: P("M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16"),
  truck: P("M2.5 6.5h10v8h-10zM12.5 9.5h4l3 3v2h-7z") + `<circle cx="6.5" cy="17" r="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="16.5" cy="17" r="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  // Odamlar
  user: P("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0"),
  users: P("M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 19.5a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.2a6 6 0 0 1 3.5 5.3"),
  // Navigatsiya
  home: P("M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-8.5Z"),
  list: P("M4.5 6.5h15M4.5 12h15M4.5 17.5h9"),
  dots: `<circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/>`,
  chart: P("M4 20V10M10 20V4M16 20v-7M22 20H2"),
  report: P("M6 3h9l4 4v14H6z") + P("M15 3v4h4M9 12h7M9 16h5"),
  // Amallar
  plus: P("M12 5v14M5 12h14", 2.2),
  minus: P("M5 12h14", 2.2),
  check: P("M4.5 12.5 9.5 17.5 19.5 7", 2.2),
  x: P("M6 6l12 12M18 6L6 18", 2),
  chevronR: P("M9 5l7 7-7 7", 2),
  chevronL: P("M15 5l-7 7 7 7", 2),
  chevronD: P("M5 9l7 7 7-7", 2),
  search: `<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/>` + P("M16 16l4.5 4.5"),
  filter: P("M4 6h16M7 12h10M10 18h4"),
  edit: P("M5 19h3l9.5-9.5a2.1 2.1 0 0 0-3-3L5 16v3Z"),
  trash: P("M4.5 6.5h15M9 6.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5M6.5 6.5 7.5 20h9l1-13.5"),
  share: P("M12 3v12M8 7l4-4 4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"),
  phone: P("M5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.7 1.5A16.5 16.5 0 0 1 3.5 5.2 1.5 1.5 0 0 1 5 3.5Z"),
  // Holat
  bell: P("M12 3a5.5 5.5 0 0 0-5.5 5.5v3.2L5 15.1h14l-1.5-3.4V8.5A5.5 5.5 0 0 0 12 3Z") + P("M9.9 17.4a2.2 2.2 0 0 0 4.2 0"),
  lock: P("M6.5 10.5h11v9h-11z") + P("M9 10.5V7.5a3 3 0 0 1 6 0v3"),
  faceid: P("M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16") + P("M9 10v1.5M15 10v1.5M9.5 15.5a4 4 0 0 0 5 0"),
  warning: P("M12 4 2.5 20h19L12 4Z") + P("M12 10v4M12 17.5h.01", 2),
  info: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>` + P("M12 11v5M12 8h.01", 2),
  clock: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/>` + P("M12 7.5V12l3 2"),
  calendar: P("M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4"),
  offline: P("M3 3l18 18") + P("M8.5 15.5a5 5 0 0 1 7 0M5 12a10 10 0 0 1 4-2.5M19 12a10 10 0 0 0-3-2.2"),
  sync: P("M20 8a8 8 0 0 0-14.5-2M4 16a8 8 0 0 0 14.5 2") + P("M4 4v4h4M20 20v-4h-4"),
  settings: `<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/>` + P("M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1"),
  ai: P("M12 4l1.8 4.7L18.5 10l-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.3L12 4Z") + P("M18 16l.9 2.2 2.1.8-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.8L18 16Z", 1.4),
  doc: P("M6 3h9l4 4v14H6z") + P("M15 3v4h4"),
  shield: P("M12 3.5 5 6v6c0 4.2 2.9 7.6 7 8.5 4.1-.9 7-4.3 7-8.5V6l-7-2.5Z"),
  approval: P("M12 3.5 5 6v6c0 4.2 2.9 7.6 7 8.5 4.1-.9 7-4.3 7-8.5V6l-7-2.5Z") + P("M9 12l2 2 4-4", 2),
  building: P("M5 20V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V20M15 10h3.5A1.5 1.5 0 0 1 20 11.5V20M2.5 20h19") + P("M8 8h4M8 12h4M8 16h4", 1.5),
  card: P("M2.5 7.5h19v9h-19zM2.5 11h19"),
};

/** Ikonani chiqaradi. `s` — o'lcham (px). */
export const ikona = (nom, s = 22) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${IKONA[nom] ?? IKONA.info}</svg>`;

// ─────────────────────────── Formatlash ───────────────────────────

/** 1250000 → "1 250 000" (uzilmas probel bilan). */
export const pul = (n) => {
  const s = Math.abs(Math.round(n)).toString();
  const guruh = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const ishora = n < 0 ? "−" : "";
  return ishora + guruh;
};
/** Kirim/chiqim uchun ochiq ishorali summa. */
export const pulIshora = (n) => (n > 0 ? "+" : "") + pul(n);

// ─────────────────────────── Qurilma qobig'i ───────────────────────────

/**
 * To'liq ekran HTML'i.
 * @param {object} o
 * @param {string} o.id      BAL-NNN
 * @param {string} o.nom     ekran nomi (title tegida)
 * @param {string} o.body    ekran mazmuni (statusbar va homebar ORASI)
 * @param {boolean} o.qora   status bar matni oq bo'lsinmi (to'q fonli ekran)
 */
export function ekran({ id, nom, body, qora = false }) {
  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${id} — ${nom}</title>
<link rel="stylesheet" href="../tokens.css">
<link rel="stylesheet" href="../base.css">
<link rel="stylesheet" href="../components.css">
</head>
<body>
<div class="device"${qora ? ' style="--sysbar-ink:#fff"' : ""}>
${statusbar()}
<div class="island"></div>
<div class="screen">
${body}
</div>
${homebar()}
</div>
</body>
</html>
`;
}

export const statusbar = () => `<div class="statusbar">
  <div class="statusbar__time">9:41</div>
  <div class="statusbar__right">
    <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.2 5.9 8.9a3 3 0 0 1 4.2 0L8 11.2Zm-4-4.3L2.6 5.4a7.6 7.6 0 0 1 10.8 0L12 6.9a5.5 5.5 0 0 0-8 0ZM.6 3.4A10.4 10.4 0 0 1 15.4 3.4L14 4.9a8.3 8.3 0 0 0-12 0L.6 3.4Z"/></svg>
    <svg width="26" height="13" viewBox="0 0 26 13"><rect x="0.6" y="0.6" width="21" height="11.8" rx="3.5" fill="none" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.1"/><rect x="2.2" y="2.2" width="16" height="8.6" rx="2.2"/><path d="M23.2 4.3v4.4a2.4 2.4 0 0 0 0-4.4Z" fill-opacity="0.45"/></svg>
  </div>
</div>`;

export const homebar = () => `<div class="homebar"><div class="homebar__line"></div></div>`;

// ─────────────────────────── Navigatsiya ───────────────────────────

/** Katta sarlavhali navbar (ro'yxat ekranlari tepasi). */
export const navLarge = (sarlavha, ong = "") => `<div class="navbar-large row-between">
  <div class="navbar-large__title">${sarlavha}</div>
  <div class="row gap-1">${ong}</div>
</div>`;

/** Inline navbar: orqaga + markazda sarlavha + o'ngda amal. */
export const navInline = (sarlavha, { orqaga = "Orqaga", ong = "" } = {}) => `<div class="navbar">
  <div class="navbar__back">${ikona("chevronL", 20)}<span>${orqaga}</span></div>
  <div class="navbar__title truncate">${sarlavha}</div>
  <div class="row" style="min-width:64px;justify-content:flex-end">${ong}</div>
</div>`;

/** Biznes almashtirgich + bildirishnoma (bosh ekranlar uchun). */
export const navBiznes = (nomi, rol, { nuqta = true } = {}) => `<div class="navbar">
  <div class="biz-switch">
    <div class="biz-switch__logo">${nomi.trim()[0]}</div>
    <div class="grow col" style="gap:1px">
      <div class="t-subheadline truncate" style="font-weight:620">${nomi}</div>
      <div class="t-caption-2 c-3">${rol}</div>
    </div>
    ${ikona("chevronD", 12)}
  </div>
  <div class="icon-btn">${ikona("bell", 22)}${nuqta ? '<span class="icon-btn__dot"></span>' : ""}</div>
</div>`;

export const ikonBtn = (nom, { accent = false, s = 22 } = {}) =>
  `<div class="icon-btn${accent ? " icon-btn--accent" : ""}">${ikona(nom, s)}</div>`;

/**
 * Tab bar. `tablar` — [{ikona, yorliq, aktiv?, badge?}], FAB o'rtaga qo'yiladi.
 * 4 tab + FAB yoki 2 tab + FAB.
 */
export function tabbar(tablar, { fab = true } = {}) {
  const yasa = (t) => `<div class="tab${t.aktiv ? " tab--active" : ""}">
    <div style="position:relative">${ikona(t.ikona, 24)}${t.badge ? `<span class="tab__badge">${t.badge}</span>` : ""}</div>
    <span class="tab__label">${t.yorliq}</span>
  </div>`;
  if (!fab) return `<div class="tabbar glass--bar">${tablar.map(yasa).join("")}</div>`;
  const yarim = Math.ceil(tablar.length / 2);
  return `<div class="tabbar glass--bar">
${tablar.slice(0, yarim).map(yasa).join("")}
<div class="tab-fab">${ikona("plus", 26)}</div>
${tablar.slice(yarim).map(yasa).join("")}
</div>`;
}

// ─────────────────────────── Mazmun bloklari ───────────────────────────

export const scroll = (ichki) => `<div class="scroll">${ichki}</div>`;

export const bolim = (sarlavha, ong = "") =>
  `<div class="section-head"><span class="t-headline c-1">${sarlavha}</span>${ong ? `<span class="t-subheadline c-accent">${ong}</span>` : ""}</div>`;

export const guruhSarlavha = (matn) => `<div class="list-group-head">${matn}</div>`;

export const karta = (ichki, { klass = "" } = {}) => `<div class="card ${klass}">${ichki}</div>`;

/** Statistika kartasi: ikona + yorliq + qiymat. */
export const stat = (yorliq, qiymat, tur = "accent", ikonaNomi = "wallet") => `<div class="stat">
  <div class="stat__head">
    <div class="stat__icon stat__icon--${tur}">${ikona(ikonaNomi, 11)}</div>
    <span class="t-footnote">${yorliq}</span>
  </div>
  <div class="stat__value amount amount--md c-1">${qiymat}</div>
</div>`;

/**
 * Ro'yxat qatori.
 * @param {object} o {ikona, tur, sarlavha, izoh, ong, ongIzoh, chevron, avatar}
 */
export function qator(o) {
  const chap = o.avatar
    ? `<div class="avatar">${o.avatar}</div>`
    : o.ikona
      ? `<div class="list-row__icon list-row__icon--${o.tur ?? "fill"}">${ikona(o.ikona, 16)}</div>`
      : "";
  const ong = o.ong
    ? `<div class="col" style="align-items:flex-end;gap:1px">
         <span class="amount amount--md ${o.ongKlass ?? "c-1"}">${o.ong}</span>
         ${o.ongIzoh ? `<span class="t-caption-1 c-3">${o.ongIzoh}</span>` : ""}
       </div>`
    : "";
  return `<div class="list-row">
  ${chap}
  <div class="grow col" style="gap:1px">
    <span class="t-callout c-1 truncate" style="font-weight:550">${o.sarlavha}</span>
    ${o.izoh ? `<span class="t-caption-1 c-3 truncate">${o.izoh}</span>` : ""}
  </div>
  ${ong}
  ${o.chevron ? `<span class="chevron">${ikona("chevronR", 16)}</span>` : ""}
</div>`;
}

export const royxat = (qatorlar, { plain = false } = {}) =>
  `<div class="list${plain ? " list--plain" : ""}">${qatorlar.join("")}</div>`;

export const chip = (matn, tur = "", { tap = false } = {}) =>
  `<span class="chip${tur ? ` chip--${tur}` : ""}${tap ? " chip--tap" : ""}">${matn}</span>`;

export const tugma = (matn, tur = "primary", { block = true, disabled = false, ikonaNomi = null } = {}) =>
  `<div class="btn btn--${tur}${block ? " btn--block" : ""}${disabled ? " is-disabled" : ""}">${ikonaNomi ? ikona(ikonaNomi, 18) : ""}${matn}</div>`;

export const segmented = (elementlar, aktivIndex = 0, tur = "") =>
  `<div class="segmented">${elementlar
    .map((e, i) => `<div class="segmented__item${i === aktivIndex ? " segmented__item--active" : ""}${tur ? ` segmented__item--${tur}` : ""}">${e}</div>`)
    .join("")}</div>`;

export const qidiruv = (placeholder = "Qidirish") =>
  `<div class="search">${ikona("search", 18)}<span class="search__input">${placeholder}</span></div>`;

export const maydon = (yorliq, qiymat, { placeholder = false, holat = "" } = {}) => `<div class="field">
  <span class="field__label">${yorliq}</span>
  <div class="input${holat ? ` input--${holat}` : ""}"><span class="${placeholder ? "input__placeholder" : ""}">${qiymat}</span></div>
</div>`;

export const stepper = (qiymat, birlik = "dona") => `<div class="stepper">
  <div class="stepper__btn">${ikona("minus", 18)}</div>
  <div class="stepper__value">${qiymat}<span class="stepper__unit"> ${birlik}</span></div>
  <div class="stepper__btn">${ikona("plus", 18)}</div>
</div>`;

/** Progress / aging bari. `segmentlar` — [{ulush, rang}] (rang = CSS o'zgaruvchi nomi). */
export const bar = (segmentlar, { thin = false } = {}) =>
  `<div class="bar${thin ? " bar--thin" : ""}">${segmentlar
    .map((s) => `<div class="bar__seg" style="width:${s.ulush}%;background:var(--${s.rang})"></div>`)
    .join("")}</div>`;

export const holat = (ikonaNomi, sarlavha, matn, { tur = "", cta = "" } = {}) => `<div class="state">
  <div class="state__icon${tur ? ` state__icon--${tur}` : ""}">${ikona(ikonaNomi, 30)}</div>
  <div class="state__title">${sarlavha}</div>
  <div class="state__text">${matn}</div>
  ${cta ? `<div style="margin-top:var(--sp-4);width:100%;max-width:240px">${cta}</div>` : ""}
</div>`;

export const banner = (tur, matn, ong = "") =>
  `<div class="banner banner--${tur}">${ikona(tur === "offline" ? "offline" : tur === "sync" ? "sync" : "warning", 15)}<span class="grow">${matn}</span>${ong}</div>`;

export const toast = (matn) => `<div class="toast">${ikona("check", 18)}<span>${matn}</span></div>`;

/** Ustunli grafik. `qiymatlar` — 0..1 oralig'idagi nisbatlar. */
export const grafik = (qiymatlar, yorliqlar, aktivIndex = -1) => `<div class="chart">
  ${qiymatlar.map((v, i) => `<div class="chart__bar${i === aktivIndex || aktivIndex < 0 ? "" : " chart__bar--muted"}" style="height:${Math.max(4, v * 100)}%"></div>`).join("")}
</div>
<div class="chart__labels">${yorliqlar.map((l) => `<div class="chart__label">${l}</div>`).join("")}</div>`;

/** Donut grafik — conic-gradient. `bolaklar` — [{ulush, rang}]. */
export function donut(bolaklar, markazUst, markazOst) {
  let acc = 0;
  const stops = bolaklar
    .map((b) => {
      const a = acc;
      acc += b.ulush;
      return `var(--${b.rang}) ${a}% ${acc}%`;
    })
    .join(", ");
  return `<div class="donut" style="background:conic-gradient(${stops})">
    <div class="donut__hole">
      <div class="t-caption-1 c-3">${markazOst}</div>
      <div class="amount amount--md c-1">${markazUst}</div>
    </div>
  </div>`;
}

export const sheet = (sarlavha, ichki, { olcham = "large", foot = "" } = {}) => `<div class="scrim"></div>
<div class="sheet sheet--${olcham}">
  <div class="sheet__grabber"></div>
  <div class="sheet__head">
    <span class="t-title-3 c-1">${sarlavha}</span>
    <div class="icon-btn">${ikona("x", 20)}</div>
  </div>
  <div class="sheet__body">${ichki}</div>
  ${foot ? `<div class="sheet__foot">${foot}</div>` : ""}
</div>`;

export const alert = (sarlavha, matn, amallar) => `<div class="scrim"></div>
<div class="alert">
  <div class="alert__body">
    <div class="alert__title">${sarlavha}</div>
    <div class="alert__text">${matn}</div>
  </div>
  <div class="alert__acts">${amallar
    .map((a) => `<div class="alert__act${a.destructive ? " alert__act--destructive" : ""}">${a.matn}</div>`)
    .join("")}</div>
</div>`;

export const actionSheet = (elementlar, bekor = "Bekor qilish") => `<div class="scrim"></div>
<div class="action-sheet">
  <div class="action-sheet__group">${elementlar
    .map((e) => `<div class="action-sheet__item${e.destructive ? " action-sheet__item--destructive" : ""}">${e.ikona ? ikona(e.ikona, 20) : ""}${e.matn}</div>`)
    .join("")}</div>
  <div class="action-sheet__group"><div class="action-sheet__item action-sheet__item--cancel">${bekor}</div></div>
</div>`;

/** Skeleton qator (yuklanmoqda holati uchun). */
export const skelQator = () => `<div class="list-row">
  <div class="skel skel--circle" style="width:38px;height:38px;flex:0 0 auto"></div>
  <div class="grow col gap-2">
    <div class="skel skel--title" style="width:62%"></div>
    <div class="skel skel--text" style="width:38%"></div>
  </div>
  <div class="skel skel--amount" style="width:76px"></div>
</div>`;
