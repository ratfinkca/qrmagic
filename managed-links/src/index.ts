import { dashboardPage, dashboardScript, dashboardStyles } from "./dashboard.ts";

type SqlValue = string | number | null;
type Statement = {
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
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
};
type LinkRow = {
  slug: string;
  label: string;
  destination: string;
  paused: number;
  revision: number;
  created_at: string;
  updated_at: string;
};

const slugPattern = /^[a-f0-9]{12}$/;
const columns = "slug, label, destination, paused, revision, created_at, updated_at";
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

function formatLink(row: LinkRow, env: Env) {
  return {
    slug: row.slug, label: row.label, destination: row.destination, paused: row.paused === 1,
    revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at,
    publicUrl: new URL("/" + row.slug, env.SCAN_ORIGIN).href,
  };
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
  if (request.method === "GET" && slug === null) {
    const { results } = await env.LINKS_DB.prepare(`SELECT ${columns} FROM links ORDER BY created_at DESC, slug`).bind().all<LinkRow>();
    return json({ links: results.map(row => formatLink(row, env)) });
  }

  const creating = request.method === "POST" && slug === null;
  if (!creating && !(request.method === "PATCH" && slug !== null)) return problem("Method not allowed.", 405);
  if (request.headers.get("Origin") !== env.MANAGE_ORIGIN) return problem("Open the link dashboard to make changes.", 403);
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return problem("Send changes as JSON.", 415);
  }

  try {
    const body = await readJson(request);
    const now = new Date().toISOString();
    if (creating) {
      const label = linkLabel(body.label);
      const destination = destinationUrl(body.destination, env);
      for (let attempt = 0; attempt < 3; attempt++) {
        const newSlug = Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, "0")).join("");
        const row = await env.LINKS_DB.prepare(`
          INSERT INTO links (slug, label, destination, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(slug) DO NOTHING RETURNING ${columns}
        `).bind(newSlug, label, destination, now, now, email).first<LinkRow>();
        if (row) return json({ link: formatLink(row, env) }, 201);
      }
      return problem("Could not reserve a link address. Try again.", 503);
    }

    const { revision, label, destination, paused } = body;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) throw new InvalidInput("Refresh the dashboard before editing.");
    if (paused !== undefined && typeof paused !== "boolean") throw new InvalidInput("Choose whether to pause or resume the link.");
    if (label === undefined && destination === undefined && paused === undefined) throw new InvalidInput("Choose a change to save.");
    const row = await env.LINKS_DB.prepare(`
      UPDATE links SET label = COALESCE(?, label), destination = COALESCE(?, destination), paused = COALESCE(?, paused),
        revision = revision + 1, updated_at = ?, updated_by = ?
      WHERE slug = ? AND revision = ? RETURNING ${columns}
    `).bind(label === undefined ? null : linkLabel(label), destination === undefined ? null : destinationUrl(destination, env),
      paused === undefined ? null : Number(paused), now, email, slug, revision).first<LinkRow>();
    if (row) return json({ link: formatLink(row, env) });
    const exists = await env.LINKS_DB.prepare("SELECT 1 FROM links WHERE slug = ?").bind(slug).first();
    return exists ? problem("Someone changed this link. Refresh before trying again.", 409) : problem("Link not found.", 404);
  } catch (error) {
    if (error instanceof InvalidInput) return problem(error.message, 400);
    throw error;
  }
}

const unavailablePage = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link unavailable · QR Magic</title>
<main><h1>This link is currently unavailable</h1><p>Please check with the organization that shared this QR code.</p></main></html>`;

async function scan(request: Request, url: URL, env: Env) {
  const slug = url.pathname.slice(1);
  if (!slugPattern.test(slug)) return text(unavailablePage, 404, "text/html; charset=utf-8");
  if (request.method !== "GET" && request.method !== "HEAD") return text("Method not allowed.", 405);
  const row = await env.LINKS_DB.prepare("SELECT destination, paused FROM links WHERE slug = ?")
    .bind(slug).first<Pick<LinkRow, "destination" | "paused">>();
  if (!row || row.paused) return text(unavailablePage, 404, "text/html; charset=utf-8");
  return new Response(null, { status: 302, headers: { ...pageHeaders, Location: destinationUrl(row.destination, env) } });
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    const url = new URL(request.url);
    const isManage = url.pathname === "/manage" || url.pathname.startsWith("/manage/");
    let response: Response;
    try {
      if (isManage && url.origin === env.MANAGE_ORIGIN) response = await manage(request, url.pathname, env, ctx);
      else if (url.origin === env.SCAN_ORIGIN) response = await scan(request, url, env);
      else response = text("Page not found.", 404);
    } catch {
      response = isManage ? problem("The link service is temporarily unavailable. Try again.", 503)
        : text("The link service is temporarily unavailable. Try again later.", 503);
    }
    return request.method === "HEAD" ? new Response(null, response) : response;
  },
};
