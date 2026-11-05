import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { Mascot } from "@/components/mascot";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="paw-wallpaper flex min-h-screen flex-col items-center px-4 pb-12 pt-8 sm:justify-center sm:py-12">
      <Link href="/" aria-label="SYSRENT Booking หน้าแรก" className="mb-4">
        <Wordmark />
      </Link>
      <div className="relative w-full max-w-[420px] pt-[150px]">
        <Mascot className="pointer-events-none absolute left-1/2 top-0 z-10 w-[264px] -translate-x-1/2" />
        <div className="relative rounded-[2.25rem] border-[3px] border-white bg-gradient-to-b from-[#fffdf9] to-[#fff1e4] px-6 pb-7 pt-9 shadow-lg ring-1 ring-[#f6d3b5] sm:px-8 [&_button[type=submit]]:w-full">
          {children}
        </div>
      </div>
    </main>
  );
}
