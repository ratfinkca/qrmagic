import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { createServer } from "vite";

// Executable browser regressions exercise the actual editor and exported pixels
// locally and in CI. PLAYWRIGHT_CHANNEL=msedge uses an installed Edge browser.
let server;
let browser;
let page;
let initialProject;
let fixtureIndex = 0;
const pageErrors = [];

test("production PDF preserves vectors, embedded text, exact page boxes, and serialized QR copies", async () => {
  const result = await page.evaluate(async () => {
    const { renderProductionPdf } = await import("/qrmagic/src/lib/productionPdf.ts");
    const { createStarterProject } = await import("/qrmagic/src/lib/templates.ts");
    const { createPrintRecords } = await import("/qrmagic/src/lib/production.ts");
    const { getDocument, OPS, decodeQr } = await import("/qrmagic/tests/pdf-fixture.ts");
    const project = createStarterProject("decals", { records: 2, copies: 2 });
    const result = await renderProductionPdf(project, createPrintRecords(project));
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const loadingTask = getDocument({ data: bytes.slice() });
    const pdf = await loadingTask.promise;
    const pages = [];
    let preview;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const canvas = document.createElement("canvas");
      const viewport = page.getViewport({ scale: 300 / 72 });
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      if (i === 1) preview = canvas.toDataURL();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const operators = await page.getOperatorList();
      pages.push({ qr: decodeQr(pixels.data, canvas.width, canvas.height)?.data,
        text: (await page.getTextContent()).items.map(item => item.str).join(" "),
        images: operators.fnArray.filter(op => op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject).length,
        paths: operators.fnArray.filter(op => op === OPS.constructPath).length });
    }
    await loadingTask.destroy();
    return { pages, preview, bytes: [...bytes], issues: result.issues, stats: result.stats };
  });
  if (process.env.QRMAGIC_REVIEW_DIR) await writeFile(join(process.env.QRMAGIC_REVIEW_DIR, "production-pdf-preview.png"), Buffer.from(result.preview.split(",")[1], "base64"));
  assert.deepEqual(result.issues, []);
  assert.equal(result.stats.rasterLayers, 0);
  assert.equal(result.stats.uniqueRecords, 2);
  const pdf = await PDFDocument.load(Uint8Array.from(result.bytes));
  assert.equal(pdf.getPageCount(), 4);
  assert.ok(Math.abs(pdf.getPage(0).getTrimBox().width - 288) < 0.001);
  assert.ok(Math.abs(pdf.getPage(0).getBleedBox().width - 107.6 / 25.4 * 72) < 0.001);
  assert.ok(pdf.context.enumerateIndirectObjects().some(([, obj]) => obj.toString().includes("/FontFile2")), "font bytes embedded");
  assert.deepEqual(result.pages.map(page => page.qr), ["PARK-0001", "PARK-0001", "PARK-0002", "PARK-0002"]);
  for (const page of result.pages) {
    assert.equal(page.images, 0);
    assert.ok(page.paths > 0);
    assert.match(page.text, /PARK-000[12]/);
  }
});

test("production package download contains artwork, reference cut geometry, job and preflight reports", async () => {
  await page.getByRole("button", { name: /Repeated stickers/ }).click();
  await page.getByLabel("QR content", { exact: true }).fill("https://example.com/print");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByLabel("Set format", { exact: true }).selectOption("production-pdf");
  await page.getByText(/RGB artwork/).waitFor();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download production package", exact: true }).click();
  const downloaded = await downloading;
  const zip = await JSZip.loadAsync(await readFile(await downloaded.path()));
  const pdf = await PDFDocument.load(await zip.file("artwork.pdf").async("uint8array"));
  assert.equal(pdf.getPageCount(), 1);
  assert.match(await zip.file("cut-outline.svg").async("string"), /reference geometry/);
  const job = JSON.parse(await zip.file("job.json").async("string"));
  assert.equal(job.quantity.total, 1);
  const report = JSON.parse(await zip.file("preflight.json").async("string"));
  assert.equal(report.stats.rasterLayers, 0);
  assert.equal(report.colorSpace, "RGB");
  assert.equal(report.machineProfile, null);
  assert.match(await zip.file("README.txt").async("string"), /100%/);
  if (process.env.QRMAGIC_REVIEW_DIR) await page.screenshot({ path: join(process.env.QRMAGIC_REVIEW_DIR, "production-export-editor.png") });
  // Start the next editor flow with a fresh project and selection.
  await page.reload();
});

test("production preflight blocks empty content and reports runtime glyph fallback once per layer", async () => {
  const result = await page.evaluate(async () => {
    const { renderProductionPdf } = await import("/qrmagic/src/lib/productionPdf.ts");
    const { createStarterProject } = await import("/qrmagic/src/lib/templates.ts");
    const { createPrintRecords } = await import("/qrmagic/src/lib/production.ts");
    const project = createStarterProject("stickers", { payload: "https://example.com" });
    project.layers.find(layer => layer.type === "text").textTemplate = "Print 中文";
    project.data.groups[0].fixed.quantity = 2;
    const result = await renderProductionPdf(project, createPrintRecords(project));
    project.data.groups[0].fixed.value = "";
    let error;
    try { await renderProductionPdf(project, createPrintRecords(project)); } catch (cause) { error = cause.message; }
    return { issues: result.issues, stats: result.stats, error };
  });
  assert.equal(result.issues.filter(issue => issue.code === "raster-glyphs").length, 1);
  assert.equal(result.stats.rasterLayers, 2);
  assert.match(result.error, /QR content is empty/);
});

test("production PDF matches rendered artwork across shapes, text, transparency and fallback effects", async () => {
  const results = await page.evaluate(async () => {
    const { renderProductionPdf } = await import("/qrmagic/src/lib/productionPdf.ts");
    const { renderProjectPngBlob } = await import("/qrmagic/src/lib/exportRenderer.ts");
    const { initialProject } = await import("/qrmagic/src/lib/project.ts");
    const { createDataRecords } = await import("/qrmagic/src/lib/serial.ts");
    const { presetShapeGeometry, SHAPE_OPTIONS } = await import("/qrmagic/src/lib/shapeGeometry.ts");
    const { getDocument } = await import("/qrmagic/tests/pdf-fixture.ts");
    const results = [];
    const shape = initialProject.layers.find(layer => layer.type === "shape");
    const text = initialProject.layers.find(layer => layer.type === "text");
    const qr = initialProject.layers.find(layer => layer.type === "qr");
    const fixtures = SHAPE_OPTIONS.map(({ value }) => ({ ...shape, ...presetShapeGeometry(value),
      x: 70, y: 65, width: 130, height: 90, rotation: 17, strokeWidth: 3,
      fill: "#fc1260", stroke: "#234567" }));
    fixtures.push({ ...shape, x: 30, y: 30, width: 150, height: 100, stroke: "transparent", strokeWidth: 18 });
    fixtures.push(...["left", "center", "right"].map(align => ({ ...text, align, x: 20, y: 30, width: 200, height: 100,
      fontSize: 24, textTemplate: "AV office\nPrint 123", rotation: 7, fillOpacity: 0.6 })));
    fixtures.push({ ...text, x: 10, y: 50, width: 240, height: 100, fontSize: 28, fontWeight: 400,
      textTemplate: "AVAVAVAVAVAV", align: "left" });
    fixtures.push({ ...shape, x: 30, y: 30, width: 150, height: 90, fillMode: "linear-gradient", shadowEnabled: true });
    fixtures.push({ ...text, x: 30, y: 30, width: 150, height: 90, fill: "transparent" });
    fixtures.push({ ...qr, x: 40, y: 30, width: 140, height: 140, margin: 14, opacity: 0.5 });
    for (const layer of fixtures) {
      const project = structuredClone(initialProject);
      project.document = { ...project.document, unit: "px", width: 260, height: 210, bleedMm: 0,
        backgroundColor: "#abcdef", backgroundOpacity: 0.3 };
      project.layers = [layer];
      const records = createDataRecords(project.data.groups).slice(0, 1);
      const result = await renderProductionPdf(project, records);
      const loadingTask = getDocument({ data: new Uint8Array(await result.blob.arrayBuffer()) });
      const pdfPage = await (await loadingTask.promise).getPage(1);
      const canvas = document.createElement("canvas"); canvas.width = 260; canvas.height = 210;
      const context = canvas.getContext("2d");
      await pdfPage.render({ canvasContext: context, canvas, viewport: pdfPage.getViewport({ scale: 300 / 72 }) }).promise;
      const actual = context.getImageData(0, 0, 260, 210).data;
      const image = await createImageBitmap(await renderProjectPngBlob(project, records[0], { includeGuides: false }));
      context.fillStyle = "white"; context.fillRect(0, 0, 260, 210); context.drawImage(image, 0, 0); image.close();
      const expected = context.getImageData(0, 0, 260, 210).data;
      let totalDifference = 0, differentPixels = 0;
      for (let i = 0; i < actual.length; i += 4) {
        const delta = Math.max(...[0, 1, 2].map(channel => Math.abs(actual[i + channel] - expected[i + channel])));
        totalDifference += delta;
        if (delta > 35) differentPixels++;
      }
      results.push({ type: `${layer.type} ${layer.shape || layer.align || ""} ${layer.fillMode || ""} ${layer.fill}`,
        mean: totalDifference / (260 * 210), fraction: differentPixels / (260 * 210), stats: result.stats,
        samples: [[0,0], [50,50], [70,70], [90,90], [110,110]].map(([x,y]) => ({ x,y, actual: [...actual.slice((y*260+x)*4,(y*260+x)*4+3)], expected: [...expected.slice((y*260+x)*4,(y*260+x)*4+3)] })) });
      await loadingTask.destroy();
    }
    return results;
  });
  for (const result of results) {
    assert.ok(result.mean < 3 && result.fraction < 0.025, JSON.stringify(result));
  }
  // PDF/canvas color rounding differs by one channel value on the page background.
  assert.ok(results.at(-1).mean < 1.2, `QR opacity: ${JSON.stringify(results.at(-1))}`);
  for (const sample of results.at(-1).samples) assert.ok(sample.actual.every((value, index) =>
    Math.abs(value - sample.expected[index]) <= 2), JSON.stringify(sample));
  assert.equal(results.at(-3).stats.rasterLayers, 1, "gradient/shadow fallback is reported");
});

test("production QR style variants remain vectors and decode after PDF rendering", async () => {
  const results = await page.evaluate(async () => {
    const { renderProductionPdf } = await import("/qrmagic/src/lib/productionPdf.ts");
    const { createStarterProject } = await import("/qrmagic/src/lib/templates.ts");
    const { createPrintRecords } = await import("/qrmagic/src/lib/production.ts");
    const { getDocument, decodeQr } = await import("/qrmagic/tests/pdf-fixture.ts");
    const styles = ["square", "dots", "rounded", "classy", "classy-rounded", "extra-rounded"];
    const results = [];
    for (const dotStyle of styles) {
      const project = createStarterProject("stickers", { width: 76.2, height: 76.2, payload: "https://example.com/vector" });
      const qr = project.layers.find(layer => layer.type === "qr");
      qr.dotStyle = dotStyle; qr.cornerSquareStyle = "extra-rounded"; qr.cornerDotStyle = "dot";
      qr.x = 150; qr.y = 230; qr.width = qr.height = 500; qr.margin = 50;
      qr.rotation = 7; qr.opacity = 0.9;
      const result = await renderProductionPdf(project, createPrintRecords(project));
      const task = getDocument({ data: new Uint8Array(await result.blob.arrayBuffer()) });
      const pdfPage = await (await task.promise).getPage(1);
      const viewport = pdfPage.getViewport({ scale: 300 / 72 });
      const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      results.push({ dotStyle, payload: decodeQr(pixels.data, canvas.width, canvas.height)?.data, stats: result.stats });
      await task.destroy();
    }
    return results;
  });
  for (const result of results) {
    assert.equal(result.stats.rasterLayers, 0, JSON.stringify(result));
    assert.equal(result.payload, "https://example.com/vector", JSON.stringify(result));
  }
});

before(async () => {
  server = await createServer({
    // A concurrent local editor must not share optimizer files with this server.
    cacheDir: "node_modules/.vite-export-tests",
    server: { host: "127.0.0.1", port: 0 },
    optimizeDeps: { include: ["konva", "@pdf-lib/fontkit", "pdfjs-dist/build/pdf.mjs", "jsqr"] },
  });
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.goto(`${server.resolvedUrls.local[0]}qrmagic/`);
  initialProject = await page.evaluate(async () => {
    const { initialProject } = await import("/qrmagic/src/lib/project.ts");
    return initialProject;
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
  assert.deepEqual(pageErrors, [], "the editor must not produce uncaught browser errors");
});

function projectWith(layers = [], backgroundOpacity = 0) {
  const project = structuredClone(initialProject);
  project.document = {
    ...project.document, unit: "px", width: 240, height: 180,
    backgroundColor: "#2468ac", backgroundOpacity,
    transparentBackground: backgroundOpacity === 0,
    guides: { ...project.document.guides, enabled: false },
  };
  project.layers = layers;
  return project;
}

function shape(patch = {}) {
  return {
    ...initialProject.layers[0], id: "fixture", x: 35, y: 30,
    width: 120, height: 90, cornerRadius: 0,
    fill: "#ff0000", fillOpacity: 1,
    ...patch,
  };
}

async function comparePreviewAndExport(project) {
  project = structuredClone(project);
  project.layers.forEach((layer) => { layer.id = `fixture_${++fixtureIndex}`; });
  await page.locator('input[type="file"][accept=".qrmagic.json,application/json"]').setInputFiles({
    name: "fixture.qrmagic.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  // Await React's update and async QR/image loading, not an arbitrary timeout.
  await page.waitForFunction(async (expected) => {
    const { Konva } = await import("/qrmagic/tests/rendering-fixture.ts");
    const content = Konva.stages[0]?.findOne(".document-content");
    if (!content) return false;
    const nodes = content.find(".design-layer");
    if (nodes.length !== expected.layers.length) return false;
    if (content.findOne(".document-background").fill() !==
        `rgba(36, 104, 172, ${expected.document.backgroundOpacity})`) return false;
    return expected.layers.every((layer, i) => {
      const node = nodes[i];
      if (node.id() !== layer.id) return false;
      if (layer.type === "qr") return Boolean(node.findOne("Image")?.image());
      if (layer.type === "image") return Boolean(node.image());
      return true;
    });
  }, project);

  return page.evaluate(async (project) => {
    const { Konva } = await import("/qrmagic/tests/rendering-fixture.ts");
    const { renderProjectPngBlob } = await import("/qrmagic/src/lib/exportRenderer.ts");
    const { createDataRecords } = await import("/qrmagic/src/lib/serial.ts");
    const { productionGeometry } = await import("/qrmagic/src/lib/production.ts");
    await document.fonts.ready;
    for (let attempt = 0; attempt < 100; attempt++) {
      const nodes = Konva.stages[0].find(".design-layer");
      const ready = project.layers.every((layer, i) => layer.type !== "qr" || Boolean(nodes[i]?.findOne("Image")?.image()));
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    Konva.stages[0].find("Transformer").forEach((node) => node.detach());
    const clone = Konva.stages[0].findOne(".document-content").clone({ x: 0, y: 0 });
    // Workspace decorations are deliberately excluded from production output.
    clone.find(".selection-overlay").forEach((node) => node.destroy());
    clone.find("Transformer").forEach((node) => node.destroy());
    clone.findOne(".document-background").shadowEnabled(false);
    const { output: { width, height }, bleedPixels } = productionGeometry(project);
    const preview = clone.toCanvas({ x: -bleedPixels, y: -bleedPixels, width, height, pixelRatio: 1 });
    clone.destroy();
    const blob = await renderProjectPngBlob(project, createDataRecords(project.data.groups)[0], {
      includeGuides: false,
    });
    const image = await createImageBitmap(blob);
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const context = output.getContext("2d");
    context.drawImage(image, 0, 0);
    image.close();
    
    const expected = preview.getContext("2d").getImageData(0, 0, width, height).data;
    const actual = context.getImageData(0, 0, width, height).data;
    let differentPixels = 0;
    const samples = [];
    for (let i = 0; i < expected.length; i += 4) {
      if ([0, 1, 2, 3].some((channel) => Math.abs(expected[i + channel] - actual[i + channel]) > 1)) {
        differentPixels++;
        if (samples.length < 5) samples.push({ x: (i/4)%width, y: Math.floor(i/4/width), expected: [...expected.slice(i,i+4)], actual: [...actual.slice(i,i+4)] });
      }
    }
    return { samples, differentPixels, width: output.width, height: output.height };
  }, project);
}

async function matchesPreview(project) {
  const result = await comparePreviewAndExport(project);
  assert.equal(result.width, 240);
  assert.equal(result.height, 180);
  assert.equal(result.differentPixels, 0, JSON.stringify(result.samples));
}

test("new project chooser creates, exports, saves, and reopens a repeated sticker job", async () => {
  await page.getByRole("button", { name: /Repeated stickers/ }).click();
  await page.getByLabel("QR content", { exact: true }).fill("https://example.com/event");
  await page.getByLabel("Quantity", { exact: true }).first().fill("3");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByText("3 copies · same design", { exact: true }).first().waitFor();
  await page.getByLabel("Cut shape", { exact: true }).selectOption("ellipse");
  const saved = page.waitForEvent("download");
  await page.getByTitle("Save project", { exact: true }).click();
  const savedFile = await saved;
  const bytes = await readFile(await savedFile.path());
  const project = JSON.parse(bytes.toString()).project;
  assert.equal(project.version, 2);
  assert.equal(project.production.copiesPerRecord, 3);
  assert.equal(project.document.width, 50.8);
  assert.equal(project.document.bleedMm, 3);
  assert.equal(project.document.shape.shape, "ellipse");
  await page.getByLabel("Set format", { exact: true }).selectOption("pdf");
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download job PDF", exact: true }).click();
  const pdfFile = await exported;
  const pdf = await PDFDocument.load(await readFile(await pdfFile.path()));
  assert.equal(pdf.getPageCount(), 3);
  const first = pdf.getPage(0);
  assert.ok(Math.abs(first.getTrimBox().width - 144) < 0.01);
  assert.ok(Math.abs(first.getTrimBox().x - 3 / 25.4 * 72) < 0.01);
  assert.ok(Math.abs(first.getSize().width - 56.8 / 25.4 * 72) < 0.01);
  await page.locator('input[type="file"][accept=".qrmagic.json,application/json"]').setInputFiles({
    name: "saved.qrmagic.json", mimeType: "application/json", buffer: bytes,
  });
  await page.getByText("3 copies · same design", { exact: true }).first().waitFor();
  assert.equal(await page.locator("dialog").count(), 0);
});

test("bleed exports preserve artwork outside trim and align PNG with PDF", async () => {
  const result = await page.evaluate(async () => {
    const { createStarterProject } = await import("/qrmagic/src/lib/templates.ts");
    const { renderProjectPngBlob } = await import("/qrmagic/src/lib/exportRenderer.ts");
    const { createDataRecords } = await import("/qrmagic/src/lib/serial.ts");
    const { initialProject } = await import("/qrmagic/src/lib/project.ts");
    const project = createStarterProject("blank", { width: 50.8, height: 50.8, bleedMm: 3.175 });
    project.layers = [{ ...initialProject.layers[0], x: -38, y: -38, width: 100, height: 100,
      cornerRadius: 0, fill: "#ff0000", fillOpacity: 1 }];
    const blob = await renderProjectPngBlob(project, createDataRecords(project.data.groups)[0], { includeGuides: false });
    const image = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
    const pixel = [...context.getImageData(1, 1, 1, 1).data];
    return { width: image.width, height: image.height, pixel };
  });
  assert.equal(result.width, 676);
  assert.equal(result.height, 676);
  assert.deepEqual(result.pixel, [255, 0, 0, 255]);
});

test("fixed jobs have one quantity and multiple persistent independent QR values", async () => {
  const project = await page.evaluate(async () => {
    const { createStarterProject } = await import("/qrmagic/src/lib/templates.ts");
    const project = createStarterProject("stickers", { copies: 10, payload: "https://example.com/first" });
    project.data.groups[0].fixed.quantity = 4;
    return project;
  });
  await page.locator('input[type="file"][accept=".qrmagic.json,application/json"]').setInputFiles({
    name: "legacy-fixed.qrmagic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.getByText("40 copies · same design", { exact: true }).first().waitFor();
  assert.equal(await page.getByLabel("Quantity", { exact: true }).inputValue(), "40");
  assert.equal(await page.getByLabel("Unique records", { exact: true }).count(), 0);
  await page.getByLabel("Add layer", { exact: true }).selectOption("qr");
  await page.getByLabel("Website or text", { exact: true }).fill("https://example.com/second");
  await page.getByText("40 copies · same design", { exact: true }).first().waitFor();
  await page.locator(".sidebar .layer-main").filter({ hasText: "QR Code" }).last().click();
  assert.equal(await page.getByLabel("Website or text", { exact: true }).inputValue(), "https://example.com/first");
  assert.equal(await page.getByLabel("Content template", { exact: true }).isVisible(), false);
  await page.locator(".sidebar .layer-main").filter({ hasText: "QR Code" }).first().click();
  await page.getByText("Advanced QR content", { exact: true }).click();
  await page.getByLabel("Shared content source", { exact: true }).selectOption(project.data.groups[0].id);
  await page.getByText(/Shared with 1 other layer/).waitFor();
  await page.getByRole("button", { name: "Make independent", exact: true }).click();
  await page.getByLabel("Website or text", { exact: true }).fill("https://example.com/independent");
  await page.locator(".sidebar .layer-main").filter({ hasText: "QR Code" }).last().click();
  assert.equal(await page.getByLabel("Website or text", { exact: true }).inputValue(), "https://example.com/first");
});

test("cut controls are contextual, print setup is separate, and finished preview works", async () => {
  await page.getByLabel("Cut shape", { exact: true }).selectOption("rectangle");
  assert.equal(await page.locator(".sidebar .shape-customize").count(), 0);
  assert.equal(await page.getByLabel("Bleed outside cut (mm)", { exact: true }).isVisible(), false);
  await page.getByLabel("Cut shape", { exact: true }).selectOption("polygon");
  await page.locator(".sidebar .shape-customize summary").click();
  await page.getByLabel("Points", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Print setup", exact: true }).click();
  await page.getByLabel("Show document guides", { exact: true }).uncheck();
  assert.equal(await page.getByLabel("Cut shape", { exact: true }).isVisible(), true);
  await page.getByRole("button", { name: "Finished preview", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Finished preview", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Finished preview", exact: true }).click();
});

test("switching to numbering preserves total quantity and keeps another QR fixed", async () => {
  await page.getByLabel("Content type", { exact: true }).selectOption("serial");
  assert.equal(await page.getByLabel("Number of serials", { exact: true }).inputValue(), "40");
  assert.equal(await page.getByLabel("Copies of each", { exact: true }).inputValue(), "1");
  await page.getByLabel("Number of serials", { exact: true }).fill("3");
  const saved = page.waitForEvent("download");
  await page.getByTitle("Save project", { exact: true }).click();
  const file = await saved;
  const project = JSON.parse((await readFile(await file.path())).toString()).project;
  const values = await page.evaluate(async project => {
    const { createDataRecords } = await import("/qrmagic/src/lib/serial.ts");
    const numbered = project.data.groups.find(group => group.mode === "serial");
    const secondQr = project.layers.find(layer => layer.name === "QR Code 2");
    return createDataRecords(project.data.groups).map(record => ({
      numbered: record.groups[numbered.id].serial,
      fixed: record.groups[secondQr.dataGroupId].serial,
    }));
  }, project);
  assert.deepEqual(values, [
    { numbered: "QR-0001", fixed: "https://example.com/independent" },
    { numbered: "QR-0002", fixed: "https://example.com/independent" },
    { numbered: "QR-0003", fixed: "https://example.com/independent" },
  ]);
});

test("compact editor exposes both panels without horizontal page clipping", async () => {
  await page.setViewportSize({ width: 790, height: 900 });
  try {
    await page.getByRole("button", { name: "Document & job", exact: true }).click();
    assert.equal(await page.getByLabel("Number of serials", { exact: true }).isVisible(), true);
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    assert.equal(await page.getByLabel("Content type", { exact: true }).isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
  } finally {
    await page.setViewportSize({ width: 1600, height: 1000 });
  }
});

test("bleed translation matches the preview for translucent artwork and shadows", async () => {
  const project = projectWith([shape({ opacity: 0.7, fillOpacity: 0.5,
    stroke: "#000000", strokeWidth: 4, shadowEnabled: true })], 0.5);
  project.document.bleedMm = 3.175;
  const result = await comparePreviewAndExport(project);
  assert.equal(result.width, 316);
  assert.equal(result.height, 256);
  assert.equal(result.differentPixels, 0, JSON.stringify(result.samples));
});

for (const opacity of [0, 0.5, 1]) {
  test(`page background opacity ${opacity}`, async () => matchesPreview(projectWith([], opacity)));
}

for (const kind of ["rectangle", "ellipse", "pill", "triangle", "diamond", "pentagon", "hexagon", "roundedHexagon", "octagon", "guitarPick", "shield", "polygon"]) {
  test(`shape geometry: ${kind}`, async () => {
    const geometry = await page.evaluate(async (kind) => {
      const { presetShapeGeometry } = await import("/qrmagic/src/lib/shapeGeometry.ts");
      return presetShapeGeometry(kind);
    }, kind);
    await matchesPreview(projectWith([shape(geometry)]));
  });
}

test("custom rounded star with curved sides and rotation", async () => {
  await matchesPreview(projectWith([shape({
    shape: "polygon", vertices: 7, vertexInset: 0.4, vertexRadius: 0.12,
    sideDeflection: 0.3, rotation: 12,
  })]));
});

for (const fillMode of ["solid", "linear-gradient", "radial-gradient"]) {
  test(`${fillMode} with fill/layer opacity and dashed stroke`, async () => {
    await matchesPreview(projectWith([shape({
      shape: "ellipse", fillMode, fillGradientFrom: "#ff0000", fillGradientTo: "#0000ff",
      fillGradientAngle: 37, fillOpacity: 0.65, opacity: 0.7,
      stroke: "#00ff00", strokeOpacity: 0.6, strokeWidth: 4, dash: [8, 5],
    })], 0.5));
  });
}

const shadow = {
  shadowEnabled: true, shadowColor: "#132435", shadowOpacity: 0.6,
  shadowBlur: 9, shadowOffsetX: 16, shadowOffsetY: -8,
};

test("shape shadow with translucent fill and stroke", async () => {
  await matchesPreview(projectWith([shape({ ...shadow, fillOpacity: 0.5, opacity: 0.7,
    stroke: "#000000", strokeWidth: 4 })]));
});

test("image shadow", async () => {
  const image = {
    ...shape(shadow), type: "image", assetId: "fixture", fit: "stretch",
    src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="9" fill="red"/></svg>'),
  };
  await matchesPreview(projectWith([image]));
});

test("QR background shadow", async () => {
  await matchesPreview(projectWith([{
    ...initialProject.layers.find((layer) => layer.type === "qr"),
    ...shadow, id: "fixture", x: 30, y: 25, width: 110, height: 110,
  }]));
});

test("text shadow and multiline layout", async () => {
  const layer = {
    ...initialProject.layers.find((layer) => layer.type === "text"),
    ...shadow, id: "fixture", x: 30, y: 30, width: 130, height: 110,
    fontSize: 22, textTemplate: "First line\nSecond line", fillOpacity: 0.8,
  };
  await matchesPreview(projectWith([layer]));
  // Shadows must be present in both preview and export, not absent from both.
  const enabled = await page.evaluate(async () => {
    const { Konva } = await import("/qrmagic/tests/rendering-fixture.ts");
    return Konva.stages[0].findOne(".design-layer").shadowEnabled();
  });
  assert.equal(enabled, true);
});
