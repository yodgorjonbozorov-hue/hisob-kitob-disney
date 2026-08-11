import type { Metadata, Viewport } from "next";
import { Inter, Manrope, Poppins } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { PwaSetup } from "@/components/PwaSetup";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

// Brend sarlavha shrifti (docs/BRAND.md: Poppins 600/700) — logo so'zligi va hero sarlavhalar.
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  variable: "--font-poppins",
  display: "swap",
  weight: ["600", "700"],
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
  metadataBase: new URL(BRAND.url),
  title: `${BRAND.nomi} — Biznes uchun yagona boshqaruv platformasi`,
  description: BRAND.tavsif,
  manifest: "/manifest.json",
  applicationName: BRAND.nomi,
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-256.png", type: "image/png", sizes: "256x256" },
    ],
    apple: "/logo-icon-512.png",
  },
  openGraph: {
    type: "website",
    siteName: BRAND.nomi,
    title: `${BRAND.nomi} — ${BRAND.tagline}`,
    description: BRAND.tavsif,
    url: BRAND.url,
    locale: "uz_UZ",
    images: [{ url: "/logo-full-1600.png", width: 1600, height: 400, alt: BRAND.nomi }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: BRAND.nomi },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0F766E" },
    { media: "(prefers-color-scheme: dark)", color: "#061413" },
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
    <html
      lang="uz"
      className={`${inter.variable} ${manrope.variable} ${poppins.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
