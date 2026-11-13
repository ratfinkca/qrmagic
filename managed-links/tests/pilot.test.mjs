import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import worker from "../src/index.ts";

const scan = "https://go.example.com";
const manage = "https://manage.example.com";
const path = "/manage/api/links";
const schema = await readFile(new URL("../migrations/0001_managed_links.sql", import.meta.url), "utf8");
const staff = { access: { aud: "pilot-test", getIdentity: async () => ({ email: "staff@example.com" }) } };

function harness(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(schema);
  t.after(() => sqlite.close());
  const env = {
    SCAN_ORIGIN: scan, MANAGE_ORIGIN: manage, ACCESS_AUDIENCE: "pilot-test",
    LINKS_DB: {
      prepare(sql) {
        return { bind(...params) {
          const query = sqlite.prepare(sql);
          return {
            all: async () => ({ results: query.all(...params) }),
            first: async () => query.get(...params) ?? null,
          };
        } };
      },
    },
  };
  function request(url, options, context = {}) {
    return worker.fetch(new Request(url, options), env, context);
  }
  function write(method, payload, { slug = "", origin = manage, context = staff, host = manage } = {}) {
    return request(host + path + (slug && "/" + slug), {
      method, headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }, context);
  }
  return { env, request, write };
}

test("the same public QR URL changes destination, pauses and resumes", async t => {
  const { request, write } = harness(t);
  const created = await write("POST", { label: "Poster", destination: "https://example.com/first" });
  assert.equal(created.status, 201);
  const { link } = await created.json();
  assert.equal(link.publicUrl, scan + "/" + link.slug);
  const resolve = async (status, location = null) => {
    const response = await request(link.publicUrl + "?url=https://example.net/ignored");
    assert.equal(response.status, status);
    assert.equal(response.headers.get("location"), location);
    assert.equal(response.headers.get("cache-control"), "no-store");
    return response;
  };
  await resolve(302, "https://example.com/first");
  const head = await request(link.publicUrl, { method: "HEAD" });
  assert.equal(head.status, 302);
  assert.equal(await head.text(), "");
  const update = async (revision, change) => {
    const response = await write("PATCH", { revision, ...change }, { slug: link.slug });
    assert.equal(response.status, 200);
    return (await response.json()).link;
  };
  const edited = await update(link.revision, { destination: "https://example.com/second" });
  await resolve(302, "https://example.com/second");
  const paused = await update(edited.revision, { paused: true });
  const pausedResponse = await resolve(404);
  assert.match(await pausedResponse.text(), /currently unavailable/i);
  const resumed = await update(paused.revision, { paused: false });
  assert.equal(resumed.publicUrl, link.publicUrl);
  await resolve(302, "https://example.com/second");
  const list = await (await request(manage + path, undefined, staff)).json();
  assert.deepEqual(list.links, [resumed]);
});

test("management requires a trusted Access user and same-origin writes", async t => {
  const { request, write } = harness(t);
  for (const endpoint of ["/manage", "/manage/dashboard.js", "/manage/dashboard.css", path]) {
    assert.equal((await request(manage + endpoint)).status, 403);
    assert.equal((await request(scan + endpoint, undefined, staff)).status, 404);
  }
  assert.equal((await request(manage + path, { headers: { "Cf-Access-Authenticated-User-Email": "staff@example.com" } })).status, 403);
  for (const access of [{ ...staff.access, aud: "another-app" }, { ...staff.access, getIdentity: async () => ({}) }]) {
    assert.equal((await request(manage + path, undefined, { access })).status, 403);
  }
  const data = { label: "Poster", destination: "https://example.com/" };
  assert.equal((await write("POST", data, { origin: "https://unrelated.example" })).status, 403);
  assert.equal((await write("POST", data, { context: {} })).status, 403);
  assert.equal((await write("POST", data, { host: scan })).status, 404);
  assert.equal((await request(manage + "/manage", undefined, staff)).status, 200);
});

test("unsafe destinations, stale edits, and storage outages are handled explicitly", async t => {
  const { env, request, write } = harness(t);
  for (const destination of ["javascript:alert(1)", "file:///tmp/test", "https://x@y.test/", scan + "/abcdef1234", manage + "/manage"]) {
    assert.equal((await write("POST", { label: "Poster", destination })).status, 400);
  }
  const { link } = await (await write("POST", { label: "Poster", destination: "https://example.com/" })).json();
  assert.equal((await write("PATCH", { revision: link.revision, paused: true }, { slug: link.slug })).status, 200);
  assert.equal((await write("PATCH", { revision: link.revision, paused: false }, { slug: link.slug })).status, 409);
  assert.equal((await request(link.publicUrl)).status, 404);
  assert.equal((await request(scan + "/000000000000")).status, 404);
  env.LINKS_DB.prepare = () => { throw new Error("Database offline"); };
  const unavailable = await request(link.publicUrl);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("location"), null);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");
});
