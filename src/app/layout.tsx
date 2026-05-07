import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RABin — Susun RAB profesional dengan AHSP 2026 PUPR",
  description:
    "Platform RAB online berbasis AHSP 2026 Permen PUPR, harga menyesuaikan IKK BPS per provinsi, generate RAB dari gambar kerja dengan AI, export Excel & PDF profesional.",
  keywords: [
    "RAB",
    "RAB online",
    "Rencana Anggaran Biaya",
    "AHSP 2026",
    "AHSP Permen PUPR",
    "konstruksi Indonesia",
    "kalkulator RAB",
    "estimator konstruksi",
    "IKK BPS",
    "AI RAB",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: "RABin — Susun RAB profesional dengan AHSP 2026 PUPR",
    description:
      "AHSP 2026 PUPR, harga regional via IKK BPS, generate RAB dari gambar pakai AI, export Excel & PDF.",
    locale: "id_ID",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
