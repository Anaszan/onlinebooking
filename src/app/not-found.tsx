import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="tnum font-mono text-sm text-slate-500">404</p>
      <h1 className="mt-3 text-lg font-semibold">ไม่พบหน้าที่คุณต้องการ</h1>
      <p className="mt-1 text-sm text-slate-500">ลิงก์อาจไม่ถูกต้อง หรือคุณไม่มีสิทธิ์เข้าถึง</p>
      <Link href="/" className="mt-6 text-sm font-medium text-slate-900 underline hover:no-underline">
        กลับหน้าแรก
      </Link>
    </main>
  );
}
