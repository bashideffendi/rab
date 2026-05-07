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
  title: "RABin — Susun RAB profesional untuk konstruksi Indonesia",
  description:
    "Hitung Rencana Anggaran Biaya berbasis AHSP resmi (Permen PUPR) dengan harga yang menyesuaikan daerah proyek. Library 2.669+ item, time schedule, dan export Excel/PDF profesional.",
  keywords: [
    "RAB",
    "Rencana Anggaran Biaya",
    "AHSP",
    "konstruksi",
    "Permen PUPR",
    "kalkulator RAB",
    "estimator konstruksi",
    "IKK",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: "RABin — Susun RAB profesional untuk konstruksi Indonesia",
    description:
      "Hitung RAB berbasis AHSP resmi, harga menyesuaikan daerah, dengan time schedule dan export profesional.",
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
