import type { Metadata, Viewport } from "next";
import { Anuphan, Geist_Mono, Mitr } from "next/font/google";
import "./globals.css";

// Mitr: rounded, friendly display voice for headings, labels and buttons.
const cute = Mitr({ variable: "--font-cute", subsets: ["thai", "latin"], weight: ["400", "500", "600"] });
const thai = Anuphan({ variable: "--font-thai", subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });
const code = Geist_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "จองคิวอาบน้ำ ตัดขน ดูแลสัตว์เลี้ยง", template: "%s | จองคิวร้านสัตว์เลี้ยง" },
  description: "ระบบจองคิวออนไลน์สำหรับร้านอาบน้ำ ตัดขน สปา และรับฝากสัตว์เลี้ยง",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fdeee2" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${cute.variable} ${thai.variable} ${code.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
