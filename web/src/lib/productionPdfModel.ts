import type { ProjectLayer, QrMagicProject, ShapeGeometry } from "../types";
import { productionGeometry } from "./production";
import { dataRecordCount, renderTemplate, createDataRecords } from "./serial";
import { polygonPath } from "./shapeGeometry";

export type ProductionIssue = { severity: "error" | "warning"; code: string; message: string; layerId?: string };

export function canvasGlyphOrigins(text:string,clusters:readonly (readonly number[])[],measure:(text:string)=>number):number[]|undefined {
  const characters=Array.from(text);
  if(clusters.some(cluster=>cluster.length===0)||clusters.reduce((sum,cluster)=>sum+cluster.length,0)!==characters.length)return undefined;
  let consumed=0;
  return clusters.map(cluster=>{
    const start=consumed;consumed+=cluster.length;
    // Prefix measurement includes kerning against the preceding cluster and the
    // browser's platform-specific hinted advances. Keep a ligature as one glyph.
    return measure(characters.slice(0,consumed).join(""))-measure(characters.slice(start,consumed).join(""));
  });
}

export function rasterReason(layer: ProjectLayer): string | undefined {
  if (layer.shadowEnabled) return "shadow effects";
  if (layer.type === "image") return "imported image artwork";
  if (layer.type === "shape") {
    if (layer.fillMode !== "solid") return "gradient fill";
    if (layer.opacity < 1 && layer.strokeWidth > 0) return "combined translucent fill and stroke";
  }
  if (layer.type === "qr" && layer.logoEnabled && layer.logoSrc) return "embedded QR logo";
  if (layer.type === "text" && (!/^Inter(?:\s*,|$)/i.test(layer.fontFamily) || ![400, 700, 800].includes(layer.fontWeight))) {
    return "a font or weight outside the bundled Inter family";
  }
  const colors = layer.type === "shape" ? [layer.fill, layer.stroke] : layer.type === "qr"
    ? [layer.foreground, layer.background] : layer.type === "text" ? [layer.fill] : [];
  if (colors.some(color => color !== "transparent" && !/^#[a-f\d]{6}$/i.test(color))) return "an unsupported vector color";
}

export function productionPreflight(project: QrMagicProject): ProductionIssue[] {
  const issues: ProductionIssue[] = [];
  try { productionGeometry(project); } catch (error) {
    return [{ severity: "error", code: "document-size", message: String(error) }];
  }
  if (!project.document.transparentBackground && project.document.backgroundOpacity > 0 && !/^#[a-f\d]{6}$/i.test(project.document.backgroundColor)) {
    issues.push({ severity: "error", code: "page-color", message: "Page color must use a six-digit hex color for production PDF." });
  }
  const recordCount = dataRecordCount(project.data.groups);
  // Only the first value is needed here; shorter serial ranges are checked explicitly below.
  const first = createDataRecords(project.data.groups.map(group => group.mode === "serial"
    ? { ...group, serial: { ...group.serial, quantity: 1 } } : { ...group, fixed: { ...group.fixed, quantity: 1 } }))[0];
  for (const layer of project.layers.filter(layer => layer.visible && layer.opacity > 0)) {
    if (![layer.width, layer.height].every(value => Number.isFinite(value) && value > 0) ||
        ![layer.x, layer.y, layer.rotation, layer.opacity].every(Number.isFinite)) {
      issues.push({ severity: "error", code: "layer-size", layerId: layer.id, message: `${layer.name}: invalid position or dimensions.` });
    }
    const reason = rasterReason(layer);
    if (reason) issues.push({ severity: "warning", code: "raster-layer", layerId: layer.id,
      message: `${layer.name}: rendered as an image to preserve ${reason}.` });
    if (layer.type !== "qr") continue;
    if (!renderTemplate(layer.payloadTemplate, first, layer.dataGroupId).trim()) {
      issues.push({ severity: "error", code: "empty-qr", layerId: layer.id, message: `${layer.name}: QR content is empty.` });
    }
    const source = layer.dataGroupId ? project.data.groups.find(group => group.id === layer.dataGroupId) : project.data.groups[0];
    if (layer.payloadTemplate.includes("{{serial}}") && (!source || source.mode === "serial" && source.serial.quantity < recordCount)) {
      issues.push({ severity: "error", code: "missing-serial", layerId: layer.id, message: `${layer.name}: the content source does not cover every record.` });
    }
    if (Math.abs(layer.width - layer.height) > 0.01) issues.push({ severity: "warning", code: "stretched-qr", layerId: layer.id,
      message: `${layer.name}: QR is stretched. Use equal width and height and test a physical print.` });
    if (layer.margin < 1) issues.push({ severity: "warning", code: "quiet-zone", layerId: layer.id,
      message: `${layer.name}: no clear quiet-zone margin is configured.` });
  }
  return issues;
}

export function outlinePath(width: number, height: number, shape: ShapeGeometry): string {
  if (shape.shape === "ellipse") {
    return `M 0 ${height / 2} A ${width / 2} ${height / 2} 0 1 0 ${width} ${height / 2} A ${width / 2} ${height / 2} 0 1 0 0 ${height / 2} Z`;
  }
  if (shape.shape !== "rectangle" && shape.shape !== "pill") return polygonPath(width, height, shape);
  const radius = shape.shape === "pill" ? Math.min(width, height) / 2 : Math.max(0, Math.min(shape.cornerRadius, width / 2, height / 2));
  if (!radius) return `M 0 0 H ${width} V ${height} H 0 Z`;
  const arc = `A ${radius} ${radius} 0 0 1`;
  return `M ${radius} 0 H ${width - radius} ${arc} ${width} ${radius} V ${height - radius} ${arc} ${width - radius} ${height} H ${radius} ${arc} 0 ${height - radius} V ${radius} ${arc} ${radius} 0 Z`;
}

export function cutOutlineSvg(project: QrMagicProject) {
  const { points, trimPoints, bleedPoints } = productionGeometry(project);
  const shape = { ...project.document.shape, cornerRadius: project.document.shape.cornerRadius * 72 / project.document.dpi };
  const rounded = (value: number) => Number(value.toFixed(6));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${rounded(points.width / 72 * 25.4)}mm" height="${rounded(points.height / 72 * 25.4)}mm" viewBox="0 0 ${rounded(points.width)} ${rounded(points.height)}"><title>Finished cut outline — reference geometry</title><path transform="translate(${rounded(bleedPoints)} ${rounded(bleedPoints)})" d="${outlinePath(trimPoints.width, trimPoints.height, shape)}" fill="none" stroke="#ff00ff" stroke-width="0.25"/></svg>`;
}
