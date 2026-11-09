import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WagmiProvider } from "@/components/wallet/WagmiProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { EscrowConfigurationStatus } from "@/components/chain/EscrowConfigurationStatus";

const syne = Syne({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Pactora | MUSD Escrow for Milestone Payments on Mezo",
  description:
    "Work agreed. Funds protected. Payments verified. Non-custodial milestone escrow and payment coordination for the Mezo ecosystem.",
  keywords: [
    "Mezo",
    "MUSD",
    "Escrow",
    "Milestone Payments",
    "Web3 Freelancing",
    "Smart Contract",
    "Telegram Bot",
  ],
  authors: [{ name: "Pactora Protocol" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col bg-[#080d1a] text-slate-100 font-sans antialiased"
      >
        <ScrollProgress />
        <WagmiProvider>
          <Navbar />
          <EscrowConfigurationStatus />
          <main className="flex-1 w-full">{children}</main>
          <Footer />
        </WagmiProvider>
      </body>
    </html>
  );
}
