"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { IconCalendar, IconContact, IconHome, IconSettings, IconStore, IconTag, IconUsers } from "@/components/icons";

const items = [
  { href: "", label: "ภาพรวม", Icon: IconHome },
  { href: "/appointments", label: "คิว / นัดหมาย", Icon: IconCalendar },
  { href: "/services", label: "บริการ", Icon: IconTag },
  { href: "/staff", label: "พนักงาน", Icon: IconUsers },
  { href: "/branches", label: "สาขา & วันหยุด", Icon: IconStore },
  { href: "/customers", label: "ลูกค้า", Icon: IconContact },
  { href: "/settings", label: "ตั้งค่า", Icon: IconSettings },
];

export function DashboardNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${slug}`;
  return (
    <nav className="flex gap-0.5 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
      {items.map(({ href: h, label, Icon }) => {
        const href = base + h;
        const active = h === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={h}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
              active
                ? "bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200"
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
