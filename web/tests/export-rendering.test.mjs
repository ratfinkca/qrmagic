import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { createServer } from "vite";

// Browser plugin not available: exercise the actual editor and exported pixels
// in Playwright. Set PLAYWRIGHT_CHANNEL=msedge to use an installed Edge browser.
let server;
let browser;
let page;
let initialProject;
let fixtureIndex = 0;
const pageErrors = [];

before(async () => {
  server = await createServer({
    server: { host: "127.0.0.1", port: 0 }, optimizeDeps: { include: ["konva"] },
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
