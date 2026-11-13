import Konva from "konva";
import { SceneCanvas } from "konva/lib/Canvas";
import { colorWithOpacity, layerShadowProps, shapeFillProps, shapeGeometryProps, textLayerProps } from "./layerRendering";
import { renderLayerValue } from "./serial";
import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFOperator,
  PDFOperatorNames,
  PDFString,
} from "pdf-lib";
import { productionGeometry } from "./production";
import type { ProjectLayer, QrMagicProject, RenderRecord } from "../types";
import { guideSnapRect } from "./project";
import { renderStyledQrDataUrl } from "./qrStyling";


type RenderOptions = {
  includeGuides: boolean;
};
export type GuideExportLayer = "bleed" | "trim" | "safeArea";
export type RasterExportFormat = "png" | "jpg";

const renderCanvases = new WeakMap<CanvasRenderingContext2D, { scene: SceneCanvas; buffer: SceneCanvas }>();

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string, cache = true) {
  const cachedImage = cache ? imageCache.get(src) : undefined;
  if (cachedImage) return cachedImage;

  const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image layer asset."));
    image.src = src;
  });
  if (cache) imageCache.set(src, imagePromise);
  return imagePromise;
}

function drawLayerFrame(
  context: CanvasRenderingContext2D,
  layer: ProjectLayer,
  draw: () => void,
) {
  context.save();
  context.globalAlpha *= layer.opacity;
  context.translate(layer.x, layer.y);
  context.rotate((layer.rotation * Math.PI) / 180);
  if (layer.shadowEnabled) {
    context.shadowColor = colorWithOpacity(layer.shadowColor, layer.shadowOpacity);
    context.shadowBlur = layer.shadowBlur;
    context.shadowOffsetX = layer.shadowOffsetX;
    context.shadowOffsetY = layer.shadowOffsetY;
  }
  draw();
  context.restore();
}

function paintNode(context: CanvasRenderingContext2D, node: Konva.Node) {
  try {
    // Draw into the final surface to avoid a second alpha-compositing round trip.
    const target = renderCanvases.get(context)!;
    node.drawScene(target.scene, undefined, target.buffer);
  } finally { node.destroy(); }
}

function drawShapeLayer(context: CanvasRenderingContext2D, layer: ProjectLayer) {
  if (layer.type !== "shape") return;
  const geometry = shapeGeometryProps(layer.width, layer.height, layer, layer.x, layer.y);
  const config = { ...geometry.props, ...shapeFillProps(layer), ...layerShadowProps(layer),
    rotation: layer.rotation, opacity: layer.opacity, stroke: colorWithOpacity(layer.stroke, layer.strokeOpacity),
    strokeWidth: layer.strokeWidth, dash: layer.dash };
  paintNode(context, geometry.kind === "Ellipse"
    ? new Konva.Ellipse({ ...config, radiusX: layer.width / 2, radiusY: layer.height / 2 })
    : geometry.kind === "Rect" ? new Konva.Rect(config) : new Konva.Path(config));
}

async function drawImageLayer(context: CanvasRenderingContext2D, layer: ProjectLayer) {
  if (layer.type !== "image") return;

  const image = await loadImage(layer.src);
  drawLayerFrame(context, layer, () => {
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    let targetX = 0;
    let targetY = 0;
    let targetWidth = layer.width;
    let targetHeight = layer.height;

    if (layer.fit === "contain" || layer.fit === "original") {
      const scale =
        layer.fit === "original"
          ? 1
          : Math.min(layer.width / image.naturalWidth, layer.height / image.naturalHeight);
      targetWidth = image.naturalWidth * scale;
      targetHeight = image.naturalHeight * scale;
      targetX = (layer.width - targetWidth) / 2;
      targetY = (layer.height - targetHeight) / 2;
    }

    if (layer.fit === "cover") {
      const scale = Math.max(layer.width / image.naturalWidth, layer.height / image.naturalHeight);
      sourceWidth = layer.width / scale;
      sourceHeight = layer.height / scale;
      sourceX = (image.naturalWidth - sourceWidth) / 2;
      sourceY = (image.naturalHeight - sourceHeight) / 2;
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      targetX,
      targetY,
      targetWidth,
      targetHeight,
    );
  });
}

async function drawQrLayer(
  context: CanvasRenderingContext2D,
  layer: ProjectLayer,
  record: RenderRecord,
) {
  if (layer.type !== "qr") return;
  if (layer.csvColumn && (layer.opacity <= 0 || !renderLayerValue(layer, record))) return;

  const dataUrl = await renderStyledQrDataUrl(layer, record);
  // Generated serial QR PNGs are ephemeral; retaining them here would bypass
  // the layout preview's bounded thumbnail cache and survive workspace closure.
  const qrImage = await loadImage(dataUrl, false);

  const group = new Konva.Group({ x: layer.x, y: layer.y, rotation: layer.rotation, opacity: layer.opacity });
  group.add(new Konva.Rect({ width: layer.width, height: layer.height, fill: layer.background, cornerRadius: 6, ...layerShadowProps(layer) }));
  group.add(new Konva.Image({ image: qrImage, width: layer.width, height: layer.height }));
  paintNode(context, group);
}

function drawTextLayer(
  context: CanvasRenderingContext2D,
  layer: ProjectLayer,
  record: RenderRecord,
) {
  if (layer.type !== "text") return;

  paintNode(context, new Konva.Text({ x: layer.x, y: layer.y, width: layer.width, height: layer.height,
    rotation: layer.rotation, opacity: layer.opacity, ...textLayerProps(layer, record) }));
}

function drawGuideLayer(context: CanvasRenderingContext2D, project: QrMagicProject, guideLayer: GuideExportLayer) {
  const guides = project.document.guides;
  if (!guides.enabled) return;
  const visible = guideLayer === "trim" ? guides.showTrim : guideLayer === "bleed" ? guides.showBleed : guides.showSafeArea;
  if (!visible) return;
  const rect = guideSnapRect(project, guideLayer);
  const style = guideLayer === "bleed" ? { stroke: "#f97316", dash: [10, 8], opacity: 0.9 }
    : guideLayer === "trim" ? { stroke: "#0f172a", dash: [18, 12], opacity: 0.75 }
    : { stroke: "#0f766e", dash: [6, 8], opacity: 0.9 };
  const geometry = shapeGeometryProps(rect.width, rect.height, project.document.shape, rect.x, rect.y);
  const config = { ...geometry.props, ...style, strokeWidth: 2 };
  const node = guideLayer === "bleed" ? new Konva.Rect({ ...rect, ...style, strokeWidth: 2 })
    : geometry.kind === "Ellipse" ? new Konva.Ellipse({ ...config, radiusX: rect.width / 2, radiusY: rect.height / 2 })
    : geometry.kind === "Rect" ? new Konva.Rect(config) : new Konva.Path(config);
  paintNode(context, node);
}

function makeExportCanvas(project: QrMagicProject) {
  const geometry = productionGeometry(project);
  const scene = new SceneCanvas({ ...geometry.output, pixelRatio: 1 });
  const canvas = scene._canvas;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create export canvas.");
  renderCanvases.set(context, { scene, buffer: new SceneCanvas({ ...geometry.output, pixelRatio: 1 }) });
  return { geometry, canvas, context };
}

function drawGuides(context: CanvasRenderingContext2D, project: QrMagicProject) {
  drawGuideLayer(context, project, "bleed");
  drawGuideLayer(context, project, "trim");
  drawGuideLayer(context, project, "safeArea");
}

function canvasToImageBlob(canvas: HTMLCanvasElement, format: RasterExportFormat) {
  return new Promise<Blob>((resolve, reject) => {
    const outputCanvas = format === "jpg" ? flattenCanvasForJpg(canvas) : canvas;
    outputCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error(`Could not export ${format.toUpperCase()}.`));
    }, format === "jpg" ? "image/jpeg" : "image/png", format === "jpg" ? 0.94 : undefined);
  });
}

function flattenCanvasForJpg(canvas: HTMLCanvasElement) {
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = canvas.width;
  outputCanvas.height = canvas.height;
  const context = outputCanvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create JPG export canvas.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  context.drawImage(canvas, 0, 0);
  return outputCanvas;
}

async function renderProjectCanvas(
  project: QrMagicProject,
  record: RenderRecord,
  options: RenderOptions,
) {
  await document.fonts?.ready;

  const { geometry, canvas, context } = makeExportCanvas(project);

  if (!project.document.transparentBackground) {
    context.fillStyle = colorWithOpacity(project.document.backgroundColor, project.document.backgroundOpacity);
    context.fillRect(0, 0, geometry.output.width, geometry.output.height);
  }

  context.translate(geometry.bleedPixels, geometry.bleedPixels);
  for (const layer of project.layers) {
    if (!layer.visible) continue;
    if (layer.type === "shape") drawShapeLayer(context, layer);
    if (layer.type === "image") await drawImageLayer(context, layer);
    if (layer.type === "qr") await drawQrLayer(context, layer, record);
    if (layer.type === "text") drawTextLayer(context, layer, record);
  }

  if (options.includeGuides) {
    drawGuides(context, project);
  }

  return canvas;
}

export async function renderProjectImageBlob(
  project: QrMagicProject,
  record: RenderRecord,
  options: RenderOptions & { format: RasterExportFormat },
) {
  const canvas = await renderProjectCanvas(project, record, options);
  return canvasToImageBlob(canvas, options.format);
}

export async function renderProjectPngBlob(
  project: QrMagicProject,
  record: RenderRecord,
  options: RenderOptions,
) {
  return renderProjectImageBlob(project, record, { ...options, format: "png" });
}

export function renderGuidePngBlob(project: QrMagicProject, guideLayer: GuideExportLayer) {
  const { canvas, context, geometry } = makeExportCanvas(project);
  context.translate(geometry.bleedPixels, geometry.bleedPixels);

  drawGuideLayer(context, project, guideLayer);
  return canvasToImageBlob(canvas, "png");
}

function documentPointSize(project: QrMagicProject) {
  return productionGeometry(project).points;
}

function setProductionBoxes(page: ReturnType<PDFDocument["addPage"]>, project: QrMagicProject) {
  const geometry = productionGeometry(project);
  page.setBleedBox(0, 0, geometry.points.width, geometry.points.height);
  page.setTrimBox(geometry.bleedPoints, geometry.bleedPoints, geometry.trimPoints.width, geometry.trimPoints.height);
}

function blobToBytes(blob: Blob) {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

function pdfBytesToBlob(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}

export async function renderProjectPdfBlob(
  project: QrMagicProject,
  records: RenderRecord[],
  options: RenderOptions,
) {
  const pdfDoc = await PDFDocument.create();
  const pageSize = documentPointSize(project);
  let previousRecord: RenderRecord | undefined;
  let previousImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | undefined;

  for (const record of records) {
    const page = pdfDoc.addPage([pageSize.width, pageSize.height]);
    setProductionBoxes(page, project);
    if (record !== previousRecord || !previousImage) {
      const pngBlob = await renderProjectPngBlob(project, record, options);
      previousImage = await pdfDoc.embedPng(await blobToBytes(pngBlob));
      previousRecord = record;
    }
    page.drawImage(previousImage, { x: 0, y: 0, width: pageSize.width, height: pageSize.height });
  }

  const bytes = await pdfDoc.save();
  return pdfBytesToBlob(bytes);
}

function createOptionalContentGroup(pdfDoc: PDFDocument, label: string) {
  const group = pdfDoc.context.obj({
    Type: PDFName.of("OCG"),
    Name: PDFString.of(label),
  });
  return pdfDoc.context.register(group);
}

function addOptionalContentProperties(
  pdfDoc: PDFDocument,
  groups: Array<{ name: string; ref: ReturnType<typeof createOptionalContentGroup> }>,
) {
  const groupRefs = groups.map((group) => group.ref);
  const groupArray = pdfDoc.context.obj(groupRefs);
  const properties = pdfDoc.context.obj({
    OCGs: groupArray,
    D: {
      Name: PDFString.of("QR Mystic template layers"),
      Order: groupArray,
      ON: groupArray,
      OFF: pdfDoc.context.obj([]),
    },
  });
  pdfDoc.catalog.set(PDFName.of("OCProperties"), properties);
}

function addPageLayerResource(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  name: string,
  ref: ReturnType<typeof createOptionalContentGroup>,
) {
  const resources = page.node.normalizedEntries().Resources;
  let properties = resources.lookupMaybe(PDFName.of("Properties"), PDFDict);
  if (!properties) {
    properties = pdfDoc.context.obj({});
    resources.set(PDFName.of("Properties"), properties);
  }
  properties.set(PDFName.of(name), ref);
}

async function drawLayeredPngBlobOnPage(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  blob: Blob,
  layerName: string,
) {
  const pageSize = page.getSize();
  const image = await pdfDoc.embedPng(await blobToBytes(blob));
  page.pushOperators(
    PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
      PDFName.of("OC"),
      PDFName.of(layerName),
    ]),
  );
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: pageSize.width,
    height: pageSize.height,
  });
  page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent));
}

export async function renderLayeredTemplatePdfBlob(
  project: QrMagicProject,
  record: RenderRecord,
) {
  const pdfDoc = await PDFDocument.create();
  const pageSize = documentPointSize(project);
  const page = pdfDoc.addPage([pageSize.width, pageSize.height]);
  setProductionBoxes(page, project);
  const groups = [
    { name: "QRMagicArtwork", label: "Artwork" },
    { name: "QRMagicBleedGuide", label: "Bleed guide" },
    { name: "QRMagicTrimGuide", label: "Trim guide" },
    { name: "QRMagicSafeAreaGuide", label: "Safe-area guide" },
  ].map((group) => ({
    ...group,
    ref: createOptionalContentGroup(pdfDoc, group.label),
  }));
  addOptionalContentProperties(pdfDoc, groups);
  groups.forEach((group) => addPageLayerResource(pdfDoc, page, group.name, group.ref));

  const [artworkBlob, bleedBlob, trimBlob, safeAreaBlob] = await Promise.all([
    renderProjectPngBlob(project, record, { includeGuides: false }),
    renderGuidePngBlob(project, "bleed"),
    renderGuidePngBlob(project, "trim"),
    renderGuidePngBlob(project, "safeArea"),
  ]);

  await drawLayeredPngBlobOnPage(pdfDoc, page, artworkBlob, "QRMagicArtwork");
  await drawLayeredPngBlobOnPage(pdfDoc, page, bleedBlob, "QRMagicBleedGuide");
  await drawLayeredPngBlobOnPage(pdfDoc, page, trimBlob, "QRMagicTrimGuide");
  await drawLayeredPngBlobOnPage(pdfDoc, page, safeAreaBlob, "QRMagicSafeAreaGuide");

  const bytes = await pdfDoc.save();
  return pdfBytesToBlob(bytes);
}
