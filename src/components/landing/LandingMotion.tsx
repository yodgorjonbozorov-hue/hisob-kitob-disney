"use client";

import { useEffect } from "react";
import { pulMatni } from "./qismlar";

/**
 * Landing harakati — ko'rinish maydoniga kirganda bo'limlarni ochish va pul
 * summalarini sanash. Dizayndagi (`Balansa Landing.dc.html`) skript bilan
 * bir xil xulq: IntersectionObserver, threshold 0.15, bir marta ishlaydi.
 *
 * `data-anim="on"` ni FAQAT shu komponent qo'yadi. Skript yuklanmasa CSS
 * `opacity:0` ni umuman qo'llamaydi — kontent boshidanoq ko'rinadi.
 *
 * `prefers-reduced-motion` yoqilgan bo'lsa hech narsa animatsiya qilinmaydi:
 * hamma element darhol ochiq holatga o'tadi, summalar yakuniy qiymatda qoladi.
 */
export function LandingMotion() {
  useEffect(() => {
    const ildiz = document.querySelector<HTMLElement>("[data-landing]");
    if (!ildiz) return;

    const kamHarakat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ildiz.setAttribute("data-anim", kamHarakat ? "off" : "on");

    const tugunlar = Array.from(
      ildiz.querySelectorAll<HTMLElement>("[data-reveal],[data-count]"),
    );
    if (kamHarakat) {
      tugunlar.forEach((n) => n.setAttribute("data-in", ""));
      return;
    }

    // Sanoq ramkalarini komponent uzilganda to'xtatish uchun yig'ib boramiz.
    const ramkalar = new Set<number>();

    const kuzatuvchi = new IntersectionObserver(
      (yozuvlar) => {
        yozuvlar.forEach((yozuv) => {
          if (!yozuv.isIntersecting) return;
          const el = yozuv.target as HTMLElement;
          el.setAttribute("data-in", "");
          if (el.hasAttribute("data-count")) sana(el, ramkalar);
          kuzatuvchi.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );

    tugunlar.forEach((n) => kuzatuvchi.observe(n));

    return () => {
      kuzatuvchi.disconnect();
      ramkalar.forEach((id) => cancelAnimationFrame(id));
    };
  }, []);

  return null;
}

/** 0 dan `data-count` gacha 900 ms, ease-out-cubic. Format `pulMatni` bilan bir xil. */
function sana(el: HTMLElement, ramkalar: Set<number>) {
  const nishon = Number(el.getAttribute("data-count"));
  if (!Number.isFinite(nishon)) return;

  const davomiylik = 900;
  const boshlanish = performance.now();

  const qadam = (hozir: number) => {
    const p = Math.min(1, (hozir - boshlanish) / davomiylik);
    const e = 1 - Math.pow(1 - p, 3);
    // Oxirgi ramkada aynan nishon qiymati yoziladi (yaxlitlash xatosisiz).
    el.textContent = pulMatni(p < 1 ? nishon * e : nishon);
    if (p < 1) ramkalar.add(requestAnimationFrame(qadam));
  };

  ramkalar.add(requestAnimationFrame(qadam));
}
