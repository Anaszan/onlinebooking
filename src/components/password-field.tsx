"use client";

import { useState, type ComponentProps } from "react";
import { IconInput, Label } from "@/components/ui";
import { IconEye, IconEyeOff, IconLock } from "@/components/icons";

export function PasswordField({ label, name, hint, ...props }: ComponentProps<"input"> & { label: string; name: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label htmlFor={name} hint={hint}>
        {label}
      </Label>
      <IconInput
        id={name}
        name={name}
        type={show ? "text" : "password"}
        icon={<IconLock size={20} strokeWidth={2} />}
        trailing={
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            aria-pressed={show}
            className="flex h-10 w-10 items-center justify-center rounded-full text-brand transition-colors hover:bg-brand/10"
          >
            {show ? <IconEye size={20} strokeWidth={2} /> : <IconEyeOff size={20} strokeWidth={2} />}
          </button>
        }
        {...props}
      />
    </div>
  );
}
