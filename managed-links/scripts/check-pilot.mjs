import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const options = { redirect: "manual", signal: AbortSignal.timeout(15_000) };
const dashboard = await fetch("https://manage-pilot.qrmystic.com/manage", options);
assert.equal(dashboard.status, 302, "The signed-out dashboard must redirect to Access.");
const signIn = new URL(dashboard.headers.get("location"));
assert.equal(signIn.origin, "https://qrmystic.cloudflareaccess.com");

const scan = await fetch(`https://go-pilot.qrmystic.com/${randomBytes(6).toString("hex")}`, {
  ...options,
  method: "HEAD",
});
assert.equal(scan.status, 404, "The scan host must read D1 and return 404 for an unknown link.");
assert.match(scan.headers.get("cache-control") ?? "", /\bno-store\b/);
