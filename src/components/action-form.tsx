"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/errors";
import { Alert, Button } from "@/components/ui";

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/**
 * Generic form wired to a server action that returns ActionResult.
 * Shows success / error messages and optionally resets on success.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "บันทึก",
  resetOnSuccess = false,
  className,
  submitVariant = "primary",
  confirm,
  submitIcon,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  className?: string;
  submitVariant?: "primary" | "secondary" | "danger" | "ghost";
  confirm?: string;
  submitIcon?: ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className ?? "space-y-4"}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state && !state.ok && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && state.message && <Alert tone="success">{state.message}</Alert>}
      <SubmitButton label={submitLabel} variant={submitVariant} icon={submitIcon} />
    </form>
  );
}

export function SubmitButton({
  label,
  variant = "primary",
  icon,
}: {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={icon ? "lg" : variant === "primary" ? "md" : "sm"}>
      {!pending && icon}
      {pending ? "กำลังดำเนินการ..." : label}
    </Button>
  );
}
