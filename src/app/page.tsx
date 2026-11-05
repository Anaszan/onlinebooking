import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { IconArrowRight, IconPaw } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { Wordmark } from "@/components/wordmark";
import { BookingDemo } from "@/components/landing/booking-demo";

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
    <main className="paw-wallpaper flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" aria-label="SYSRENT Booking หน้าแรก">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link href="/login" className="rounded-lg px-3 py-2 text-slate-600 transition-colors hover:text-slate-900">
            เข้าสู่ระบบ
          </Link>
          <LinkButton href="/signup" size="sm">
            เริ่มใช้ฟรี
          </LinkButton>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
        <h1 className="max-w-[17ch] text-[2.5rem] leading-[1.25] text-slate-900 sm:text-[3.6rem]">
          ระบบจองคิวออนไลน์ สำหรับทุกธุรกิจบริการ
        </h1>
        <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:items-end">
          <p className="max-w-[54ch] text-lg leading-relaxed text-slate-600 lg:col-span-7">
            ร้านเสริมสวย คลินิก ร้านซ่อมรถ สตูดิโอ ฟิตเนส ที่ปรึกษา — เปิดหน้าจองของร้านคุณได้ในไม่กี่นาที โดยไม่ต้องทำเว็บไซต์ใหม่
          </p>
          <div className="flex flex-wrap gap-2.5 lg:col-span-5 lg:justify-end">
            <LinkButton href="/signup" size="lg">
              สร้างร้านของคุณ
              <IconArrowRight />
            </LinkButton>
            <LinkButton href="/login" variant="secondary" size="lg">
              เข้าสู่ระบบร้านค้า
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 pb-24 pt-[118px] sm:px-6 sm:pt-[142px]">
        <Mascot className="pointer-events-none absolute left-6 top-0 z-10 w-[190px] sm:left-12 sm:w-[230px]" />
        <BookingDemo />
      </section>

      <section className="rounded-t-[3rem] border-t-[3px] border-white bg-[#fffdf9] shadow-[0_-20px_40px_-30px_rgb(200_90_20/0.3)]">
        <dl className="mx-auto grid max-w-6xl gap-x-10 gap-y-10 px-4 py-16 sm:grid-cols-2 sm:px-6 sm:py-20 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title}>
              <dt className="flex items-center gap-2.5 font-display text-lg text-slate-900">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/12 text-brand">
                  <IconPaw size={18} />
                </span>
                {f.title}
              </dt>
              <dd className="mt-2 max-w-[38ch] pl-[46px] text-[15px] leading-relaxed text-slate-600">{f.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-[#fffdf9]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[2.25rem] bg-gradient-to-br from-[#ffe2c8] to-[#ffd0a8] px-6 py-10 sm:mx-6 sm:px-10 md:flex-row md:items-center lg:mx-auto">
          <p className="max-w-[30ch] font-display text-2xl leading-snug text-slate-900">
            เปิดหน้าจองของร้านคุณได้ในไม่กี่นาที โดยไม่ต้องทำเว็บไซต์ใหม่
          </p>
          <LinkButton href="/signup" size="lg">
            เริ่มใช้ฟรี
            <IconArrowRight />
          </LinkButton>
        </div>
      </section>

      <footer className="bg-[#fffdf9] pt-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-slate-500 sm:px-6">
          <span>© {new Date().getFullYear()} SYSRENT.SHOP</span>
          <Link href="/login" className="hover:text-slate-900">
            เข้าสู่ระบบร้านค้า
          </Link>
        </div>
      </footer>
    </main>
  );
}
