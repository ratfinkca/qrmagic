import type { ShapeGeometry, ShapeKind } from "../types";

type Point = {
  x: number;
  y: number;
};

const MIN_VERTICES = 3;
const MAX_VERTICES = 12;

export const SHAPE_OPTIONS: Array<{ value: ShapeKind; label: string }> = [
  { value: "rectangle", label: "Rectangle" },
  { value: "ellipse", label: "Circle / oval" },
  { value: "pill", label: "Pill" },
  { value: "polygon", label: "Polygon / star" },
  { value: "triangle", label: "Triangle" },
  { value: "diamond", label: "Diamond" },
  { value: "pentagon", label: "Pentagon" },
  { value: "hexagon", label: "Hexagon" },
  { value: "roundedHexagon", label: "Rounded hexagon" },
  { value: "octagon", label: "Octagon" },
  { value: "guitarPick", label: "Guitar pick" },
  { value: "shield", label: "Shield" },
];

export function clampVertices(vertices: number) {
  return Math.max(MIN_VERTICES, Math.min(MAX_VERTICES, Math.round(vertices)));
}

export function clampVertexInset(inset: number) {
  return Math.max(0.1, Math.min(1, inset));
}

export function clampVertexRadius(radius: number) {
  return Math.max(0, Math.min(0.45, radius));
}

export function clampSideDeflection(deflection: number) {
  return Math.max(-1, Math.min(1, deflection));
}

export function presetShapeGeometry(shape: ShapeKind): ShapeGeometry {
  const base: ShapeGeometry = {
    shape,
    cornerRadius: 0,
    vertices: 5,
    vertexInset: 1,
    vertexRadius: 0,
    sideDeflection: 0,
  };

  if (shape === "rectangle") return { ...base, cornerRadius: 12, vertices: 4 };
  if (shape === "ellipse") return { ...base, vertices: 64 };
  if (shape === "pill") return { ...base, cornerRadius: 999, vertices: 4 };
  if (shape === "triangle") return { ...base, vertices: 3 };
  if (shape === "diamond") return { ...base, vertices: 4 };
  if (shape === "pentagon") return { ...base, vertices: 5 };
  if (shape === "hexagon") return { ...base, vertices: 6 };
  if (shape === "roundedHexagon") return { ...base, vertices: 6, vertexRadius: 0.14 };
  if (shape === "octagon") return { ...base, vertices: 8 };
  if (shape === "guitarPick") {
    return { ...base, vertices: 3, vertexRadius: 0.22, sideDeflection: 0.35 };
  }
  if (shape === "shield") {
    return { ...base, vertices: 3, vertexRadius: 0.08, sideDeflection: -0.25 };
  }
  return base;
}

export function normalizedShapeGeometry(
  shape: Omit<Partial<ShapeGeometry>, "shape"> & {
    starPoints?: number;
    starInnerRadiusRatio?: number;
    shape?: ShapeKind | "star";
  },
): ShapeGeometry {
  if (shape.shape === "star") {
    return {
      ...presetShapeGeometry("polygon"),
      vertices: clampVertices(shape.starPoints ?? shape.vertices ?? 5),
      vertexInset: clampVertexInset(shape.starInnerRadiusRatio ?? shape.vertexInset ?? 0.5),
      vertexRadius: clampVertexRadius(shape.vertexRadius ?? 0),
      sideDeflection: clampSideDeflection(shape.sideDeflection ?? 0),
    };
  }

  const kind = (shape.shape ?? "rectangle") as ShapeKind;
  const preset = presetShapeGeometry(kind);
  return {
    ...preset,
    ...shape,
    shape: kind,
    cornerRadius: Math.max(0, shape.cornerRadius ?? preset.cornerRadius),
    vertices: clampVertices(shape.vertices ?? preset.vertices),
    vertexInset: clampVertexInset(shape.vertexInset ?? preset.vertexInset),
    vertexRadius: clampVertexRadius(shape.vertexRadius ?? preset.vertexRadius),
    sideDeflection: clampSideDeflection(shape.sideDeflection ?? preset.sideDeflection),
  };
}

function rotateOffsetForShape(shape: ShapeKind) {
  if (shape === "diamond") return -Math.PI / 4;
  if (shape === "shield") return Math.PI;
  return -Math.PI / 2;
}

function fitPointsToBounds(points: Point[], width: number, height: number) {
  if (!points.length) return points;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const sourceWidth = maxX - minX || 1;
  const sourceHeight = maxY - minY || 1;

  return points.map((point) => ({
    x: ((point.x - minX) / sourceWidth) * width,
    y: ((point.y - minY) / sourceHeight) * height,
  }));
}

export function polygonPoints(width: number, height: number, geometry: ShapeGeometry): Point[] {
  const shape = normalizedShapeGeometry(geometry);
  const vertices = shape.shape === "diamond" ? 4 : shape.vertices;
  const hasInset = shape.vertexInset < 0.995;
  const count = vertices * (hasInset ? 2 : 1);
  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = width / 2;
  const radiusY = height / 2;
  const offset = rotateOffsetForShape(shape.shape);

  const points = Array.from({ length: count }, (_, index) => {
    const outerIndex = hasInset ? index / 2 : index;
    const inset = hasInset && index % 2 === 1 ? shape.vertexInset : 1;
    const angle = offset + (outerIndex * Math.PI * 2) / vertices;
    return {
      x: centerX + Math.cos(angle) * radiusX * inset,
      y: centerY + Math.sin(angle) * radiusY * inset,
    };
  });
  return fitPointsToBounds(points, width, height);
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointToward(from: Point, to: Point, amount: number): Point {
  const length = distance(from, to);
  if (length <= 0) return from;
  const ratio = Math.min(0.5, amount / length);
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

function deflectedMidpoint(from: Point, to: Point, center: Point, deflection: number, size: number) {
  const midpoint = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };
  const vectorX = midpoint.x - center.x;
  const vectorY = midpoint.y - center.y;
  const length = Math.hypot(vectorX, vectorY) || 1;
  return {
    x: midpoint.x + (vectorX / length) * deflection * size * 0.18,
    y: midpoint.y + (vectorY / length) * deflection * size * 0.18,
  };
}

export function polygonPath(width: number, height: number, geometry: ShapeGeometry) {
  const normalized = normalizedShapeGeometry(geometry);
  const points = polygonPoints(width, height, normalized);
  if (!points.length) return "";

  const center = { x: width / 2, y: height / 2 };
  const size = Math.min(width, height);
  const cornerAmount = normalized.vertexRadius * size;

  if (cornerAmount <= 0 && Math.abs(normalized.sideDeflection) < 0.01) {
    return `${points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")} Z`;
  }

  const starts = points.map((point, index) =>
    pointToward(point, points[(index + points.length - 1) % points.length], cornerAmount),
  );
  const ends = points.map((point, index) =>
    pointToward(point, points[(index + 1) % points.length], cornerAmount),
  );

  let path = `M ${ends[0].x} ${ends[0].y}`;
  points.forEach((point, index) => {
    const nextIndex = (index + 1) % points.length;
    const nextStart = starts[nextIndex];
    const sideControl = deflectedMidpoint(
      ends[index],
      nextStart,
      center,
      normalized.sideDeflection,
      size,
    );
    if (Math.abs(normalized.sideDeflection) >= 0.01) {
      path += ` Q ${sideControl.x} ${sideControl.y} ${nextStart.x} ${nextStart.y}`;
    } else {
      path += ` L ${nextStart.x} ${nextStart.y}`;
    }
    path += ` Q ${points[nextIndex].x} ${points[nextIndex].y} ${ends[nextIndex].x} ${ends[nextIndex].y}`;
  });

  return `${path} Z`;
}
