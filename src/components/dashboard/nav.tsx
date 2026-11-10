"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { IconCalendar, IconContact, IconHome, IconSettings, IconStore, IconTag, IconUsers } from "@/components/icons";

// level: 0 = every member (incl. staff), 1 = owner/admin/manager, 2 = owner/admin
const items = [
  { href: "", label: "ภาพรวม", Icon: IconHome, level: 0 },
  { href: "/appointments", label: "คิว / นัดหมาย", Icon: IconCalendar, level: 0 },
  { href: "/customers", label: "ลูกค้า & สัตว์เลี้ยง", Icon: IconContact, level: 0 },
  { href: "/services", label: "บริการ", Icon: IconTag, level: 1 },
  { href: "/staff", label: "พนักงาน", Icon: IconUsers, level: 1 },
  { href: "/branches", label: "สาขา & วันหยุด", Icon: IconStore, level: 1 },
  { href: "/settings", label: "ตั้งค่าร้าน", Icon: IconSettings, level: 2 },
];

export function DashboardNav({ level }: { level: 0 | 1 | 2 }) {
  const pathname = usePathname();
  const base = "/dashboard";
  return (
    <nav className="flex gap-0.5 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
      {items.filter((it) => it.level <= level).map(({ href: h, label, Icon }) => {
        const href = base + h;
        const active = h === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={h}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2.5 rounded-full px-3.5 text-sm transition-colors",
              active
                ? "bg-white font-display text-slate-900 shadow-md ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900",
            )}
          >
            <Icon size={16} className={active ? "text-brand" : "text-slate-400"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
