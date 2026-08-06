"use client";

import { useEffect, useState } from "react";

/**
 * Nav badge uchun bildirishnoma soni — sahifa ochilgandan KEYIN yuklanadi,
 * shuning uchun navigatsiyani sekinlashtirmaydi. Xato/402 bo'lsa 0 ko'rsatiladi.
 */
export function useNotifCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let faol = true;
    fetch("/api/me/notif-count")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => {
        if (faol) setCount(typeof d?.count === "number" ? d.count : 0);
      })
      .catch(() => {});
    return () => {
      faol = false;
    };
  }, []);
  return count;
}
