# SYSRENT Booking — Universal Booking SaaS

ระบบจองคิวออนไลน์แบบ Multi-Tenant ด้วย **Next.js 16 (App Router)** + **Supabase (PostgreSQL / Auth / RLS)**

- หน้าจองสาธารณะสำหรับลูกค้า (mobile-first) — `/s/<slug>` หรือ `<slug>.sysrent.shop` หรือ Custom Domain
- Dashboard ร้านค้า — `/dashboard/<slug>`
- Super Admin — `/platform`

---

## เริ่มต้นใช้งาน (Local)

```bash
npm install
cp .env.example .env.local        # ใส่ค่า Supabase ของคุณ
npx supabase login
npx supabase link --project-ref <project-ref>   # ใช้ project STAGING ก่อน
npm run db:push                   # รัน migrations ใน supabase/migrations
npm run dev                       # http://localhost:3000
```

1. สมัครบัญชีที่ `/signup` → สร้างร้าน → เพิ่มบริการ / พนักงาน / เวลาทำงาน
2. เปิดหน้าร้าน `/s/<slug>` แล้วลองจอง
3. ตั้งตัวเองเป็น Super Admin (รันใน SQL Editor):
   ```sql
   insert into public.booking_platform_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

> ทดสอบ subdomain บนเครื่อง: เปิด `http://<slug>.localhost:3000` (เบราว์เซอร์ส่วนใหญ่ resolve `*.localhost` ให้อัตโนมัติ)

### คำสั่งที่ใช้บ่อย

| คำสั่ง | หน้าที่ |
| --- | --- |
| `npm run dev` | dev server |
| `npm test` | unit tests + DB tests (รัน migrations จริงบน PGlite: RLS, กันจองชน, quota) |
| `npm run lint` / `npm run typecheck` | ตรวจโค้ด |
| `npm run db:push` | ส่ง migrations ขึ้น Supabase ที่ link ไว้ |
| `npm run db:types` | สร้าง TypeScript types จาก schema |
| `npm run test:concurrency -- --url ... --tenant ... --service ... --branch ... --date ...` | ยิงจอง slot เดียวกันพร้อมกัน (staging เท่านั้น) |

---

## สถาปัตยกรรม

```
src/
  proxy.ts                      # (Next 16 แทน middleware) refresh session + map hostname → tenant
  app/
    s/[slug]/                   # หน้าร้านสาธารณะ + booking flow
    b/[reference]/              # ลูกค้าดู/ยกเลิกการจอง (ต้องมี token ลับ)
    dashboard/[slug]/           # Merchant: overview, appointments, services, staff, branches, customers, settings
    platform/                   # Super Admin: tenants, plans, audit logs
    api/public/...              # availability, bookings, cancel (rate limited)
    api/booking/appointments/   # merchant: เปลี่ยนสถานะ/เลื่อนนัด/โน้ต
    api/cron/notifications      # worker: ส่งแจ้งเตือน + หมดอายุ hold
  lib/supabase/{browser,server,admin}.ts   # แยก client; admin (service role) ใช้ฝั่ง server เท่านั้น
  modules/booking/
    availability.ts             # คำนวณเวลาว่าง (pure function, มี unit test)
    booking-service.ts          # ตรวจ slot ซ้ำแล้วจองผ่าน RPC แบบ transaction
    schemas.ts                  # Zod validation ทุก input
  modules/notifications/        # outbox + retry/backoff + dedup
supabase/migrations/            # schema, RLS, functions, grants
tests/                          # unit + db tests
```

### หลักความปลอดภัยที่ใช้

- **ทุกตารางของร้านมี `tenant_id` + เปิด RLS** — ร้าน A อ่าน/แก้ข้อมูลร้าน B ไม่ได้แม้เรียก API ตรง (มี test)
- **ไม่เชื่อ `tenant_id` จาก client** — server หา tenant จาก membership ของ session หรือจาก slug/โดเมนที่ verify แล้ว
- **กันจองชนที่ระดับฐานข้อมูล** — `booking_allocations` มี `EXCLUDE USING gist (resource_id =, during &&)` รวม buffer ก่อน/หลัง แม้มีคำขอพร้อมกันก็สร้างรายการทับซ้อนไม่ได้
- **การจองทำใน function เดียว (transaction)**: upsert ลูกค้า → สร้างนัด → allocate เวลา → log event; มี idempotency key กันกดซ้ำ
- `booking_create_appointment` / `booking_cancel_by_customer` เรียกได้เฉพาะ `service_role` (server) — anon เรียกตรงไม่ได้
- Quota ตามแพ็กเกจ (สาขา/พนักงาน/บริการ/การจองต่อเดือน) บังคับด้วย trigger ใน DB → ใช้ได้ทั้ง UI และ API
- เจ้าของร้านเปลี่ยนแพ็กเกจ/สถานะตัวเองไม่ได้ (trigger) — Super Admin เท่านั้น และมี audit log
- Proxy ตอบ 404 กับ hostname ที่ไม่รู้จัก (กัน Host Header Injection); custom domain ใช้ได้เฉพาะสถานะ `active` หลังตรวจ TXT record
- Public API มี rate limit + honeypot กัน spam; ลูกค้าเห็นเฉพาะช่วงเวลาว่าง ไม่เห็นข้อมูลการจองของคนอื่น

### Booking engine

เวลาว่าง = เวลาทำงานของพนักงาน (ตาม timezone ของสาขา) − นัดที่มีอยู่ (รวม buffer) − วันลา/วันหยุดสาขา
− เวลาที่น้อยกว่า "จองล่วงหน้าขั้นต่ำ" และไกลกว่า "จองล่วงหน้าสูงสุด". เวลาเก็บเป็น `timestamptz` ทั้งหมด

สถานะนัด: `pending → confirmed → checked_in → completed`, และ `cancelled`, `no_show`, `expired` (ตรวจ transition ใน DB)

---

## Deploy (Vercel + Supabase)

1. สร้าง Supabase 2 project: **staging** และ **production** (secrets แยกกัน)
2. `supabase link` → `npm run db:push` ทีละ environment
3. ตั้ง Environment Variables บน Vercel ตาม `.env.example` (`SUPABASE_SECRET_KEY` ห้ามขึ้นต้นด้วย `NEXT_PUBLIC_`)
4. โดเมน: เพิ่ม `sysrent.shop` และ wildcard `*.sysrent.shop` ใน Vercel (ต้องใช้ Vercel nameservers สำหรับ wildcard cert)
5. Supabase Auth → URL Configuration: Site URL = `https://sysrent.shop`, Redirect URLs เพิ่ม `https://sysrent.shop/auth/confirm`
6. ตั้ง `CRON_SECRET` — Vercel Cron เรียก `/api/cron/notifications` ทุกนาทีตาม `vercel.json` (ต้องใช้ Vercel Pro; ถ้าไม่มี ใช้ scheduler ภายนอก หรือ `pg_cron` + `pg_net`)
7. Custom domain ของร้าน: ร้านเพิ่ม CNAME → `cname.sysrent.shop` + TXT `_sysrent-verify.<host>` แล้วกด “ตรวจสอบ DNS”
   — จุดที่ต้องต่อ API ของ hosting เพื่อออก TLS อยู่ใน `verifyDomain()` ([src/app/dashboard/[slug]/actions.ts](src/app/dashboard/[slug]/actions.ts))

CI (`.github/workflows/ci.yml`): lint → typecheck → tests (รวม DB tests) → build

---

## สถานะตามแผน 10 Phase

| Phase | สถานะ |
| --- | --- |
| 1 Audit & Planning | โปรเจกต์ใหม่ (ไม่ได้รับโค้ด SYSRENT เดิม) — **ยังต้อง audit ระบบเดิมก่อนเชื่อม** |
| 2 Database & RLS | ✅ schema, RLS, constraints, indexes, migrations, tests tenant isolation |
| 3 Backend & Auth | ✅ service layer, Route Handlers/Server Actions, RBAC (owner/admin/manager/staff/platform_admin), Zod, rate limit, audit log, idempotency |
| 4 Booking Engine | ✅ availability, timezone/DST, buffer, exclusion constraint, สถานะ, เลื่อนนัด, events — hold/expiry พร้อมใช้เมื่อมีชำระเงิน |
| 5 Public Booking | ✅ หน้าร้าน, booking flow, หน้า success/detail/cancel, ธีมร้าน, SEO/OG, loading/error states |
| 6 Merchant Dashboard | ✅ overview, ปฏิทินรายวัน/สัปดาห์ + filter, CRUD บริการ/สาขา/พนักงาน/เวลาทำงาน/วันลา, ลูกค้า, นโยบายการจอง, walk-in |
| 7 Super Admin & Subscription | ✅ tenants, plans/quotas, status, audit log — ⏳ **ยังไม่เชื่อม billing เดิม** (ทำ adapter + webhook หลัง audit) |
| 8 Domain & Notifications | ✅ subdomain, custom domain + DNS verify, outbox email (Resend) + retry — ⏳ TLS provisioning API, SMS/LINE |
| 9 Testing | ✅ unit + DB tests + concurrency script — ⏳ E2E (Playwright), load test, security review |
| 10 Deploy | ✅ CI, vercel.json, env แยก — ⏳ Sentry/monitoring, backup drill, pilot |

### งานถัดไปที่แนะนำ
- เชิญสมาชิกทีมเข้าร้าน (invite by email) — ตอนนี้ role มีใน DB แล้วแต่ยังไม่มี UI เชิญ
- จัดการทรัพยากร (ห้อง/อุปกรณ์) ใน booking engine — ตาราง `booking_resources` + allocations รองรับแล้ว
- ลูกค้าเลื่อนนัดเอง, waitlist, recurring
- Rate limiter แบบ Redis/Upstash เมื่อรันหลาย instance
- เชื่อมระบบ OTP/สมาชิก/Payment เดิมของ SYSRENT ผ่าน adapter
