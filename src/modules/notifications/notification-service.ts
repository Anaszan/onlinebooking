import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/time";

/**
 * Notification outbox (Phase 8).
 *  - enqueue: insert rows with a unique dedup_key (no duplicate sends)
 *  - process: claim with SKIP LOCKED, send, retry with exponential backoff
 * Providers: email via Resend (RESEND_API_KEY). Without a provider rows are
 * marked "skipped" and logged so the flow still works in development.
 */

const MAX_ATTEMPTS = 5;

interface OutboxRow {
  id: string;
  channel: "email" | "sms" | "line" | "webhook";
  recipient: string;
  template: string;
  payload: Record<string, string>;
  attempts: number;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function notifyBookingCreated(appointmentId: string) {
  const db = createAdminClient();
  const { data: a } = await db
    .from("booking_appointments")
    .select(
      `id, tenant_id, reference_code, access_token, starts_at, status,
       tenant:booking_tenants(name, contact_email),
       service:booking_services(name),
       branch:booking_branches(name, timezone),
       customer:booking_customers(full_name, email, phone)`,
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (!a) return;

  const row = a as unknown as {
    id: string;
    tenant_id: string;
    reference_code: string;
    access_token: string;
    starts_at: string;
    status: string;
    tenant: { name: string; contact_email: string | null };
    service: { name: string };
    branch: { name: string; timezone: string };
    customer: { full_name: string; email: string | null; phone: string };
  };

  const payload = {
    shop: row.tenant.name,
    service: row.service.name,
    branch: row.branch.name,
    when: formatDateTime(row.starts_at, row.branch.timezone),
    reference: row.reference_code,
    customer: row.customer.full_name,
    phone: row.customer.phone,
    link: `${env.appUrl.replace(/\/$/, "")}/b/${row.reference_code}?t=${row.access_token}`,
  };

  const rows = [];
  if (row.customer.email) {
    rows.push({
      tenant_id: row.tenant_id,
      appointment_id: row.id,
      channel: "email",
      recipient: row.customer.email,
      template: "booking_created_customer",
      payload,
      dedup_key: `appt:${row.id}:created:customer`,
    });
  }
  if (row.tenant.contact_email) {
    rows.push({
      tenant_id: row.tenant_id,
      appointment_id: row.id,
      channel: "email",
      recipient: row.tenant.contact_email,
      template: "booking_created_merchant",
      payload: { ...payload, link: `${env.appUrl.replace(/\/$/, "")}/dashboard` },
      dedup_key: `appt:${row.id}:created:merchant`,
    });
  }
  if (rows.length === 0) return;

  await db.from("booking_notifications").upsert(rows, { onConflict: "dedup_key", ignoreDuplicates: true });
  await processNotifications(10);
}

function render(template: string, p: Record<string, string>) {
  const e = (k: string) => escapeHtml(p[k] ?? "");
  if (template === "booking_created_merchant") {
    return {
      subject: `มีการจองใหม่ ${p.reference} — ${p.service}`,
      html: `<p>มีการจองใหม่ที่ <b>${e("shop")}</b></p>
             <p>${e("customer")} (${e("phone")})<br>${e("service")} — ${e("branch")}<br>${e("when")}</p>
             <p>เลขอ้างอิง: <b>${e("reference")}</b></p>
             <p><a href="${e("link")}">เปิด Dashboard</a></p>`,
    };
  }
  return {
    subject: `ยืนยันการจอง ${p.reference} — ${p.shop}`,
    html: `<p>สวัสดีคุณ ${e("customer")}</p>
           <p>การจองของคุณที่ <b>${e("shop")}</b> ได้รับแล้ว</p>
           <p>${e("service")} — ${e("branch")}<br>${e("when")}</p>
           <p>เลขอ้างอิง: <b>${e("reference")}</b></p>
           <p><a href="${e("link")}">ดู / ยกเลิกการจอง</a></p>`,
  };
}

async function send(row: OutboxRow): Promise<"sent" | "skipped"> {
  if (row.channel !== "email") return "skipped";
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;
  const { subject, html } = render(row.template, row.payload);
  if (!apiKey || !from) {
    console.info(`[notify:dev] would email ${row.recipient}: ${subject}`);
    return "skipped";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": row.id,
    },
    body: JSON.stringify({ from, to: [row.recipient], subject, html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return "sent";
}

export async function processNotifications(limit = 20) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("booking_claim_notifications", { p_limit: limit });
  if (error) throw error;
  const rows = (data ?? []) as OutboxRow[];
  let sent = 0,
    failed = 0;

  for (const row of rows) {
    try {
      const result = await send(row);
      await db
        .from("booking_notifications")
        .update({ status: result, sent_at: result === "sent" ? new Date().toISOString() : null, last_error: null })
        .eq("id", row.id);
      sent++;
    } catch (e) {
      failed++;
      const giveUp = row.attempts >= MAX_ATTEMPTS;
      const backoffMin = 2 ** row.attempts; // 2, 4, 8, 16 minutes
      await db
        .from("booking_notifications")
        .update({
          status: giveUp ? "failed" : "pending",
          next_attempt_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
          last_error: String(e instanceof Error ? e.message : e).slice(0, 500),
        })
        .eq("id", row.id);
    }
  }
  return { claimed: rows.length, sent, failed };
}
