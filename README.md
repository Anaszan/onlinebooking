# ระบบจองคิวร้านอาบน้ำ ตัดขน & ดูแลสัตว์เลี้ยง

เว็บจองคิวสำหรับ **ร้านเดียว** — Next.js 16 (App Router) + Supabase (PostgreSQL / Auth / Storage / RLS)

| ฝั่ง | หน้า | ทำอะไรได้ |
| --- | --- | --- |
| **ลูกค้า** | `/` | ดูบริการ (แยกหมวด/ประเภทสัตว์) → เลือกพนักงาน → ดูช่วงเวลาว่าง → กรอกข้อมูลสัตว์เลี้ยง + **อัปโหลดรูป** → ได้เลขอ้างอิง ดู/ยกเลิกได้ที่ `/b/<เลขอ้างอิง>` (ไม่ต้องสมัครสมาชิก) |
| **พนักงาน** | `/dashboard` | “งานของฉัน” / คิวทั้งร้าน, เห็นรูปและข้อควรระวังของน้อง, เปลี่ยนสถานะ (ยืนยัน/เช็กอิน/เสร็จ/ไม่มา), **ดูว่าใครรับงานได้บ้าง** แล้วมอบหมายหรือกด “รับงานนี้” |
| **ผู้ดูแล (เจ้าของร้าน)** | `/dashboard` | ทุกอย่างของพนักงาน + เปลี่ยนชื่อร้าน, **โลโก้/รูปปก**, **สีธีม**, เพิ่ม/ลด **บริการ**, เพิ่ม **พนักงาน** + สร้างบัญชีเข้าระบบ, เวลาทำงาน, วันหยุด, นโยบายการจอง |

สิทธิ์: `owner` / `admin` (ตั้งค่าร้านได้) · `manager` (จัดการบริการ/พนักงาน) · `staff` (จัดการคิว) — บังคับทั้งใน UI, server และ RLS ของฐานข้อมูล

---

## เริ่มใช้งาน

1. สร้าง Supabase project แล้วรัน [supabase/setup-all.sql](supabase/setup-all.sql) ใน **SQL Editor**
   (ถ้าเคยรันไฟล์เก่าไปแล้ว ให้รันเฉพาะไฟล์ใน `supabase/migrations/` ที่ยังไม่ได้รัน ตามลำดับ)
2. `cp .env.example .env.local` แล้วใส่ URL, publishable key และ **secret key**
3. `npm install && npm run dev` → เปิด http://localhost:3000
4. ครั้งแรกจะเข้าหน้า **ตั้งค่าร้าน** (`/setup`) — ใส่ชื่อร้าน + อีเมล/รหัสผ่านเจ้าของร้าน (ทำได้ครั้งเดียว)
5. ใน Dashboard: ตั้งค่าร้าน (โลโก้ สี) → เพิ่มบริการ → เพิ่มพนักงาน + เวลาทำงาน → แชร์ลิงก์หน้าแรกให้ลูกค้า

> แนะนำ: หลังตั้งค่าร้านแล้ว ปิด **Authentication → Sign In / Providers → Allow new users to sign up** ใน Supabase
> (บัญชีพนักงานสร้างโดยผู้ดูแลจากหน้า “พนักงาน” ซึ่งยังใช้ได้ตามปกติ) และตั้ง `SETUP_TOKEN` ถ้า deploy สาธารณะ

## คำสั่ง

| คำสั่ง | หน้าที่ |
| --- | --- |
| `npm run dev` | dev server |
| `npm test` | unit + DB tests (รัน migrations จริงบน PGlite: RLS, กันจองชน, ข้อมูลสัตว์เลี้ยง, สิทธิ์) |
| `npm run lint` / `npm run typecheck` | ตรวจโค้ด |
| `npm run db:push` | ส่ง migrations ขึ้น Supabase ด้วย CLI (ทางเลือกแทน SQL Editor) |

## โครงสร้าง

```
src/app/
  (shop)/            หน้าร้าน "/" + "/book/[serviceId]" (booking flow)
  b/[reference]/     ลูกค้าดู/ยกเลิกการจอง (ต้องมี token ลับในลิงก์)
  (auth)/            /login (พนักงาน/ผู้ดูแล), /setup (ตั้งค่าร้านครั้งแรก)
  dashboard/         หลังร้าน: overview, appointments, customers, services, staff, branches, settings
  account/           เปลี่ยนรหัสผ่าน
  api/public/...     availability, bookings (multipart + รูปสัตว์เลี้ยง), cancel
src/modules/booking/ availability.ts (คำนวณเวลาว่าง), eligibility.ts (ใครรับงานได้), booking-service.ts
supabase/migrations/ schema, RLS, functions, storage buckets
```

## ความปลอดภัย / ความถูกต้อง

- **ไม่มีจองชน**: exclusion constraint ใน DB (รวม buffer) — แม้กดจองพร้อมกันหรือมอบหมายงานซ้อนก็ไม่ผ่าน
- รูปสัตว์เลี้ยงเก็บใน bucket `pet-photos` แบบ **private** — ดูได้ผ่าน signed URL เฉพาะพนักงานของร้าน/ลูกค้าเจ้าของการจอง
  ตรวจชนิดไฟล์จาก magic bytes (JPG/PNG/WEBP, ≤ 5 MB) ไม่เชื่อนามสกุลไฟล์
- โลโก้/รูปปกอยู่ใน bucket `shop-assets` (public) อัปโหลดได้เฉพาะผู้ดูแล
- Service role key ใช้ฝั่ง server เท่านั้น; ฟังก์ชันจอง/ตั้งค่าร้าน เรียกได้เฉพาะ server
- Rate limit + honeypot กัน spam ที่ API จอง

## Deploy (Vercel + Supabase)

ตั้ง env ตาม `.env.example` · Supabase Auth → URL Configuration: Site URL = โดเมนร้าน ·
`CRON_SECRET` สำหรับ `/api/cron/notifications` (ส่งอีเมลแจ้งเตือนผ่าน Resend ถ้าตั้ง `RESEND_API_KEY`)
