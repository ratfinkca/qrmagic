import Konva from "konva";
import fontkit, { type Font as ShapingFont } from "@pdf-lib/fontkit";
import {
  PDFDocument, PDFOperator, PDFOperatorNames, PDFName, PDFStream, PDFHexString, concatTransformationMatrix,
  pushGraphicsState, popGraphicsState, drawSvgPath, rgb,
  beginText, endText, setFontAndSize, setTextMatrix, showText, setGraphicsState, setFillingColor,
  type PDFPage, type PDFFont, type PDFEmbeddedPage,
} from "pdf-lib";
import type { ProjectLayer, QrMagicProject, QrLayer, RenderRecord, TextLayer } from "../types";
import { productionGeometry } from "./production";
import { renderProjectPngBlob } from "./exportRenderer";
import { renderStyledQrSvg } from "./qrStyling";
import { textLayerProps } from "./layerRendering";
import { productionFontUrls, loadProductionFonts } from "./fonts";
import { productionPreflight, rasterReason, outlinePath, cutOutlineSvg, canvasGlyphOrigins, type ProductionIssue } from "./productionPdfModel";
import { analyzePrintProject } from "./printQuality";
import { exportYield, type ExportControl } from "./exportControl";

function color(value: string) {
  return rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);
}

type QrPath = { path: string; fill: string; matrix: DOMMatrix; evenOdd: boolean };

function primitivePath(element: Element) {
  const number = (key: string) => Number(element.getAttribute(key) ?? 0);
  if (element.localName === "path") return element.getAttribute("d") ?? "";
  if (element.localName === "rect") {
    const x = number("x"), y = number("y"), w = number("width"), h = number("height");
    if (number("rx") || number("ry")) throw new Error("Rounded SVG rectangle needs raster rendering.");
    return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
  }
  if (element.localName === "circle" || element.localName === "ellipse") {
    const x = number("cx"), y = number("cy");
    const rx = number(element.localName === "circle" ? "r" : "rx");
    const ry = number(element.localName === "circle" ? "r" : "ry");
    return `M ${x - rx} ${y} A ${rx} ${ry} 0 1 0 ${x + rx} ${y} A ${rx} ${ry} 0 1 0 ${x - rx} ${y} Z`;
  }
  throw new Error(`Unsupported QR SVG element: ${element.localName}`);
}

async function qrPaths(layer: QrLayer, record: RenderRecord) {
  const xml = new DOMParser().parseFromString(await renderStyledQrSvg(layer, record), "image/svg+xml");
  if (xml.querySelector("parsererror")) throw new Error("Invalid QR SVG.");
  const paths: QrPath[] = [];
  function collect(element: Element, fill: string, parent: DOMMatrix, inheritedEvenOdd = false) {
    const transform = (element as SVGGraphicsElement).transform?.baseVal.consolidate()?.matrix;
    const matrix = transform ? parent.multiply(DOMMatrix.fromMatrix(transform)) : parent;
    const evenOdd = inheritedEvenOdd || element.getAttribute("clip-rule") === "evenodd" || element.getAttribute("fill-rule") === "evenodd";
    if (["g", "clipPath"].includes(element.localName)) {
      for (const child of element.children) collect(child, fill, matrix, evenOdd);
    } else {
      paths.push({ path: primitivePath(element), fill, matrix, evenOdd });
    }
  }
  for (const element of xml.documentElement.children) {
    if (element.localName === "defs") continue;
    const fill = element.getAttribute("fill") ?? layer.foreground;
    if (fill === "none" || fill === "transparent") continue;
    if (!/^#[a-f\d]{6}$/i.test(fill)) throw new Error("Unsupported QR paint.");
    const clip = element.getAttribute("clip-path")?.match(/url\(['"]?#([^)'"\s]+)['"]?\)/)?.[1];
    if (clip) {
      const target = xml.getElementById(clip);
      if (!target) throw new Error("Missing QR clip geometry.");
      collect(target, fill, new DOMMatrix());
    } else collect(element, fill, new DOMMatrix());
  }
  if (!paths.length) throw new Error("QR SVG contains no vector artwork.");
  // Paint adjacent modules together to avoid antialiasing seams along shared edges.
  const groups = new Map<string, QrPath>();
  for (const item of paths) {
    const key = `${item.fill}:${item.matrix.toString()}:${item.evenOdd}`;
    const group = groups.get(key);
    if (group) group.path += ` ${item.path}`;
    else groups.set(key, { ...item });
  }
  return { paths: [...groups.values()], size: Number(xml.documentElement.getAttribute("width")) };
}

function layerTransform(page: PDFPage, layer: ProjectLayer, project: QrMagicProject) {
  const geometry = productionGeometry(project);
  const scale = 72 / project.document.dpi;
  const angle = layer.rotation * Math.PI / 180;
  const ellipse = layer.type === "shape" && layer.shape === "ellipse";
  const x = layer.x + (ellipse ? layer.width / 2 : 0);
  const y = layer.y + (ellipse ? layer.height / 2 : 0);
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(
    scale * Math.cos(angle), -scale * Math.sin(angle), scale * Math.sin(angle), scale * Math.cos(angle),
    geometry.bleedPoints + x * scale, geometry.points.height - geometry.bleedPoints - y * scale,
  ));
}

export async function renderProductionPdf(project: QrMagicProject, records: RenderRecord[], control:ExportControl = {}) {
  control.signal?.throwIfAborted();
  const errors = productionPreflight(project).filter(issue => issue.severity === "error");
  if (errors.length) throw new Error(errors.map(issue => issue.message).join("\n"));
  if (!records.length) throw new Error("The job has no records.");
  const issues=await analyzePrintProject(project,{signal:control.signal,format:"production-pdf"});
  await loadProductionFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(project.document.name);
  doc.setProducer("QR Mystic production PDF · RGB");
  const geometry = productionGeometry(project);
  const fonts = new Map<number, { font: PDFFont; shaper: ShapingFont }>();
  const repeats = new Map<RenderRecord, { page: PDFPage; embedded?: PDFEmbeddedPage }>();
  const stats = { vectorLayers: 0, rasterLayers: 0, pages: records.length, uniqueRecords: 0 };

  async function embedQr(qr: Awaited<ReturnType<typeof qrPaths>>) {
    // A transparency group applies layer opacity once to the entire QR, including
    // its background, just like compositing the preview image onto the canvas.
    const scratch = doc.addPage([qr.size, qr.size]);
    try {
      scratch.pushOperators(concatTransformationMatrix(1, 0, 0, 1, 0, qr.size));
      for (const item of qr.paths) {
        const m = item.matrix;
        scratch.pushOperators(pushGraphicsState(), concatTransformationMatrix(m.a, -m.b, -m.c, m.d, m.e, -m.f));
        const operations = drawSvgPath(item.path, { x: 0, y: 0, scale: 1, color: color(item.fill), borderColor: undefined, borderWidth: 0 });
        scratch.pushOperators(...operations.map(operator => item.evenOdd && operator.toString() === "f"
          ? PDFOperator.of(PDFOperatorNames.FillEvenOdd) : operator), popGraphicsState());
      }
      const form = await doc.embedPage(scratch);
      await form.embed();
      doc.context.lookup(form.ref, PDFStream).dict.set(PDFName.of("Group"), doc.context.obj({ S: "Transparency", I: true, K: false }));
      return form;
    } finally { doc.removePage(doc.getPageCount() - 1); }
  }

  async function fontFor(weight: number) {
    let font = fonts.get(weight);
    if (!font) {
      const response = await fetch(productionFontUrls[weight]);
      if (!response.ok) throw new Error("Could not load the bundled production font.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      font = { font: await doc.embedFont(bytes, { subset: true }), shaper: fontkit.create(bytes) };
      fonts.set(weight, font);
    }
    return font;
  }

  async function rasterLayer(page: PDFPage, layer: ProjectLayer, record: RenderRecord) {
    const isolated = { ...project, document: { ...project.document, transparentBackground: true, backgroundOpacity: 0 }, layers: [layer] };
    const blob = await renderProjectPngBlob(isolated, record, { includeGuides: false });
    const image = await doc.embedPng(await blob.arrayBuffer());
    page.drawImage(image, { x: 0, y: 0, width: geometry.points.width, height: geometry.points.height });
    stats.rasterLayers++;
  }

  async function textLines(layer: TextLayer, record: RenderRecord) {
    const node = new Konva.Text({ width: layer.width, height: layer.height, ...textLayerProps(layer, record) });
    try {
      const metrics = node.measureSize("M");
      const baseline = (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + layer.fontSize / 2;
      const top = (layer.height - node.textArr.length * layer.fontSize) / 2;
      const { font, shaper } = await fontFor(layer.fontWeight);
      const characterSet = new Set(font.getCharacterSet());
      const lines = node.textArr.map((line, index) => ({ text: line.text,
        x: layer.align === "center" ? (layer.width - line.width) / 2 : layer.align === "right" ? layer.width - line.width : 0,
        y: -(top + index * layer.fontSize + baseline),
      }));
      if (lines.some(line => [...line.text].some(character => !characterSet.has(character.codePointAt(0)!)))) return undefined;
      const shaped: {code:PDFHexString;x:number;y:number}[][]=[];
      for (const line of lines) {
        // Keep embedded/subset glyph IDs, but position them using the same canvas
        // metrics as the editor. Native hinting can change advances by platform.
        const run = shaper.layout(line.text);
        const origins=canvasGlyphOrigins(line.text,run.glyphs.map(glyph=>glyph.codePoints),text=>node.measureSize(text).width);
        if(!origins)return undefined;
        const encoded = font.encodeText(line.text).asString();
        if (encoded.length !== run.positions.length * 4) throw new Error("Unexpected production font encoding.");
        let y = line.y;
        const scale = layer.fontSize / shaper.unitsPerEm;
        shaped.push(run.positions.map((position, index) => {
          const glyph = { code: PDFHexString.of(encoded.slice(index * 4, index * 4 + 4)),
            x: line.x + origins[index] + position.xOffset * scale, y: y + position.yOffset * scale };
          y += position.yAdvance * scale;
          return glyph;
        }));
      }
      return { lines: shaped, font };
    } finally { node.destroy(); }
  }

  for (const record of records) {
    control.onProgress?.({stage:"artwork",completed:doc.getPageCount(),total:records.length});
    await exportYield(control.signal);
    const page = doc.addPage([geometry.points.width, geometry.points.height]);
    page.setBleedBox(0, 0, geometry.points.width, geometry.points.height);
    page.setTrimBox(geometry.bleedPoints, geometry.bleedPoints, geometry.trimPoints.width, geometry.trimPoints.height);
    const repeat = repeats.get(record);
    if (repeat) {
      repeat.embedded ??= await doc.embedPage(repeat.page);
      page.drawPage(repeat.embedded);
      continue;
    }
    stats.uniqueRecords++;
    if (!project.document.transparentBackground && project.document.backgroundOpacity > 0) {
      if (!/^#[a-f\d]{6}$/i.test(project.document.backgroundColor)) throw new Error("Production page color must use a six-digit hex color.");
      page.drawRectangle({ x: 0, y: 0, width: geometry.points.width, height: geometry.points.height,
        color: color(project.document.backgroundColor), opacity: project.document.backgroundOpacity });
    }
    for (const layer of project.layers.filter(layer => layer.visible && layer.opacity > 0)) {
      control.signal?.throwIfAborted();
      if (layer.type === "text" && (layer.fill === "transparent" || layer.fillOpacity === 0) && !layer.shadowEnabled) continue;
      if (rasterReason(layer)) { await rasterLayer(page, layer, record); continue; }
      let qr: Awaited<ReturnType<typeof qrPaths>> | undefined;
      let qrForm: PDFEmbeddedPage | undefined;
      let text: Awaited<ReturnType<typeof textLines>>;
      if (layer.type === "qr") {
        try { qr = await qrPaths(layer, record); qrForm = await embedQr(qr); } catch (error) {
          issues.push({ severity: "warning", code: "raster-qr", layerId: layer.id, message: `${layer.name}: QR rendered as an image (${String(error)}).` });
          await rasterLayer(page, layer, record); continue;
        }
      }
      if (layer.type === "text") {
        text = await textLines(layer, record);
        if (!text) {
          issues.push({ severity: "warning", code: "raster-glyphs", layerId: layer.id, message: `${layer.name}: unsupported characters or text shaping were preserved as an image.` });
          await rasterLayer(page, layer, record); continue;
        }
      }
      layerTransform(page, layer, project);
      try {
        if (layer.type === "shape") {
          const ellipse = layer.shape === "ellipse";
          if (ellipse) page.pushOperators(concatTransformationMatrix(1, 0, 0, 1, -layer.width / 2, layer.height / 2));
          page.drawSvgPath(outlinePath(layer.width, layer.height, layer), {
            color: layer.fill === "transparent" || layer.fillOpacity === 0 ? undefined : color(layer.fill),
            opacity: layer.opacity * layer.fillOpacity,
            borderColor: layer.stroke === "transparent" || layer.strokeWidth === 0 ? undefined : color(layer.stroke),
            borderWidth: layer.stroke === "transparent" || layer.strokeOpacity === 0 ? 0 : layer.strokeWidth,
            borderOpacity: layer.opacity * layer.strokeOpacity, borderDashArray: layer.dash,
          });
        } else if (layer.type === "qr" && qrForm) {
          // The editor has a rounded background plate beneath the QR image.
          // Preserve its separate opacity as well as the image's own background.
          if (layer.background !== "transparent") page.drawSvgPath(outlinePath(layer.width, layer.height,
            { ...project.document.shape, shape: "rectangle", cornerRadius: 6 }), { color: color(layer.background), opacity: layer.opacity });
          page.drawPage(qrForm, { x: 0, y: -layer.height, width: layer.width, height: layer.height, opacity: layer.opacity });
        } else if (layer.type === "text" && text) {
          const key = page.node.newFontDictionary(text.font.name, text.font.ref);
          const state = page.node.newExtGState("TextAlpha", doc.context.obj({ Type: "ExtGState", ca: layer.opacity * layer.fillOpacity }));
          page.pushOperators(beginText(), setFontAndSize(key, layer.fontSize), setFillingColor(color(layer.fill)), setGraphicsState(state));
          for (const line of text.lines) for (const glyph of line) {
            page.pushOperators(setTextMatrix(1, 0, 0, 1, glyph.x, glyph.y), showText(glyph.code));
          }
          page.pushOperators(endText());
        }
        stats.vectorLayers++;
      } finally { page.pushOperators(popGraphicsState()); }
    }
    repeats.set(record, { page });
  }
  const bytes = await doc.save();
  control.signal?.throwIfAborted();
  control.onProgress?.({stage:"artwork",completed:records.length,total:records.length});
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const distinctIssues = issues.filter((issue, index) => issues.findIndex(candidate =>
    candidate.code === issue.code && candidate.layerId === issue.layerId && candidate.message === issue.message) === index);
  return { blob: new Blob([buffer], { type: "application/pdf" }), issues: distinctIssues, stats, cutSvg: cutOutlineSvg(project) };
}
