import type { Metadata, Viewport } from "next";
import { EB_Garamond, IM_Fell_English, IM_Fell_English_SC, Rye, Special_Elite } from "next/font/google";
import "./globals.css";

const rye = Rye({ weight: "400", subsets: ["latin"], variable: "--font-rye", display: "swap" });
const fellSc = IM_Fell_English_SC({ weight: "400", subsets: ["latin"], variable: "--font-fell-sc", display: "swap" });
const fell = IM_Fell_English({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-fell", display: "swap" });
const garamond = EB_Garamond({ subsets: ["latin"], variable: "--font-garamond", display: "swap" });
const elite = Special_Elite({ weight: "400", subsets: ["latin"], variable: "--font-special-elite", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Falegnameria — Wild Lands 1900", template: "%s · Falegnameria" },
  description: "Registro della bottega di falegnameria — Wild Lands 1900",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#35251B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${rye.variable} ${fellSc.variable} ${fell.variable} ${garamond.variable} ${elite.variable}`}>
      <body>{children}</body>
    </html>
  );
}
