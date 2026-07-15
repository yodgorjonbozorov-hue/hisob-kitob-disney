import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Disney Navoiy — Kirim-Chiqim Hisoboti",
  description: "Disney Navoiy kompaniyasi uchun kirim-chiqim hisob-kitob tizimi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
