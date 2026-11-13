import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import worker from "../src/index.ts";

const scan = "https://go.example.com";
const manage = "https://manage.example.com";
const path = "/manage/api/links";
const schema = await readFile(new URL("../migrations/0001_managed_links.sql", import.meta.url), "utf8");
const activitySchema = await readFile(new URL("../migrations/0002_redirect_activity.sql", import.meta.url), "utf8");
const staff = { access: { aud: "pilot-test", getIdentity: async () => ({ email: "staff@example.com" }) } };

function harness(t, seed = () => {}) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(schema);
  seed(sqlite);
  sqlite.exec(activitySchema);
  t.after(() => sqlite.close());
  const pending = [];
  const env = {
    SCAN_ORIGIN: scan, MANAGE_ORIGIN: manage, ACCESS_AUDIENCE: "pilot-test",
    LINKS_DB: {
      prepare(sql) {
        return { bind(...params) {
          const query = sqlite.prepare(sql);
          return {
            all: async () => ({ results: query.all(...params) }),
            first: async () => query.get(...params) ?? null,
            run: async () => ({ success: true, meta: query.run(...params) }),
          };
        } };
      },
    },
  };
  function request(url, options, context = {}) {
    return worker.fetch(new Request(url, options), env, {
      waitUntil(promise) { pending.push(promise); },
      ...context,
    });
  }
  function write(method, payload, { slug = "", origin = manage, context = staff, host = manage } = {}) {
    return request(host + path + (slug && "/" + slug), {
      method, headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }, context);
  }
  async function list() {
    const response = await request(manage + path, undefined, staff);
    assert.equal(response.status, 200);
    return response.json();
  }
  return { env, request, write, list, pending, flush: () => Promise.all(pending.splice(0)) };
}

test("the same public QR URL changes destination, pauses and resumes", async t => {
  const { request, write, list, flush } = harness(t);
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
  await flush();
  const [listed] = (await list()).links;
  assert.equal(listed.slug, resumed.slug);
  assert.equal(listed.revision, resumed.revision);
  assert.equal(listed.redirectCount, 3);
});

test("legacy links migrate and placement can be set or cleared", async t => {
  const oldSlug = "abcdef123456";
  const { list, request, write, flush } = harness(t, sqlite => {
    sqlite.prepare(`INSERT INTO links (slug, label, destination, paused, revision, created_at, updated_at, updated_by)
      VALUES (?, 'Legacy poster', 'https://example.com/old', 0, 4, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 'staff@example.com')`).run(oldSlug);
  });
  const { links: [legacy] } = await list();
  assert.equal(legacy.slug, oldSlug);
  assert.equal(legacy.revision, 4);
  assert.equal(legacy.placement, "");
  assert.equal(legacy.redirectCount, 0);
  assert.equal(legacy.lastRedirectAt, null);
  assert.deepEqual(legacy.dailyRedirects, []);

  const redirect = await request(legacy.publicUrl);
  assert.equal(redirect.headers.get("location"), "https://example.com/old");
  await flush();
  const edit = await write("PATCH", { revision: legacy.revision, placement: "  Front gate  " }, { slug: oldSlug });
  assert.equal(edit.status, 200);
  const { link: placed } = await edit.json();
  assert.equal(placed.placement, "Front gate");
  assert.equal(placed.redirectCount, 1);
  assert.equal(placed.revision, 5);

  const clear = await write("PATCH", { revision: placed.revision, placement: "" }, { slug: oldSlug });
  assert.equal(clear.status, 200);
  const { link: cleared } = await clear.json();
  assert.equal(cleared.placement, "");
  assert.equal(cleared.redirectCount, 1);

  const draft = { label: "Poster", destination: "https://example.com/old" };
  assert.equal((await write("POST", { ...draft, placement: "x".repeat(101) })).status, 400);
  assert.equal((await write("POST", { ...draft, placement: { name: "Merch tent" } })).status, 400);
  const created = await write("POST", { ...draft, placement: "Merch tent" });
  assert.equal(created.status, 201);
  const { link: merch } = await created.json();
  assert.equal(merch.placement, "Merch tent");
  assert.equal(merch.redirectCount, 0);
  const activityBySlug = new Map((await list()).links.map(row => [row.slug, row.redirectCount]));
  assert.equal(activityBySlug.get(oldSlug), 1);
  assert.equal(activityBySlug.get(merch.slug), 0);
});

test("only successful GET redirects count, with a 30-day UTC trend and lifetime totals", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-01T23:59:59.999Z") });
  const { request, write, list, pending, flush } = harness(t);
  const created = await (await write("POST", { label: "Poster", destination: "https://example.com/" })).json();
  const { link } = created;
  assert.equal(link.redirectCount, 0);
  assert.equal(created.trendEndDay, "2026-10-01");
  const statuses = async (methods, expected) => {
    const responses = await Promise.all(methods.map(method => request(link.publicUrl, { method })));
    assert.deepEqual(responses.map(response => response.status), expected);
    await flush();
  };
  await statuses(["GET"], [302]);

  t.mock.timers.setTime(Date.parse("2026-10-02T00:00:00.000Z"));
  await statuses(["GET", "GET"], [302, 302]);
  assert.equal((await request(link.publicUrl, { method: "HEAD" })).status, 302);
  assert.equal((await request(link.publicUrl, { method: "POST" })).status, 405);
  assert.equal((await request(scan + "/000000000000")).status, 404);
  assert.equal(pending.length, 0);

  t.mock.timers.setTime(Date.parse("2026-10-31T12:00:00.000Z"));
  await statuses(["GET"], [302]);
  const { links: [measured], trendEndDay } = await list();
  assert.equal(trendEndDay, "2026-10-31");
  assert.equal(measured.redirectCount, 4);
  assert.equal(measured.lastRedirectAt, "2026-10-31T12:00:00.000Z");
  assert.equal(measured.revision, link.revision);
  assert.deepEqual(measured.dailyRedirects, [{ day: "2026-10-02", count: 2 }, { day: "2026-10-31", count: 1 }]);

  const paused = await write("PATCH", { revision: link.revision, paused: true }, { slug: link.slug });
  assert.equal(paused.status, 200);
  assert.equal((await paused.json()).trendEndDay, "2026-10-31");
  assert.equal((await request(link.publicUrl)).status, 404);
  assert.equal((await request(link.publicUrl, { method: "HEAD" })).status, 404);
  assert.equal(pending.length, 0);
  const { links: [stillPaused] } = await list();
  assert.equal(stillPaused.redirectCount, measured.redirectCount);
  assert.equal(stillPaused.lastRedirectAt, measured.lastRedirectAt);
});

test("delayed and failed writes leave redirects available and preserve the latest redirect time", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-01T12:00:00.000Z") });
  const { env, request, write, list, pending, flush } = harness(t);
  const { link } = await (await write("POST", { label: "Poster", destination: "https://example.com/" })).json();
  const prepare = env.LINKS_DB.prepare;
  const isAnalyticsWrite = sql => /insert\s+into\s+link_redirect_days/i.test(sql);
  let releaseWrite;
  const blocked = new Promise(resolve => { releaseWrite = resolve; });
  t.after(releaseWrite);
  env.LINKS_DB.prepare = sql => {
    if (!isAnalyticsWrite(sql)) return prepare(sql);
    return { bind(...params) {
      const statement = prepare(sql).bind(...params);
      return { ...statement, run: async () => { await blocked; return statement.run(); } };
    } };
  };
  let timer;
  const response = await Promise.race([
    request(link.publicUrl),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Redirect awaited the analytics write")), 1000);
    }),
  ]).finally(() => clearTimeout(timer));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://example.com/");
  assert.equal(pending.length, 1);
  assert.equal((await list()).links[0].redirectCount, 0);

  env.LINKS_DB.prepare = prepare;
  t.mock.timers.setTime(Date.parse("2026-10-01T12:05:00.000Z"));
  assert.equal((await request(link.publicUrl)).status, 302);
  await pending[1];
  assert.equal((await list()).links[0].redirectCount, 1);
  releaseWrite();
  await flush();
  const { links: [measured] } = await list();
  assert.equal(measured.redirectCount, 2);
  assert.equal(measured.lastRedirectAt, "2026-10-01T12:05:00.000Z");

  env.LINKS_DB.prepare = sql => {
    if (isAnalyticsWrite(sql)) throw new Error("Analytics writes temporarily unavailable");
    return prepare(sql);
  };
  assert.equal((await request(link.publicUrl)).status, 302);
  await flush();
  assert.equal((await list()).links[0].redirectCount, 2);
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
