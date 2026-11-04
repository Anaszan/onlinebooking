"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-lg font-semibold">เกิดข้อผิดพลาด</h1>
      <p className="mt-1 text-sm text-slate-500">กรุณาลองใหม่อีกครั้ง{error.digest ? ` (รหัส ${error.digest})` : ""}</p>
      <Button className="mt-6" onClick={() => retry()}>
        ลองใหม่
      </Button>
    </main>
  );
}
