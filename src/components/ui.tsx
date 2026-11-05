import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { AppointmentStatus } from "@/modules/booking/types";
import { STATUS_LABELS } from "@/modules/booking/types";
import { IconPaw } from "@/components/icons";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const buttonVariants = {
  primary: "btn-candy text-[var(--brand-fg,#fff)] disabled:opacity-50 disabled:saturate-50",
  secondary:
    "bg-white text-[color:color-mix(in_srgb,var(--brand)_75%,black)] border-2 border-[color:color-mix(in_srgb,var(--brand)_28%,white)] shadow-sm hover:bg-[color:color-mix(in_srgb,var(--brand)_6%,white)] disabled:opacity-50",
  danger: "bg-red-500 text-white shadow-sm hover:bg-red-600 disabled:opacity-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

const buttonBase =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-display font-medium transition-[background-color,border-color,color,filter,transform,box-shadow] duration-150 active:translate-y-px focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 cursor-pointer disabled:cursor-not-allowed disabled:active:translate-y-0";

type ButtonProps = ComponentProps<"button"> & { variant?: keyof typeof buttonVariants; size?: "sm" | "md" | "lg" };

const sizes = { sm: "h-9 px-4 text-[13px]", md: "h-11 px-5 text-[15px]", lg: "h-14 px-7 text-lg" };

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={cn(buttonBase, sizes[size], buttonVariants[variant], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonVariants; size?: "sm" | "md" | "lg" }) {
  return <Link className={cn(buttonBase, sizes[size], buttonVariants[variant], className)} {...props} />;
}

/** Field label: a soft peach tag with a paw. */
export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[color:color-mix(in_srgb,var(--brand)_14%,white)] px-3 font-display text-[13px] font-medium text-[color:color-mix(in_srgb,var(--brand)_70%,black)]">
        <IconPaw size={13} className="text-brand" />
        {children}
      </span>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const fieldClass =
  "w-full border-2 border-[color:color-mix(in_srgb,var(--brand)_16%,white)] bg-white px-5 text-[15px] text-slate-900 shadow-[inset_0_2px_4px_rgb(150_70_20/0.06)] transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-[color:color-mix(in_srgb,var(--brand)_30%,white)] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 disabled:bg-slate-100 disabled:text-slate-500";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, "h-12 rounded-full", className)} {...props} />;
}

/** Pill input with a leading icon and a divider, like the login card. */
export function IconInput({ icon, className, trailing, ...props }: ComponentProps<"input"> & { icon: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-3 pl-5 text-brand">
        {icon}
        <span className="h-6 w-0.5 rounded-full bg-[color:color-mix(in_srgb,var(--brand)_22%,white)]" />
      </span>
      <input className={cn(fieldClass, "h-[52px] rounded-full pl-[68px]", trailing ? "pr-14" : "", className)} {...props} />
      {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "min-h-24 rounded-3xl py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClass, "h-12 rounded-full pr-10", className)} {...props} />;
}

export function Field({
  label,
  name,
  hint,
  icon,
  className,
  ...props
}: ComponentProps<"input"> & { label: string; name: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className={className}>
      <Label htmlFor={name} hint={hint}>
        {label}
      </Label>
      {icon ? <IconInput id={name} name={name} icon={icon} {...props} /> : <Input id={name} name={name} {...props} />}
    </div>
  );
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-[var(--brand)]" {...props} />
      {label}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-3xl border-2 border-white bg-white/85 p-6 shadow-md ring-1 ring-slate-200/70 backdrop-blur-sm", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3 border-b-2 border-dashed border-slate-200 pb-5">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const statusDot: Record<AppointmentStatus, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-sky-600",
  checked_in: "bg-violet-600",
  completed: "bg-emerald-600",
  cancelled: "bg-slate-400",
  no_show: "bg-red-600",
  expired: "bg-slate-300",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const muted = status === "cancelled" || status === "expired";
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-medium",
        muted ? "text-slate-500" : "text-slate-700",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDot[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
  };
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-2xl border px-4 py-3 text-sm leading-relaxed", tones[tone])}>
      {children}
    </div>
  );
}

/** Text colour (white or ink) that stays readable on a shop's brand colour. */
export function brandForeground(hex: string | null | undefined) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.18 ? "#171716" : "#ffffff";
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);
}

export const TIMEZONES = [
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Jakarta",
  "Asia/Ho_Chi_Minh",
  "Asia/Manila",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "Australia/Sydney",
  "UTC",
];
