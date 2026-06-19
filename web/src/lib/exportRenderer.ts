import QRCode from "qrcode";
import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFOperator,
  PDFOperatorNames,
  PDFString,
} from "pdf-lib";
import type { ProjectLayer, QrMagicProject, RenderRecord } from "../types";
import { documentPixelSize, guideSnapRect } from "./project";
import { renderTemplate } from "./serial";

type RenderOptions = {
  includeGuides: boolean;
};
export type GuideExportLayer = "bleed" | "trim" | "safeArea";
export type RasterExportFormat = "png" | "jpg";

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function colorWithOpacity(color: string, opacity: number) {
  if (color === "transparent") {
    return color;
  }

  const normalized = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return color;
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
}

function loadImage(src: string) {
  const cachedImage = imageCache.get(src);
  if (cachedImage) return cachedImage;

  const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image layer asset."));
    image.src = src;
  });
  imageCache.set(src, imagePromise);
  return imagePromise;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(safeRadius, 0);
  context.lineTo(width - safeRadius, 0);
  context.quadraticCurveTo(width, 0, width, safeRadius);
  context.lineTo(width, height - safeRadius);
  context.quadraticCurveTo(width, height, width - safeRadius, height);
  context.lineTo(safeRadius, height);
  context.quadraticCurveTo(0, height, 0, height - safeRadius);
  context.lineTo(0, safeRadius);
  context.quadraticCurveTo(0, 0, safeRadius, 0);
  context.closePath();
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
  draw();
  context.restore();
}

function drawShapeLayer(context: CanvasRenderingContext2D, layer: ProjectLayer) {
  if (layer.type !== "shape") return;

  drawLayerFrame(context, layer, () => {
    roundedRect(context, layer.width, layer.height, layer.cornerRadius);
    context.fillStyle = colorWithOpacity(layer.fill, layer.fillOpacity);
    context.fill();

    if (layer.strokeWidth > 0 && layer.stroke !== "transparent") {
      context.strokeStyle = colorWithOpacity(layer.stroke, layer.strokeOpacity);
      context.lineWidth = layer.strokeWidth;
      context.setLineDash(layer.dash);
      context.stroke();
      context.setLineDash([]);
    }
  });
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

  const dataUrl = await QRCode.toDataURL(
    renderTemplate(layer.payloadTemplate, record, layer.dataGroupId),
    {
      margin: 2,
      color: {
        dark: layer.foreground,
        light: layer.background,
      },
      errorCorrectionLevel: "M",
      width: Math.max(layer.width, layer.height),
    },
  );
  const qrImage = await loadImage(dataUrl);

  drawLayerFrame(context, layer, () => {
    context.fillStyle = layer.background;
    roundedRect(context, layer.width, layer.height, 6);
    context.fill();
    context.drawImage(qrImage, 0, 0, layer.width, layer.height);
  });
}

function drawTextLayer(
  context: CanvasRenderingContext2D,
  layer: ProjectLayer,
  record: RenderRecord,
) {
  if (layer.type !== "text") return;

  drawLayerFrame(context, layer, () => {
    const text = renderTemplate(layer.textTemplate, record, layer.dataGroupId);
    context.fillStyle = colorWithOpacity(layer.fill, layer.fillOpacity);
    context.font = `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
    context.textAlign = layer.align;
    context.textBaseline = "middle";

    const textX =
      layer.align === "center" ? layer.width / 2 : layer.align === "right" ? layer.width : 0;
    context.fillText(text, textX, layer.height / 2, layer.width);
  });
}

function drawGuideLayer(
  context: CanvasRenderingContext2D,
  project: QrMagicProject,
  guideLayer: GuideExportLayer,
) {
  if (!project.document.guides.enabled) return;

  const size = documentPixelSize(project);
  const bleedRect = guideSnapRect(project, "bleed");
  const safeAreaRect = guideSnapRect(project, "safeArea");

  context.save();
  context.lineWidth = 2;

  if (guideLayer === "bleed" && project.document.guides.showBleed) {
    context.strokeStyle = "#f97316";
    context.globalAlpha = 0.9;
    context.setLineDash([10, 8]);
    context.strokeRect(bleedRect.x, bleedRect.y, bleedRect.width, bleedRect.height);
  }

  if (guideLayer === "trim" && project.document.guides.showTrim) {
    context.strokeStyle = "#0f172a";
    context.globalAlpha = 0.75;
    context.setLineDash([18, 12]);
    context.strokeRect(0.5, 0.5, size.width - 1, size.height - 1);
  }

  if (guideLayer === "safeArea" && project.document.guides.showSafeArea) {
    context.strokeStyle = "#0f766e";
    context.globalAlpha = 0.9;
    context.setLineDash([6, 8]);
    context.strokeRect(safeAreaRect.x, safeAreaRect.y, safeAreaRect.width, safeAreaRect.height);
  }

  context.restore();
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

  const size = documentPixelSize(project);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create export canvas.");
  }

  if (!project.document.transparentBackground) {
    context.fillStyle = project.document.backgroundColor;
    context.fillRect(0, 0, size.width, size.height);
  }

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
  const size = documentPixelSize(project);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create guide canvas.");
  }

  drawGuideLayer(context, project, guideLayer);
  return canvasToImageBlob(canvas, "png");
}

function documentPointSize(project: QrMagicProject) {
  if (project.document.unit === "px") {
    return {
      width: (project.document.width / project.document.dpi) * 72,
      height: (project.document.height / project.document.dpi) * 72,
    };
  }

  if (project.document.unit === "mm") {
    return {
      width: (project.document.width / 25.4) * 72,
      height: (project.document.height / 25.4) * 72,
    };
  }

  return {
    width: project.document.width * 72,
    height: project.document.height * 72,
  };
}

function blobToBytes(blob: Blob) {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

function pdfBytesToBlob(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}

async function drawPngBlobOnPage(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  blob: Blob,
) {
  const pageSize = page.getSize();
  const image = await pdfDoc.embedPng(await blobToBytes(blob));
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: pageSize.width,
    height: pageSize.height,
  });
}

export async function renderProjectPdfBlob(
  project: QrMagicProject,
  records: RenderRecord[],
  options: RenderOptions,
) {
  const pdfDoc = await PDFDocument.create();
  const pageSize = documentPointSize(project);

  for (const record of records) {
    const page = pdfDoc.addPage([pageSize.width, pageSize.height]);
    const pngBlob = await renderProjectPngBlob(project, record, options);
    await drawPngBlobOnPage(pdfDoc, page, pngBlob);
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
      Name: PDFString.of("QR Magic template layers"),
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
