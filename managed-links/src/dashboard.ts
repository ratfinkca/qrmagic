const defaultEditor = "https://ratfinkca.github.io/qrmagic/";

function editorHref(editorUrl: string): string {
  try {
    const url = new URL(editorUrl);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol === "https:" || (local && url.protocol === "http:")) && !url.username && !url.password) {
      return url.href.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    }
  } catch {
    // An invalid deployment setting falls back to the current public editor.
  }
  return defaultEditor;
}

export function dashboardPage(editorUrl = defaultEditor): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Managed QR links · QR Mystic</title>
  <link rel="stylesheet" href="/manage/dashboard.css">
  <script src="/manage/dashboard.js" defer></script>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <p class="wordmark"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span> QR Mystic</p>
      <a href="${editorHref(editorUrl)}" target="_blank" rel="noopener noreferrer">Open QR editor <span aria-hidden="true">↗</span></a>
    </div>
  </header>
  <main>
    <div class="intro">
      <h1>Managed QR links</h1>
      <p>Create a URL for your design, then change where it goes after printing.</p>
    </div>
    <div class="workspace">
      <section class="card form-card" aria-labelledby="form-heading">
        <h2 id="form-heading">New managed link</h2>
        <form id="link-form">
          <fieldset id="form-fields">
            <label for="link-label">Link name</label>
            <input id="link-label" name="label" maxlength="100" placeholder="Spring event poster" required>
            <label for="link-placement">Placement <span class="optional">(optional)</span></label>
            <input id="link-placement" name="placement" maxlength="100" placeholder="Front gate">
            <label for="link-destination">Destination URL</label>
            <input id="link-destination" name="destination" type="url" maxlength="2048" placeholder="https://example.com/event" required>
            <div class="actions">
              <button type="submit" class="primary" id="save-link">Create link</button>
              <button type="button" class="secondary" id="cancel-edit" hidden>Cancel edit</button>
            </div>
          </fieldset>
        </form>
        <div class="tip">
          <h3>Use the same QR after printing</h3>
          <p>Copy the QR URL into the editor’s <strong>Website or text</strong> field. A destination change or pause applies to every printed copy using that URL.</p>
          <p>To compare placements, create a separate QR URL for each location.</p>
        </div>
      </section>
      <section class="card links-card" aria-labelledby="list-heading">
        <div class="section-heading">
          <h2 id="list-heading">Team links</h2>
          <button type="button" class="secondary" id="refresh-links">Refresh links</button>
        </div>
        <p class="analytics-note">Redirects can include repeat visits and automated previews. Daily counts use UTC.</p>
        <p id="dashboard-status" class="feedback" role="status" aria-atomic="true"></p>
        <p id="dashboard-error" class="feedback error" role="alert" aria-atomic="true"></p>
        <p id="empty-state" class="empty" hidden>No managed links yet. Create one to get your QR URL.</p>
        <ul id="link-list" class="link-list" aria-label="Team links"></ul>
      </section>
    </div>
  </main>
</body>
</html>`;
}

export const dashboardScript = String.raw`
"use strict";

const endpoint = "/manage/api/links";
const form = document.querySelector("#link-form");
const fields = document.querySelector("#form-fields");
const formHeading = document.querySelector("#form-heading");
const labelInput = document.querySelector("#link-label");
const placementInput = document.querySelector("#link-placement");
const destinationInput = document.querySelector("#link-destination");
const saveButton = document.querySelector("#save-link");
const cancelButton = document.querySelector("#cancel-edit");
const refreshButton = document.querySelector("#refresh-links");
const status = document.querySelector("#dashboard-status");
const errorStatus = document.querySelector("#dashboard-error");
const emptyState = document.querySelector("#empty-state");
const list = document.querySelector("#link-list");
let links = [];
let editing = null;
let pending = false;
const countFormat = new Intl.NumberFormat();
const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function action(label, handler) {
  const button = element("button", "secondary", label);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}

function feedback(message, isError = false) {
  status.textContent = isError ? "" : message;
  errorStatus.textContent = isError ? message : "";
}

async function request(path = endpoint, method = "GET", payload) {
  const init = {
    method,
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json" }
  };
  if (payload) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(payload);
  }
  let response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error("Could not reach the link service. Check your connection, then refresh the dashboard if needed.");
  }
  if (!response.headers.get("Content-Type")?.includes("application/json")) {
    throw new Error("The dashboard session may have expired. Reload this page to sign in again.");
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "The link could not be saved. Try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function clearForm() {
  editing = null;
  form.reset();
  formHeading.textContent = "New managed link";
  saveButton.textContent = "Create link";
  cancelButton.hidden = true;
}

function editLink(link) {
  editing = link;
  labelInput.value = link.label;
  placementInput.value = link.placement;
  destinationInput.value = link.destination;
  formHeading.textContent = "Edit managed link";
  saveButton.textContent = "Save changes";
  cancelButton.hidden = false;
  labelInput.focus();
  feedback("");
}

function redirectCountLabel(count) {
  return countFormat.format(count) + (count === 1 ? " redirect" : " redirects");
}

function redirectSummary(link, trendEndDay) {
  const section = element("div", "redirect-summary");
  const metrics = element("dl", "redirect-metrics");
  const lastRedirect = link.lastRedirectAt ? timeFormat.format(new Date(link.lastRedirectAt)) : "None yet";
  for (const [label, value] of [["Total redirects", countFormat.format(link.redirectCount)], ["Last redirect", lastRedirect]]) {
    const metric = element("div");
    metric.append(element("dt", "", label), element("dd", "", value));
    metrics.append(metric);
  }
  section.append(metrics);

  const counts = new Map(link.dailyRedirects.map(({ day, count }) => [day, count]));
  const end = new Date(trendEndDay + "T00:00:00Z");
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - 29 + index);
    return { date, count: counts.get(date.toISOString().slice(0, 10)) ?? 0 };
  });
  const max = Math.max(...days.map(day => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const caption = element("p", "trend-caption");
  caption.append(element("strong", "", "Last 30 days"), element("span", "", total ? redirectCountLabel(total) : "No redirects recorded"));
  section.append(caption);
  if (!max) return section;

  const bars = element("div", "trend-bars");
  bars.setAttribute("aria-hidden", "true");
  for (const { date, count } of days) {
    const bar = element("div", "trend-bar");
    bar.dataset.level = Math.ceil(count / max * 10);
    bar.title = dayFormat.format(date) + " · " + redirectCountLabel(count);
    bars.append(bar);
  }
  const axis = element("div", "trend-axis");
  axis.setAttribute("aria-hidden", "true");
  axis.append(element("span", "", dayFormat.format(days[0].date)), element("span", "", dayFormat.format(end)));
  const details = element("details", "trend-details");
  details.append(element("summary", "", "Daily counts"));
  const breakdown = element("dl", "trend-values");
  breakdown.tabIndex = 0;
  breakdown.setAttribute("aria-label", "Daily redirects for " + link.label);
  for (const { date, count } of [...days].reverse()) {
    const row = element("div");
    row.append(element("dt", "", dayFormat.format(date)), element("dd", "", countFormat.format(count)));
    breakdown.append(row);
  }
  details.append(breakdown);
  section.append(bars, axis, details);
  return section;
}

function cardFor(link, trendEndDay) {
  const card = element("li", "link-card");
  const heading = element("div", "link-heading");
  heading.append(element("h3", "", link.label), element("span", link.paused ? "badge paused" : "badge active", link.paused ? "Paused" : "Active"));
  card.append(heading);
  if (link.placement) {
    const placement = element("p", "placement");
    placement.append(element("strong", "", "Placement "), document.createTextNode(link.placement));
    card.append(placement);
  }

  const destination = element("p", "destination");
  destination.append(element("strong", "", "Destination "), document.createTextNode(link.destination));
  card.append(destination);
  const publicUrl = element("input", "public-url");
  publicUrl.type = "url";
  publicUrl.readOnly = true;
  publicUrl.value = link.publicUrl;
  publicUrl.setAttribute("aria-label", "QR URL for " + link.label);
  card.append(publicUrl);

  const actions = element("div", "actions link-actions");
  const copy = action("Copy QR URL", async () => {
    try {
      await navigator.clipboard.writeText(link.publicUrl);
      feedback("QR URL copied for " + link.label + ".");
    } catch {
      publicUrl.focus();
      publicUrl.select();
      feedback("QR URL selected. Use your device's copy command.");
    }
  });
  const edit = action("Edit link", () => editLink(link));
  const pause = action(link.paused ? "Resume" : "Pause", () => run(async () => {
    const data = await request(endpoint + "/" + encodeURIComponent(link.slug), "PATCH", {
      revision: link.revision,
      paused: !link.paused
    });
    if (editing?.slug === link.slug) editing = data.link;
    updateCard(data.link, data.trendEndDay);
    feedback(data.link.paused ? "Link paused. Scans now see an unavailable message." : "Link resumed. Scans now open its destination.");
    findCard(link.slug)?.querySelector("[data-pause]")?.focus();
  }));
  pause.dataset.pause = "";
  actions.append(copy, edit, pause);
  const url = new URL(link.publicUrl);
  if (url.protocol === "https:" || url.protocol === "http:") {
    const test = element("a", "secondary", "Test link");
    test.href = url.href;
    test.target = "_blank";
    test.rel = "noopener noreferrer";
    actions.append(test);
  }
  card.append(actions, redirectSummary(link, trendEndDay));
  card.dataset.slug = link.slug;
  return card;
}

function findCard(slug) {
  return Array.from(list.children).find(card => card.dataset.slug === slug);
}

function renderLinks(trendEndDay) {
  list.replaceChildren(...links.map(link => cardFor(link, trendEndDay)));
  emptyState.hidden = links.length > 0;
}

function updateCard(link, trendEndDay) {
  const index = links.findIndex(item => item.slug === link.slug);
  const card = cardFor(link, trendEndDay);
  const oldCard = findCard(link.slug);
  if (index === -1) {
    links.unshift(link);
    list.prepend(card);
  } else {
    links[index] = link;
    oldCard?.replaceWith(card);
  }
  emptyState.hidden = true;
}

function showPending(value) {
  pending = value;
  fields.disabled = value;
  refreshButton.disabled = value;
  list.querySelectorAll("button").forEach(button => { button.disabled = value; });
}

async function loadLinks() {
  const data = await request();
  links = data.links;
  renderLinks(data.trendEndDay);
}

async function run(task) {
  if (pending) return;
  showPending(true);
  feedback("");
  try {
    await task();
  } catch (error) {
    if (error.status === 409) {
      try {
        await loadLinks();
        clearForm();
        feedback("This link changed since you opened it. Review the updated link before trying again.", true);
      } catch {
        feedback("This link changed. Refresh the list before trying again.", true);
      }
    } else {
      feedback(error.message || "Something went wrong. Try again.", true);
    }
  } finally {
    showPending(false);
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  run(async () => {
    const label = labelInput.value.trim();
    if (!label) throw new Error("Enter a name for this link.");
    const payload = { label, placement: placementInput.value.trim(), destination: destinationInput.value.trim() };
    const previous = editing;
    const data = previous
      ? await request(endpoint + "/" + encodeURIComponent(previous.slug), "PATCH", { ...payload, revision: previous.revision })
      : await request(endpoint, "POST", payload);
    updateCard(data.link);
    clearForm();
    feedback(previous ? "Changes saved for " + data.link.label + "." : "Link created. Copy its QR URL into your design.");
    findCard(data.link.slug)?.querySelector(".public-url")?.focus();
  });
});

cancelButton.addEventListener("click", () => {
  clearForm();
  labelInput.focus();
});

refreshButton.addEventListener("click", () => run(async () => {
  await loadLinks();
  feedback("Team links refreshed.");
}));

run(async () => {
  feedback("Loading team links…");
  await loadLinks();
  feedback("");
});
`;

export const dashboardStyles = `
:root {
  color-scheme: light;
  font-family: Inter, system-ui, sans-serif;
  color: #18342f;
  background: #f3f7f6;
  --teal: #0f766e;
  --ink: #18342f;
  --muted: #526863;
  --line: #dce7e3;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; }
button, input { font: inherit; }
button:disabled, fieldset:disabled { opacity: .67; }
a { color: #096359; }
button, a, input { outline-offset: 3px; }
:focus-visible { outline: 3px solid #1a8277; }
h1, h2, h3, p { margin: 0; }
.site-header { background: #fff; border-bottom: 1px solid var(--line); }
.header-inner, main { max-width: 1240px; margin-inline: auto; padding-inline: clamp(1rem, 4vw, 3rem); }
.header-inner { min-height: 4rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.header-inner > a { font-size: .875rem; font-weight: 650; text-underline-offset: .2em; }
.wordmark { display: flex; align-items: center; gap: .65rem; font-weight: 750; white-space: nowrap; }
.brand-mark { display: grid; grid-template-columns: repeat(2, 5px); gap: 3px; padding: 7px; border-radius: 7px; background: var(--teal); }
.brand-mark i { background: white; aspect-ratio: 1; border-radius: 1px; }
.brand-mark i:last-child { background: linear-gradient(45deg, #fff 50%, transparent 50%); }
main { padding-block: clamp(2rem, 5vw, 4rem); }
.intro { margin-bottom: 2rem; }
.intro h1 { font-size: clamp(2rem, 5vw, 3.35rem); letter-spacing: -.055em; line-height: 1.08; margin-bottom: .6rem; }
.intro p, .tip p, .destination, .empty { color: var(--muted); line-height: 1.55; }
.workspace { display: grid; grid-template-columns: minmax(17rem, .85fr) minmax(0, 1.45fr); align-items: start; gap: 1.25rem; }
.card { background: white; border: 1px solid var(--line); border-radius: 1rem; padding: clamp(1rem, 3vw, 1.6rem); min-width: 0; }
h2 { font-size: 1.2rem; letter-spacing: -.015em; }
h3 { font-size: .97rem; overflow-wrap: anywhere; }
form { margin-top: 1.2rem; }
fieldset { min-width: 0; margin: 0; border: 0; padding: 0; }
label { display: block; color: var(--ink); font-weight: 680; font-size: .9rem; margin-bottom: .4rem; }
.optional { color: var(--muted); font-weight: 500; }
input { width: 100%; min-width: 0; padding: .7rem .75rem; border: 1px solid #b9cbc5; border-radius: .55rem; color: var(--ink); background: white; }
fieldset input { margin-bottom: 1rem; }
input::placeholder { color: #61736e; }
.actions, .section-heading, .link-heading { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; }
.section-heading, .link-heading { justify-content: space-between; }
.primary, .secondary {
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; min-height: 2.55rem; border-radius: .55rem;
  padding: .45rem .75rem; font-size: .86rem; font-weight: 690; text-decoration: none; cursor: pointer;
}
.primary { background: var(--teal); color: white; }
.primary:hover:not(:disabled) { background: #0a645c; }
.secondary { background: #fff; border-color: #cbdad5; color: #1b5c52; }
.secondary:hover:not(:disabled) { background: #edf8f5; border-color: #8eb9ad; }
button:disabled { cursor: default; }
.tip { margin-top: 1.5rem; padding: .95rem; border-radius: .65rem; background: #edf7f3; }
.tip p { margin-top: .35rem; font-size: .875rem; }
.feedback { margin-top: .7rem; font-size: .9rem; line-height: 1.5; color: #0b655c; }
.feedback:empty { margin-top: 0; }
.feedback.error { color: #8a261b; }
.empty { margin-top: 1.15rem; padding: 1.2rem; background: #f4f7f6; border-radius: .65rem; }
.link-list { margin: 1rem 0 0; padding: 0; list-style: none; display: grid; gap: .75rem; }
.link-list:empty { margin: 0; }
.link-card { min-width: 0; border: 1px solid var(--line); border-radius: .75rem; padding: 1rem; }
.badge { padding: .23rem .55rem; border-radius: 999px; font-size: .76rem; font-weight: 750; }
.active { color: #0b5b49; background: #e0f5eb; }
.paused { color: #755014; background: #f8eedb; }
.destination { margin-block: .5rem .7rem; font-size: .85rem; overflow-wrap: anywhere; }
.placement, .analytics-note { margin-top: .5rem; color: var(--muted); font-size: .85rem; line-height: 1.55; overflow-wrap: anywhere; }
.destination strong, .placement strong { color: var(--ink); }
.public-url { background: #f5f9f7; color: #095e53; font: .82rem ui-monospace, monospace; }
.link-actions { margin-top: .7rem; }
.redirect-summary { margin-top: .95rem; padding-top: .75rem; border-top: 1px solid var(--line); }
.redirect-metrics { display: flex; flex-wrap: wrap; gap: .6rem 1.5rem; margin: 0; }
.redirect-metrics dt { font-size: .8rem; color: var(--muted); }
.redirect-metrics dd { margin: .15rem 0 0; font-size: .92rem; font-weight: 700; }
.trend-caption { display: flex; justify-content: space-between; gap: .65rem; margin-top: .7rem; font-size: .82rem; font-weight: 650; }
.trend-caption span, .trend-axis { color: var(--muted); font-weight: 500; }
.trend-bars { display: grid; grid-template-columns: repeat(30, minmax(0, 1fr)); align-items: end; gap: 2px; height: 3rem; margin-top: .35rem; }
.trend-bar { height: 2px; border-radius: 2px 2px 0 0; background: #adc5be; }
.trend-bar:not([data-level="0"]) { background: var(--teal); }
.trend-bar[data-level="1"] { height: 10%; }
.trend-bar[data-level="2"] { height: 20%; }
.trend-bar[data-level="3"] { height: 30%; }
.trend-bar[data-level="4"] { height: 40%; }
.trend-bar[data-level="5"] { height: 50%; }
.trend-bar[data-level="6"] { height: 60%; }
.trend-bar[data-level="7"] { height: 70%; }
.trend-bar[data-level="8"] { height: 80%; }
.trend-bar[data-level="9"] { height: 90%; }
.trend-bar[data-level="10"] { height: 100%; }
.trend-axis { display: flex; justify-content: space-between; font-size: .76rem; margin-top: .25rem; }
.trend-details { margin-top: .5rem; font-size: .82rem; }
.trend-details summary { width: fit-content; color: #096359; cursor: pointer; }
.trend-values { max-height: 10rem; overflow: auto; margin: .4rem 0 0; padding-inline: .2rem; }
.trend-values > div { display: flex; justify-content: space-between; gap: 1rem; padding: .2rem 0; border-bottom: 1px solid var(--line); }
.trend-values dd { margin: 0; }
@media (max-width: 760px) { .workspace { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 400px) { .header-inner > a { font-size: .8rem; } .link-card { padding: .8rem; } }
`;
