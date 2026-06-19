import { describe, expect, it } from "vitest";
import {
  normalizedShapeGeometry,
  polygonPath,
  polygonPoints,
  presetShapeGeometry,
} from "./shapeGeometry";

describe("shapeGeometry", () => {
  it("normalizes legacy star geometry to polygon fields", () => {
    const geometry = normalizedShapeGeometry({
      shape: "star",
      starPoints: 7,
      starInnerRadiusRatio: 0.4,
    });

    expect(geometry).toMatchObject({
      shape: "polygon",
      vertices: 7,
      vertexInset: 0.4,
    });
  });

  it("creates expected point counts for polygon presets", () => {
    expect(polygonPoints(100, 100, presetShapeGeometry("triangle"))).toHaveLength(3);
    expect(polygonPoints(100, 100, presetShapeGeometry("pentagon"))).toHaveLength(5);
    expect(polygonPoints(100, 100, presetShapeGeometry("hexagon"))).toHaveLength(6);
    expect(polygonPoints(100, 100, presetShapeGeometry("octagon"))).toHaveLength(8);
  });

  it("fits polygon points to the full target bounds", () => {
    const points = polygonPoints(400, 300, presetShapeGeometry("triangle"));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);

    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(400);
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(300);
  });

  it("uses vertexInset 1 for regular polygons", () => {
    const geometry = { ...presetShapeGeometry("polygon"), vertices: 5, vertexInset: 1 };

    expect(polygonPoints(100, 100, geometry)).toHaveLength(5);
  });

  it("uses lower vertexInset for star-like alternating points", () => {
    const geometry = { ...presetShapeGeometry("polygon"), vertices: 5, vertexInset: 0.5 };

    expect(polygonPoints(100, 100, geometry)).toHaveLength(10);
  });

  it("clamps advanced shape controls", () => {
    const geometry = normalizedShapeGeometry({
      shape: "polygon",
      vertices: 99,
      vertexInset: -1,
      vertexRadius: 3,
      sideDeflection: -4,
    });

    expect(geometry).toMatchObject({
      vertices: 12,
      vertexInset: 0.1,
      vertexRadius: 0.45,
      sideDeflection: -1,
    });
  });

  it("creates a curved path when radius or side deflection is present", () => {
    const path = polygonPath(100, 100, {
      ...presetShapeGeometry("shield"),
      vertexRadius: 0.1,
      sideDeflection: -0.25,
    });

    expect(path).toContain("Q");
    expect(path.endsWith("Z")).toBe(true);
  });
});
