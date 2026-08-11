/**
 * XAVFSIZLIK HEADER'LARI (H-15).
 *
 * CSP `report-only` rejimida: recharts inline style ishlatadi va Next.js
 * inline bootstrap skriptini joylashtiradi — darhol majburlash sahifani
 * buzardi. Report-only bilan avval buzilishlarni ko'ramiz, keyin majburlaymiz.
 *
 * HSTS faqat production'da: lokal `http://localhost` da u brauzerni HTTPS'ga
 * majburlab dev muhitni ishlamas holga keltiradi.
 */
const production = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  // Next.js inline bootstrap va tema skripti.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // recharts va Tailwind inline style.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const xavfsizlikHeaderlari = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kerak bo'lmagan qurilma imkoniyatlari yopiladi. (Kelajakda kamera —
  // shtrix-kod skaneri uchun — ochilganda shu ro'yxat yangilanadi.)
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: csp },
  ...(production
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: xavfsizlikHeaderlari }];
  },
  async redirects() {
    // Ilova /app ostiga ko'chdi — eski URL'lar (bookmark va odatlar) yangi manzilga.
    const eskiYollar = [
      "/tranzaksiyalar",
      "/hisobot",
      "/byudjet",
      "/smena",
      "/sotuv",
      "/qarzlar",
      "/ombor",
      "/takroriy",
      "/bildirishnomalar",
    ];
    // Eski *.vercel.app manzillaridan balansa.uz'ga (mijoz bookmark'lari,
    // Telegram'dagi eski havolalar). `/api/*` ATAYLAB chetlab o'tiladi:
    // bot webhooki va cron'lar eski manzilga bog'langan — redirect ularni buzadi.
    const eskiHostlar = ["balansa-uz.vercel.app", "hisob-kitob-disneyn1.vercel.app"];
    return [
      ...eskiHostlar.map((host) => ({
        source: "/:yol((?!api/).*)",
        has: [{ type: "host", value: host }],
        destination: "https://balansa.uz/:yol",
        permanent: true,
      })),
      ...eskiYollar.map((yol) => ({
        source: yol,
        destination: `/app${yol}`,
        permanent: false,
      })),
      { source: "/admin/:path*", destination: "/app/admin/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
