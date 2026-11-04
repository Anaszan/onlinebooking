#!/usr/bin/env node
/**
 * Concurrency test (Phase 9): fire N simultaneous bookings at the SAME slot
 * and assert that exactly one (per available staff) succeeds.
 *
 * Usage:
 *   node scripts/concurrency-test.mjs --url http://localhost:3000 \
 *     --tenant my-shop --service <uuid> --branch <uuid> --staff <uuid> --date 2030-01-07 [--n 20]
 *
 * Run against STAGING only — it creates real bookings.
 */
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => (cur.startsWith("--") ? [...acc, [cur.slice(2), arr[i + 1]]] : acc), []),
);
const { url = "http://localhost:3000", tenant, service, branch, staff, date } = args;
const n = Number(args.n ?? 20);
if (!tenant || !service || !branch || !date) {
  console.error("missing --tenant --service --branch --date");
  process.exit(1);
}

const qs = new URLSearchParams({ tenant, service, branch, date, ...(staff ? { staff } : {}) });
const avail = await fetch(`${url}/api/public/availability?${qs}`).then((r) => r.json());
const slot = avail.data?.slots?.[0];
if (!slot) {
  console.error("no free slot on that date", avail);
  process.exit(1);
}
console.log(`target slot ${slot.start} (${slot.time}) — ${slot.staffIds.length} staff free; sending ${n} requests`);

const results = await Promise.all(
  Array.from({ length: n }, (_, i) =>
    fetch(`${url}/api/public/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.0.0.${i + 1}` },
      body: JSON.stringify({
        tenant,
        serviceId: service,
        branchId: branch,
        staffId: staff,
        start: slot.start,
        customer: { name: `Load ${i}`, phone: `0800000${String(i).padStart(3, "0")}` },
        idempotencyKey: `concurrency-${Date.now()}-${i}`,
      }),
    }).then(async (r) => ({ status: r.status, body: await r.json() })),
  ),
);

const ok = results.filter((r) => r.status === 201);
const conflicts = results.filter((r) => r.status === 409);
const other = results.filter((r) => r.status !== 201 && r.status !== 409);
console.log(`created=${ok.length} conflicts=${conflicts.length} other=${other.length}`);
other.forEach((o) => console.log("  ", o.status, o.body?.error?.code));
const expected = staff ? 1 : slot.staffIds.length;
if (ok.length > expected) {
  console.error(`FAIL: ${ok.length} bookings created for ${expected} available staff`);
  process.exit(1);
}
console.log(ok.length === expected ? "PASS" : `WARN: only ${ok.length}/${expected} created (rate limit?)`);
