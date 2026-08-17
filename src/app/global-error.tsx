"use client";

import { BRAND } from "@/lib/brand";

/**
 * Ildiz layout xatosi — bu holatda layout ham, globals.css ham yuklanmaydi,
 * shuning uchun o'z <html>/<body> va inline uslublar bilan chiziladi.
 * Maqsad: mijoz ingliz tilidagi "Application error" ekranini ko'rmasin.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uz">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#061413",
          color: "#E6F4F1",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          {/* Ikonka inline SVG — bu oxirgi chora ekrani, hech qanday paketga tayanmaydi. */}
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5EEAD4"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: "0 auto 12px" }}
            aria-hidden="true"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Tizimda vaqtincha nosozlik</h1>
          <p style={{ fontSize: 14, color: "#9CB8B4", marginTop: 8, lineHeight: 1.5 }}>
            Sahifani ochib bo&apos;lmadi. Ma&apos;lumotlaringiz saqlanib qoldi — bir necha soniyadan
            keyin qaytadan urinib ko&apos;ring.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: "#5EEAD4",
              color: "#062521",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Qayta urinish
          </button>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#6B8C88", marginTop: 24 }}>Xato kodi: {error.digest}</p>
          )}
          <p style={{ fontSize: 12, color: "#6B8C88", marginTop: 4 }}>
            {BRAND.nomi} · {BRAND.domen}
          </p>
        </div>
      </body>
    </html>
  );
}
