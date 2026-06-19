import type { ShapeGeometry } from "../types";

export function clampStarPoints(points: number) {
  return Math.max(3, Math.min(12, Math.round(points)));
}

export function clampStarInnerRadiusRatio(ratio: number) {
  return Math.max(0.1, Math.min(0.9, ratio));
}

export function normalizedShapeGeometry(shape: Partial<ShapeGeometry>): ShapeGeometry {
  return {
    shape: shape.shape ?? "rectangle",
    cornerRadius: Math.max(0, shape.cornerRadius ?? 0),
    starPoints: clampStarPoints(shape.starPoints ?? 5),
    starInnerRadiusRatio: clampStarInnerRadiusRatio(shape.starInnerRadiusRatio ?? 0.5),
  };
}

export function starPolygonPoints(
  width: number,
  height: number,
  points: number,
  innerRadiusRatio: number,
) {
  const pointCount = clampStarPoints(points);
  const innerRatio = clampStarInnerRadiusRatio(innerRadiusRatio);
  const outerRadius = Math.min(width, height) / 2;
  const innerRadius = outerRadius * innerRatio;
  const centerX = width / 2;
  const centerY = height / 2;

  return Array.from({ length: pointCount * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (index * Math.PI) / pointCount;
    return [centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius];
  }).flat();
}
