"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const items = [
  { href: "", label: "ภาพรวม" },
  { href: "/appointments", label: "คิว / นัดหมาย" },
  { href: "/services", label: "บริการ" },
  { href: "/staff", label: "พนักงาน" },
  { href: "/branches", label: "สาขา & วันหยุด" },
  { href: "/customers", label: "ลูกค้า" },
  { href: "/settings", label: "ตั้งค่า" },
];

export function DashboardNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${slug}`;
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3">
      {items.map((it) => {
        const href = base + it.href;
        const active = it.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={it.href}
            href={href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm",
              active ? "bg-brand/10 font-medium text-brand" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
