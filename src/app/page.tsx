import Link from "next/link";
import { LinkButton } from "@/components/ui";

const features = [
  { title: "หน้าจองของร้านคุณเอง", text: "ได้ลิงก์ร้าน เช่น shop.sysrent.shop หรือใช้โดเมนของคุณเอง ลูกค้าจองได้ 24 ชม. บนมือถือ" },
  { title: "ไม่มีจองชน", text: "ระบบคำนวณเวลาว่างจากตารางงาน วันหยุด buffer และล็อกเวลาในฐานข้อมูล ป้องกันการจองซ้ำ 100%" },
  { title: "จัดการคิวง่าย", text: "ยืนยัน เช็กอิน เลื่อนนัด ยกเลิก no-show ดูคิววันนี้แยกตามพนักงาน" },
  { title: "หลายสาขา หลายพนักงาน", text: "กำหนดเวลาทำงาน วันลา และบริการที่แต่ละคนทำได้ แยกตามสาขาและ timezone" },
  { title: "ข้อมูลลูกค้า", text: "เก็บประวัติการจอง หมายเหตุ และช่องทางติดต่อของลูกค้าแต่ละราย" },
  { title: "ปลอดภัยแบบ Multi-Tenant", text: "ข้อมูลแต่ละร้านแยกกันด้วย Row Level Security ตรวจสิทธิ์ทุกคำขอฝั่ง server" },
];

export default function Home() {
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="text-lg font-bold">
          SYSRENT <span className="text-brand">Booking</span>
        </span>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-slate-600 hover:text-slate-900">
            เข้าสู่ระบบ
          </Link>
          <LinkButton href="/signup">เริ่มใช้ฟรี</LinkButton>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 text-center sm:pt-20">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
          ระบบจองคิวออนไลน์ สำหรับทุกธุรกิจบริการ
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          ร้านเสริมสวย คลินิก ร้านซ่อมรถ สตูดิโอ ฟิตเนส ที่ปรึกษา — เปิดหน้าจองของร้านคุณได้ในไม่กี่นาที
          โดยไม่ต้องทำเว็บไซต์ใหม่
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/signup" className="px-6 py-3 text-base">
            สร้างร้านของคุณ
          </LinkButton>
          <LinkButton href="/login" variant="secondary" className="px-6 py-3 text-base">
            เข้าสู่ระบบร้านค้า
          </LinkButton>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} SYSRENT.SHOP
      </footer>
    </main>
  );
}
