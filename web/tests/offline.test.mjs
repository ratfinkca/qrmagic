import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { chromium } from "playwright";
import { preview } from "vite";
import JSZip from "jszip";
import jsQR from "jsqr";
import { PDFDocument } from "pdf-lib";
import { writeOfflineWorker } from "../scripts/build-offline.mjs";

// The full Chromium browser exposes web app installability through CDP.
const browserOptions = { channel: process.env.PLAYWRIGHT_CHANNEL || "chromium" };

async function download(page, button) {
  const result = page.waitForEvent("download");
  await button.click();
  return readFile(await (await result).path());
}

test("the production PWA opens offline, edits and reopens local projects, and exports cold", { timeout: 90_000 }, async () => {
  const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
  const url = server.resolvedUrls.local[0];
  let context;
  let serverOpen = true;
  try {
    context = await chromium.launchPersistentContext("", {
      ...browserOptions,
      viewport: { width: 1600, height: 1000 },
    });
    const [page] = context.pages();
    const errors = [];
    const googleRequests = [];
    context.on("request", request => {
      if (/(^|\.)(google\.com|googleapis\.com)$/.test(new URL(request.url()).hostname)) {
        googleRequests.push(request.url());
      }
    });
    context.on("page", tab => tab.on("pageerror", error => errors.push(error.message)));
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(url);
    const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute("href", { timeout: 5_000 });
    const manifest = await (await context.request.get(new URL(manifestUrl, url).href)).json();
    assert.equal(manifest.display, "standalone");
    assert.equal(new URL(manifest.start_url, new URL(manifestUrl, url)).href, url);
    assert.equal(new URL(manifest.scope, new URL(manifestUrl, url)).href, url);
    assert.equal(manifest.name, "QR Mystic");
    assert.equal(manifest.short_name, "QR Mystic");
    assert.equal(new URL(manifest.id, url).href, url);
    for (const size of ["192x192", "512x512"]) assert(manifest.icons.some(icon => icon.sizes === size && icon.purpose === "any"));
    await page.getByText("Ready to use offline", { exact: true }).waitFor({ timeout: 15_000 });
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    assert.deepEqual(installabilityErrors, []);

    // A new tab, a stopped origin and an offline context rule out the online
    // server and the original document as sources for lazy export code.
    await page.close();
    await server.close();
    serverOpen = false;
    await context.setOffline(true);
    const offline = await context.newPage();
    const failedRequests = [];
    offline.on("requestfailed", request => failedRequests.push([request.url(), request.failure()?.errorText]));
    const offlineResponse = await offline.goto(url);
    assert(offlineResponse.fromServiceWorker(), "the offline editor must come from the service worker");
    const chooser = offline.getByRole("dialog", { name: "What are you making?" });
    await chooser.waitFor({ timeout: 5_000 }).catch(error => {
      throw new Error(`Offline editor failed to start: ${JSON.stringify({ failedRequests, errors })}`, { cause: error });
    });
    // The network can be blocked while Chromium still reports navigator.onLine.
    // Set the active page's connection state separately to exercise Drive's UI.
    const offlineCdp = await context.newCDPSession(offline);
    await offlineCdp.send("Network.overrideNetworkState", {
      offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    });
    await offline.waitForFunction(() => !navigator.onLine);
    await chooser.getByRole("button", { name: "Open from Google Drive" }).click();
    const drive = offline.getByRole("dialog", { name: "Google Drive" });
    await drive.getByText("Google Drive needs an internet connection.", { exact: true }).waitFor();
    assert.equal(await drive.getByRole("button", { name: "Browse Drive" }).count(), 0);
    await drive.getByRole("button", { name: "Close Google Drive" }).click();
    await chooser.getByRole("button", { name: /Repeated stickers/ }).click();
    await chooser.getByLabel("Project name").fill("Offline starter");
    await chooser.getByLabel("QR content").fill("https://example.com/offline");
    await chooser.getByLabel("Quantity").fill("2");
    await chooser.getByRole("button", { name: "Create project" }).click();
    await offline.getByLabel("Name", { exact: true }).fill("Edited offline");
    const payload = "https://example.com/edited-offline";
    await offline.getByLabel("Website or text", { exact: true }).fill(payload);
    await offline.getByText("Saved on this device", { exact: true }).waitFor();
    await offline.reload();
    await offline.getByRole("button", { name: "Open Edited offline", exact: true }).click();
    await chooser.waitFor({ state: "hidden" });
    assert.equal(await offline.getByLabel("Name", { exact: true }).inputValue(), "Edited offline");
    assert.equal(await offline.getByLabel("Website or text", { exact: true }).inputValue(), payload);

    const projectDownload = offline.waitForEvent("download");
    await offline.getByTitle("Save project", { exact: true }).click();
    const downloaded = await projectDownload;
    assert.equal(downloaded.suggestedFilename(), "Edited offline.qrmystic.json");
    const projectFile = await readFile(await downloaded.path());
    assert.equal(JSON.parse(projectFile).project.document.name, "Edited offline");
    await offline.locator('input[type=file][accept*=".qrmystic.json"]').setInputFiles({
      name: downloaded.suggestedFilename(), mimeType: "application/json", buffer: projectFile,
    });
    await offline.getByText("Saved on this device", { exact: true }).waitFor();
    const proof = await JSZip.loadAsync(await download(offline, offline.getByRole("button", { name: "Download proof package" })));
    assert(Object.keys(proof.files).some(name => name.endsWith("-template-layered.pdf")));
    const png = await JSZip.loadAsync(await download(offline, offline.getByRole("button", { name: "Download job PNG ZIP" })));
    const images = png.file(/\.png$/);
    assert.equal(images.length, 2);
    const pixels = await offline.evaluate(async data => {
      const image = await createImageBitmap(new Blob([Uint8Array.from(data)], { type: "image/png" }));
      const canvas = new OffscreenCanvas(image.width, image.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      return { width: image.width, height: image.height, rgba: Array.from(ctx.getImageData(0, 0, image.width, image.height).data) };
    }, Array.from(await images[0].async("uint8array")));
    assert.equal(jsQR(Uint8ClampedArray.from(pixels.rgba), pixels.width, pixels.height)?.data, payload);
    await offline.getByLabel("Set format").selectOption("jpg");
    const jpg = await JSZip.loadAsync(await download(offline, offline.getByRole("button", { name: "Download job JPG ZIP" })));
    assert.equal(Object.keys(jpg.files).filter(name => name.endsWith(".jpg")).length, 2);
    await offline.getByLabel("Set format").selectOption("pdf");
    const pdf = await PDFDocument.load(await download(offline, offline.getByRole("button", { name: "Download job PDF" })));
    assert.equal(pdf.getPageCount(), 2);
    await offline.getByLabel("Set format").selectOption("production-pdf");
    const production = await JSZip.loadAsync(await download(offline, offline.getByRole("button", { name: "Download production package" })));
    assert.equal((await PDFDocument.load(await production.file("artwork.pdf").async("uint8array"))).getPageCount(), 2);
    await offline.getByRole("button", { name: "Print layout", exact: true }).click();
    const layout = await JSZip.loadAsync(await download(offline, offline.getByRole("button", { name: "Download layout package" })));
    assert(layout.file("artwork.pdf"));
    assert.equal(JSON.parse(await layout.file("job.json").async("string")).quantity.total, 2);
    assert.deepEqual(googleRequests, []);
    assert.deepEqual(errors, []);
  } finally {
    await context?.close();
    if (serverOpen) await server.close();
  }
});

test("an offline release updates only after it is fully cached and old tabs close", { timeout: 60_000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), "qrmagic-release-test-"));
  let server;
  let browser;
  try {
    await cp(fileURLToPath(new URL("../dist/", import.meta.url)), folder, { recursive: true });
    server = await preview({ build: { outDir: folder }, preview: { host: "127.0.0.1", port: 0 } });
    const url = server.resolvedUrls.local[0];
    browser = await chromium.launch(browserOptions);
    const context = await browser.newContext();
    const oldTab = await context.newPage();
    await oldTab.goto(url);
    await oldTab.getByText("Ready to use offline", { exact: true }).waitFor();
    const oldCache = await oldTab.evaluate(async () => (await caches.keys()).find(key => key.startsWith("qrmagic-release:")));
    assert(oldCache);

    const indexPath = join(folder, "index.html");
    const oldHtml = await readFile(indexPath, "utf8");
    const newHtml = oldHtml.replace("<title>QR Mystic</title>", "<title>QR Mystic Next</title>");
    assert.notEqual(oldHtml, newHtml);
    await writeFile(indexPath, newHtml);
    await writeOfflineWorker(pathToFileURL(folder + sep));
    // Serve a mismatched index first, as could happen mid-deploy. The old
    // release must remain usable and the bad worker must never become waiting.
    await writeFile(indexPath, oldHtml);
    const checkUpdate = () => oldTab.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const result = new Promise(resolve => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker.addEventListener("statechange", () => {
            if (["installed", "redundant"].includes(worker.state)) resolve(worker.state);
          });
        }, { once: true });
      });
      await registration.update();
      return result;
    });
    assert.equal(await checkUpdate(), "redundant");
    assert.equal(await oldTab.title(), "QR Mystic");
    assert(await oldTab.evaluate(async key => Boolean(await (await caches.open(key)).match(new URL("index.html", location.href))), oldCache));
    await writeFile(indexPath, newHtml);
    assert.equal(await checkUpdate(), "installed");
    const activeWorker = await oldTab.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.waiting && registration.active === navigator.serviceWorker.controller);
    });
    assert(activeWorker);
    assert.equal(await oldTab.title(), "QR Mystic");

    // Observe the registration from the same origin, outside worker scope,
    // without keeping the old release alive.
    const observer = await context.newPage();
    await observer.goto(new URL("/offline-update-observer", url).href);
    assert.equal(await observer.evaluate(() => Boolean(navigator.serviceWorker.controller)), false);
    await oldTab.close();
    await observer.waitForFunction(async ({ url, oldCache }) => {
      const registration = await navigator.serviceWorker.getRegistration(url);
      return registration?.active?.state === "activated" && !registration.waiting &&
        !(await caches.keys()).includes(oldCache);
    }, { url, oldCache });
    await context.setOffline(true);
    const newTab = await context.newPage();
    await newTab.goto(url);
    assert.equal(await newTab.title(), "QR Mystic Next");
    await newTab.getByRole("dialog", { name: "What are you making?" }).waitFor();
  } finally {
    await browser?.close();
    await server?.close();
    await rm(folder, { recursive: true, force: true });
  }
});
