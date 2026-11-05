import type { Metadata, Viewport } from "next";
import { Anuphan, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Latin + digits come from Geist; Thai glyphs fall through to Anuphan.
const latin = Geist({ variable: "--font-latin", subsets: ["latin"] });
const thai = Anuphan({ variable: "--font-thai", subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });
const code = Geist_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SYSRENT Booking — ระบบจองคิวออนไลน์", template: "%s | SYSRENT Booking" },
  description: "ระบบจองคิวออนไลน์สำหรับทุกธุรกิจบริการ ร้านเสริมสวย คลินิก สตูดิโอ ฟิตเนส และอื่น ๆ",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f7f5" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${latin.variable} ${thai.variable} ${code.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
