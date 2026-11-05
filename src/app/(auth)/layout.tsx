import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-10 sm:justify-center sm:py-16">
      <Link href="/" aria-label="SYSRENT Booking หน้าแรก" className="mb-10">
        <Wordmark />
      </Link>
      <div className="w-full max-w-[380px] rounded-2xl border border-slate-200 bg-white p-6 shadow-md sm:p-8 [&_button[type=submit]]:w-full">{children}</div>
    </main>
  );
}
