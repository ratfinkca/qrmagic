import { dashboardPage, dashboardScript, dashboardStyles } from "./dashboard.ts";

type SqlValue = string | number | null;
type Statement = {
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
};
type Env = {
  SCAN_ORIGIN: string;
  MANAGE_ORIGIN: string;
  ACCESS_AUDIENCE: string;
  EDITOR_URL?: string;
  LINKS_DB: { prepare(sql: string): { bind(...values: SqlValue[]): Statement } };
};
type Context = {
  access?: { aud: string; getIdentity(): Promise<{ email?: string } | null> };
  waitUntil(promise: Promise<unknown>): void;
};
type LinkRow = {
  slug: string;
  label: string;
  placement: string;
  destination: string;
  paused: number;
  revision: number;
  created_at: string;
  updated_at: string;
};
type LinkWithActivity = LinkRow & {
  redirect_count: number;
  last_redirect_at: string | null;
  daily_redirects: string;
};

const slugPattern = /^[a-f0-9]{12}$/;
const columns = "slug, label, placement, destination, paused, revision, created_at, updated_at";
const activityColumns = `
  COALESCE(SUM(day.redirect_count), 0) AS redirect_count,
  MAX(day.last_redirect_at) AS last_redirect_at,
  json_group_array(json_object('day', day.day, 'count', day.redirect_count))
    FILTER (WHERE day.day BETWEEN ? AND ?) AS daily_redirects`;
const linksPath = "/manage/api/links";
const pageHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const text = (body: string, status = 200, type = "text/plain; charset=utf-8") =>
  new Response(body, { status, headers: { ...pageHeaders, "Content-Type": type } });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: pageHeaders });
const problem = (error: string, status: number) => json({ error }, status);

class InvalidInput extends Error {}

function destinationUrl(value: unknown, env: Env) {
  if (typeof value !== "string" || value.length > 2048) throw new InvalidInput("Enter a website URL up to 2,048 characters.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new InvalidInput("Enter a full website URL starting with https:// or http://."); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new InvalidInput("Use an http:// or https:// address without sign-in details.");
  }
  const pilotHosts = [env.SCAN_ORIGIN, env.MANAGE_ORIGIN].map(origin => new URL(origin).hostname);
  if (pilotHosts.includes(url.hostname.replace(/\.$/, ""))) throw new InvalidInput("Choose a destination outside this managed link service.");
  return url.href;
}

function linkLabel(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
    throw new InvalidInput("Enter a link name up to 100 characters.");
  }
  return value.trim();
}

function linkPlacement(value: unknown) {
  if (typeof value !== "string" || value.trim().length > 100) {
    throw new InvalidInput("Enter a placement up to 100 characters.");
  }
  return value.trim();
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new InvalidInput("Send a JSON object.");
  let size = 0;
  let data = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new InvalidInput("The request is too large.");
      }
      data += decoder.decode(value, { stream: true });
    }
    const body: unknown = JSON.parse(data + decoder.decode());
    if (typeof body === "object" && body !== null && !Array.isArray(body)) return body as Record<string, unknown>;
    throw new InvalidInput("Send a JSON object.");
  } catch (error) {
    if (error instanceof InvalidInput) throw error;
    throw new InvalidInput("Send a valid JSON object.");
  } finally {
    reader.releaseLock();
  }
}

function formatLink(row: LinkRow, env: Env, activity?: Pick<LinkWithActivity, "redirect_count" | "last_redirect_at" | "daily_redirects">) {
  const dailyRedirects: { day: string; count: number }[] = JSON.parse(activity?.daily_redirects ?? "[]");
  dailyRedirects.sort((a, b) => a.day.localeCompare(b.day));
  return {
    slug: row.slug, label: row.label, placement: row.placement, destination: row.destination, paused: row.paused === 1,
    revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at,
    publicUrl: new URL("/" + row.slug, env.SCAN_ORIGIN).href,
    redirectCount: activity?.redirect_count ?? 0,
    lastRedirectAt: activity?.last_redirect_at ?? null,
    dailyRedirects,
  };
}

function trendDays(now: Date) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 29);
  return { trendStartDay: start.toISOString().slice(0, 10), trendEndDay: now.toISOString().slice(0, 10) };
}

async function manage(request: Request, path: string, env: Env, ctx: Context) {
  const api = path === linksPath || path.startsWith(linksPath + "/");
  const denied = () => api ? problem("Sign in with an invited account to manage links.", 403)
    : text("Sign in with an invited account to manage links.", 403);
  if (!env.ACCESS_AUDIENCE || ctx.access?.aud !== env.ACCESS_AUDIENCE) return denied();
  const email = (await ctx.access.getIdentity())?.email?.trim();
  if (!email) return denied();

  if (!api) {
    if (request.method !== "GET") return text("Method not allowed.", 405);
    if (path === "/manage" || path === "/manage/") return text(dashboardPage(env.EDITOR_URL), 200, "text/html; charset=utf-8");
    if (path === "/manage/dashboard.js") return text(dashboardScript, 200, "text/javascript; charset=utf-8");
    if (path === "/manage/dashboard.css") return text(dashboardStyles, 200, "text/css; charset=utf-8");
    return text("Page not found.", 404);
  }

  const slug = path === linksPath ? null : path.slice(linksPath.length + 1);
  if (slug !== null && !slugPattern.test(slug)) return problem("Link not found.", 404);
  const clock = new Date();
  const { trendStartDay, trendEndDay } = trendDays(clock);
  if (request.method === "GET" && slug === null) {
    const { results } = await env.LINKS_DB.prepare(`
      SELECT links.*, ${activityColumns}
      FROM links LEFT JOIN link_redirect_days AS day ON day.slug = links.slug
      GROUP BY links.slug ORDER BY links.created_at DESC, links.slug
    `).bind(trendStartDay, trendEndDay).all<LinkWithActivity>();
    return json({ links: results.map(row => formatLink(row, env, row)), trendEndDay });
  }

  const creating = request.method === "POST" && slug === null;
  if (!creating && !(request.method === "PATCH" && slug !== null)) return problem("Method not allowed.", 405);
  if (request.headers.get("Origin") !== env.MANAGE_ORIGIN) return problem("Open the link dashboard to make changes.", 403);
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return problem("Send changes as JSON.", 415);
  }

  try {
    const body = await readJson(request);
    const now = clock.toISOString();
    if (creating) {
      const label = linkLabel(body.label);
      const placement = body.placement === undefined ? "" : linkPlacement(body.placement);
      const destination = destinationUrl(body.destination, env);
      for (let attempt = 0; attempt < 3; attempt++) {
        const newSlug = Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, "0")).join("");
        const row = await env.LINKS_DB.prepare(`
          INSERT INTO links (slug, label, placement, destination, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(slug) DO NOTHING RETURNING ${columns}
        `).bind(newSlug, label, placement, destination, now, now, email).first<LinkRow>();
        if (row) return json({ link: formatLink(row, env), trendEndDay }, 201);
      }
      return problem("Could not reserve a link address. Try again.", 503);
    }

    const { revision, label, placement, destination, paused } = body;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) throw new InvalidInput("Refresh the dashboard before editing.");
    if (paused !== undefined && typeof paused !== "boolean") throw new InvalidInput("Choose whether to pause or resume the link.");
    if (label === undefined && placement === undefined && destination === undefined && paused === undefined) throw new InvalidInput("Choose a change to save.");
    const nextLabel = label === undefined ? null : linkLabel(label);
    const nextPlacement = placement === undefined ? null : linkPlacement(placement);
    const nextDestination = destination === undefined ? null : destinationUrl(destination, env);
    const activity = await env.LINKS_DB.prepare(`
      SELECT ${activityColumns} FROM link_redirect_days AS day WHERE day.slug = ?
    `).bind(trendStartDay, trendEndDay, slug).first<LinkWithActivity>();
    const row = await env.LINKS_DB.prepare(`
      UPDATE links SET label = COALESCE(?, label), destination = COALESCE(?, destination), paused = COALESCE(?, paused),
        placement = COALESCE(?, placement),
        revision = revision + 1, updated_at = ?, updated_by = ?
      WHERE slug = ? AND revision = ? RETURNING ${columns}
    `).bind(nextLabel, nextDestination, paused === undefined ? null : Number(paused), nextPlacement,
      now, email, slug, revision).first<LinkRow>();
    if (row) return json({ link: formatLink(row, env, activity ?? undefined), trendEndDay });
    const exists = await env.LINKS_DB.prepare("SELECT 1 FROM links WHERE slug = ?").bind(slug).first();
    return exists ? problem("Someone changed this link. Refresh before trying again.", 409) : problem("Link not found.", 404);
  } catch (error) {
    if (error instanceof InvalidInput) return problem(error.message, 400);
    throw error;
  }
}

const unavailablePage = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link unavailable · QR Mystic</title>
<main><h1>This link is currently unavailable</h1><p>Please check with the organization that shared this QR code.</p></main></html>`;

async function recordRedirect(env: Env, slug: string, now: string) {
  try {
    const result = await env.LINKS_DB.prepare(`
      INSERT INTO link_redirect_days (slug, day, redirect_count, last_redirect_at) VALUES (?, ?, 1, ?)
      ON CONFLICT(slug, day) DO UPDATE SET
        redirect_count = redirect_count + 1,
        last_redirect_at = MAX(last_redirect_at, excluded.last_redirect_at)
    `).bind(slug, now.slice(0, 10), now).run();
    if (!result.success) console.warn("Managed QR redirect count failed");
  } catch {
    console.warn("Managed QR redirect count failed");
  }
}

async function scan(request: Request, url: URL, env: Env, ctx: Context) {
  const slug = url.pathname.slice(1);
  if (!slugPattern.test(slug)) return text(unavailablePage, 404, "text/html; charset=utf-8");
  if (request.method !== "GET" && request.method !== "HEAD") return text("Method not allowed.", 405);
  const row = await env.LINKS_DB.prepare("SELECT destination, paused FROM links WHERE slug = ?")
    .bind(slug).first<Pick<LinkRow, "destination" | "paused">>();
  if (!row || row.paused) return text(unavailablePage, 404, "text/html; charset=utf-8");
  const response = new Response(null, { status: 302, headers: { ...pageHeaders, Location: destinationUrl(row.destination, env) } });
  if (request.method === "GET") ctx.waitUntil(recordRedirect(env, slug, new Date().toISOString()));
  return response;
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    const url = new URL(request.url);
    const isManage = url.pathname === "/manage" || url.pathname.startsWith("/manage/");
    let response: Response;
    try {
      if (isManage && url.origin === env.MANAGE_ORIGIN) response = await manage(request, url.pathname, env, ctx);
      else if (url.origin === env.SCAN_ORIGIN) response = await scan(request, url, env, ctx);
      else response = text("Page not found.", 404);
    } catch {
      console.error(isManage ? "Managed QR dashboard request failed" : "Managed QR scan request failed");
      response = isManage ? problem("The link service is temporarily unavailable. Try again.", 503)
        : text("The link service is temporarily unavailable. Try again later.", 503);
    }
    return request.method === "HEAD" ? new Response(null, response) : response;
  },
};
