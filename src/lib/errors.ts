import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Standard error envelope: { error: { code, message, details? } } */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface PgLikeError {
  code?: string;
  message?: string;
}

const MESSAGES: Record<string, [number, string]> = {
  SLOT_TAKEN: [409, "ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น"],
  QUOTA_EXCEEDED: [402, "เกินโควตาของแพ็กเกจปัจจุบัน กรุณาอัปเกรดแพ็กเกจ"],
  TENANT_UNAVAILABLE: [403, "ร้านนี้ปิดรับการจองชั่วคราว"],
  TOO_LATE_TO_BOOK: [422, "ไม่สามารถจองล่วงหน้าน้อยกว่าที่ร้านกำหนดได้"],
  CANCEL_WINDOW_CLOSED: [422, "เลยเวลาที่สามารถยกเลิกได้แล้ว กรุณาติดต่อร้าน"],
  INVALID_TRANSITION: [422, "ไม่สามารถเปลี่ยนสถานะนี้ได้"],
  STAFF_CANNOT_PERFORM_SERVICE: [422, "พนักงานคนนี้ไม่ได้ให้บริการนี้"],
  SLUG_RESERVED: [422, "ชื่อร้าน (slug) นี้ถูกสงวนไว้"],
  PET_REQUIRED: [422, "กรุณากรอกชื่อและประเภทสัตว์เลี้ยง"],
  SPECIES_NOT_SUPPORTED: [422, "บริการนี้ไม่รองรับสัตว์เลี้ยงประเภทนี้"],
  INVALID_PHOTO: [422, "รูปสัตว์เลี้ยงไม่ถูกต้อง"],
  FORBIDDEN: [403, "คุณไม่มีสิทธิ์ทำรายการนี้"],
  NOT_FOUND: [404, "ไม่พบข้อมูล"],
  UNAUTHENTICATED: [401, "กรุณาเข้าสู่ระบบ"],
};

/** Map Supabase/Postgres errors to AppError with stable codes. */
export function fromDbError(err: PgLikeError): AppError {
  const msg = err.message ?? "";
  if (err.code === "23P01") return new AppError("SLOT_TAKEN", MESSAGES.SLOT_TAKEN[1], 409);
  if (err.code === "23505") {
    if (msg.includes("slug")) return new AppError("CONFLICT", "slug นี้ถูกใช้แล้ว", 409);
    if (msg.includes("hostname")) return new AppError("CONFLICT", "โดเมนนี้ถูกใช้แล้ว", 409);
    return new AppError("CONFLICT", "ข้อมูลซ้ำ", 409);
  }
  if (err.code === "23514") return new AppError("VALIDATION", "ข้อมูลไม่ถูกต้อง", 422);
  if (err.code === "23503") return new AppError("IN_USE", "ข้อมูลนี้ถูกใช้งานอยู่ (มีประวัติการจอง) จึงลบไม่ได้", 409);
  if (err.code === "42501" || /row-level security/i.test(msg)) {
    return new AppError("FORBIDDEN", MESSAGES.FORBIDDEN[1], 403);
  }
  for (const key of Object.keys(MESSAGES)) {
    if (msg.startsWith(key)) {
      const [status, text] = MESSAGES[key];
      return new AppError(key, text, status);
    }
  }
  console.error("[db-error]", err.code, msg);
  return new AppError("INTERNAL", "เกิดข้อผิดพลาด กรุณาลองใหม่", 500);
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "ข้อมูลไม่ถูกต้อง", details: err.issues } },
      { status: 422 },
    );
  }
  console.error("[unhandled]", err);
  return NextResponse.json({ error: { code: "INTERNAL", message: "เกิดข้อผิดพลาด" } }, { status: 500 });
}

/** For server actions: return a serialisable result instead of throwing. */
export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

export function actionError(err: unknown): { ok: false; error: string } {
  if (err instanceof AppError) return { ok: false, error: err.message };
  if (err instanceof ZodError) return { ok: false, error: err.issues.map((i) => i.message).join(", ") };
  if (err && typeof err === "object" && "code" in err) return { ok: false, error: fromDbError(err as PgLikeError).message };
  // Next.js redirect()/notFound() must propagate
  throw err;
}
