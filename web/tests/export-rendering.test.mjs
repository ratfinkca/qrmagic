import assert from "node:assert/strict";
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

before(async () => {
  server = await createServer({
    server: { host: "127.0.0.1", port: 0 }, optimizeDeps: { include: ["konva"] },
  });
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`${server.resolvedUrls.local[0]}qrmagic/`);
  initialProject = await page.evaluate(async () => {
    const { initialProject } = await import("/qrmagic/src/lib/project.ts");
    return initialProject;
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
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
    const width = project.document.width;
    const height = project.document.height;
    const preview = clone.toCanvas({ x: 0, y: 0, width, height, pixelRatio: 1 });
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
