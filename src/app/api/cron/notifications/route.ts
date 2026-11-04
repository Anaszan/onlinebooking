import { NextResponse, type NextRequest } from "next/server";
import { processNotifications } from "@/modules/notifications/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Worker endpoint — call every minute from Vercel Cron / any scheduler with
 *   Authorization: Bearer $CRON_SECRET
 * Processes the notification outbox and expires unpaid holds.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "unauthorized" } }, { status: 401 });
  }
  const db = createAdminClient();
  const { data: expired } = await db.rpc("booking_expire_holds");
  const result = await processNotifications(50);
  return NextResponse.json({ data: { ...result, expiredHolds: expired ?? 0 } });
}
