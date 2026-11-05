import { IconChevronRight, IconPaw } from "@/components/icons";
import { LinkButton } from "@/components/ui";
import type { ReactNode } from "react";

/** "ยังไม่มีบัญชี?" divider + secondary pill, under the auth forms. */
export function AuthSwitch({ question, href, label, icon }: { question: string; href: string; label: string; icon: ReactNode }) {
  return (
    <div className="mt-7">
      <div className="flex items-center gap-3 text-brand" aria-hidden="false">
        <span className="h-0.5 flex-1 rounded-full bg-gradient-to-r from-transparent to-[#f6c9a4]" />
        <IconPaw size={14} />
        <span className="font-display text-sm text-slate-600">{question}</span>
        <IconPaw size={14} />
        <span className="h-0.5 flex-1 rounded-full bg-gradient-to-l from-transparent to-[#f6c9a4]" />
      </div>
      <LinkButton href={href} variant="secondary" size="lg" className="mt-4 w-full justify-between px-6 text-[17px]">
        <span className="inline-flex items-center gap-2.5">
          {icon}
          {label}
        </span>
        <IconChevronRight size={20} strokeWidth={2.25} />
      </LinkButton>
    </div>
  );
}
