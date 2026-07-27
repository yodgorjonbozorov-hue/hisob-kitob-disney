import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

// Raqamlar va display sarlavhalar uchun (Manrope). Uzbek lotin `ʻ` (U+02BB)
// latin-ext ichida — Inter body matn uchun uni to'liq qamrab oladi.
const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Disney Navoiy — Kirim-Chiqim Hisoboti",
  description: "Disney Navoiy kompaniyasi uchun kirim-chiqim hisob-kitob tizimi",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Disney Navoiy" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F6F7" },
    { media: "(prefers-color-scheme: dark)", color: "#081216" },
  ],
};

// FOUC oldini olish: bo'yashdan oldin mavzuni o'rnatadi (localStorage yoki tizim sozlamasi).
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    var d = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (d) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
