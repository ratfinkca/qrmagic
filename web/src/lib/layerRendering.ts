import type { ProjectLayer, ShapeGeometry, ShapeLayer, TextLayer, RenderRecord } from "../types";
import { polygonPath } from "./shapeGeometry";
import { renderTemplate } from "./serial";

// Shared by the interactive preview and the offscreen production renderer.
export function colorWithOpacity(color: string, opacity: number) {
  const normalized = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return color;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
}

export function layerShadowProps(layer: ProjectLayer) {
  return {
    shadowEnabled: layer.shadowEnabled,
    shadowColor: colorWithOpacity(layer.shadowColor, layer.shadowOpacity),
    shadowBlur: layer.shadowBlur,
    shadowOffsetX: layer.shadowOffsetX,
    shadowOffsetY: layer.shadowOffsetY,
  };
}

export function shapeFillProps(layer: ShapeLayer) {
  if (layer.fillMode === "linear-gradient") {
    const angle = (layer.fillGradientAngle * Math.PI) / 180;
    const centerX = layer.width / 2;
    const centerY = layer.height / 2;
    const radius = Math.hypot(layer.width, layer.height) / 2;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    return {
      fill: undefined,
      fillLinearGradientStartPoint: { x: centerX - dx, y: centerY - dy },
      fillLinearGradientEndPoint: { x: centerX + dx, y: centerY + dy },
      fillLinearGradientColorStops: [
        0, colorWithOpacity(layer.fillGradientFrom, layer.fillOpacity),
        1, colorWithOpacity(layer.fillGradientTo, layer.fillOpacity),
      ],
    };
  }
  if (layer.fillMode === "radial-gradient") {
    return {
      fill: undefined,
      fillRadialGradientStartPoint: { x: layer.width / 2, y: layer.height / 2 },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndPoint: { x: layer.width / 2, y: layer.height / 2 },
      fillRadialGradientEndRadius: Math.max(layer.width, layer.height) / 2,
      fillRadialGradientColorStops: [
        0, colorWithOpacity(layer.fillGradientFrom, layer.fillOpacity),
        1, colorWithOpacity(layer.fillGradientTo, layer.fillOpacity),
      ],
    };
  }
  return { fill: colorWithOpacity(layer.fill, layer.fillOpacity) };
}

export function shapeGeometryProps(
  width: number, height: number, geometry: ShapeGeometry, x = 0, y = 0,
) {
  if (geometry.shape === "ellipse") {
    return { kind: "Ellipse" as const, props: {
      x: x + width / 2, y: y + height / 2, radiusX: width / 2, radiusY: height / 2,
    } };
  }
  if (geometry.shape === "rectangle" || geometry.shape === "pill") {
    return { kind: "Rect" as const, props: {
      x, y, width, height,
      cornerRadius: geometry.shape === "pill" ? Math.min(width, height) / 2 : geometry.cornerRadius,
    } };
  }
  return { kind: "Path" as const, props: { x, y, data: polygonPath(width, height, geometry) } };
}

export function textLayerProps(layer: TextLayer, record: RenderRecord) {
  return {
    text: renderTemplate(layer.textTemplate, record, layer.dataGroupId),
    fontFamily: layer.fontFamily, fontSize: layer.fontSize,
    fontStyle: String(layer.fontWeight), fill: colorWithOpacity(layer.fill, layer.fillOpacity),
    align: layer.align, verticalAlign: "middle",
    ...layerShadowProps(layer),
  };
}

