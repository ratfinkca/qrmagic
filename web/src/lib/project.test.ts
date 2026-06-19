import { describe, expect, it } from "vitest";
import { normalizeProject } from "./project";
import type { QrMagicProject } from "../types";

describe("normalizeProject", () => {
  it("adds new QR, shape, document shape, and data defaults to older project files", () => {
    const legacyProject = {
      version: 1,
      document: {
        name: "Legacy",
        unit: "in",
        width: 2,
        height: 2,
        dpi: 300,
        backgroundColor: "#ffffff",
        transparentBackground: false,
        guides: {
          enabled: true,
          showTrim: true,
          showBleed: true,
          showSafeArea: true,
          bleedRatio: 0.03,
          safeAreaRatio: 0.08,
        },
      },
      layers: [
        {
          id: "shape",
          type: "shape",
          name: "Shape",
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          shape: "rectangle",
          fill: "#000000",
          fillOpacity: 1,
          stroke: "transparent",
          strokeOpacity: 1,
          strokeWidth: 0,
          dash: [],
          cornerRadius: 6,
        },
        {
          id: "qr",
          type: "qr",
          name: "QR",
          dataGroupId: "group",
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          payloadTemplate: "{{serial}}",
          foreground: "#000000",
          background: "#ffffff",
        },
      ],
      data: {
        mode: "serial",
        groups: [
          {
            id: "group",
            name: "Group",
            mode: "serial",
            serial: {
              prefix: "A-",
              suffix: "",
              start: 1,
              quantity: 2,
              step: 1,
              padding: 2,
            },
          },
        ],
      },
      export: {
        filenameTemplate: "{{serial}}",
        formats: ["png"],
        renderMode: "flattened",
        includeGuides: false,
      },
    } as unknown as QrMagicProject;

    const normalized = normalizeProject(legacyProject);

    expect(normalized.colors.palette).toContain("#14b8a6");
    expect(normalized.colors.recent).toEqual([]);
    expect(normalized.document.backgroundOpacity).toBe(1);
    expect(normalized.document.shape.shape).toBe("rectangle");
    expect(normalized.layers[0]).toMatchObject({
      type: "shape",
      fillMode: "solid",
      fillGradientFrom: "#14b8a6",
      fillGradientTo: "#0f766e",
      shadowEnabled: false,
      shadowColor: "#111827",
      vertices: 4,
      vertexInset: 1,
      vertexRadius: 0,
      sideDeflection: 0,
    });
    expect(normalized.layers[1]).toMatchObject({
      type: "qr",
      shadowEnabled: false,
      shadowColor: "#111827",
      errorCorrectionLevel: "M",
      dotStyle: "square",
      logoSize: 0.38,
      logoEnabled: false,
    });
  });
});
