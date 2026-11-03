import { describe, expect, it } from "vitest";
import { createStarterProject } from "./templates";
import { productionPreflight, cutOutlineSvg, outlinePath, rasterReason, canvasGlyphOrigins } from "./productionPdfModel";

describe("production PDF planning", () => {
  it("places vector glyphs using the browser's hinted advances, including pair kerning", () => {
    const widths:Record<string,number>={A:19,V:19,AV:34,AVA:52};
    expect(canvasGlyphOrigins("AVA",[[65],[86],[65]],text=>widths[text])).toEqual([0,15,33]);
  });
  it("keeps ligature clusters together and declines inconsistent shaping maps", () => {
    const widths:Record<string,number>={o:12,ffi:18,offi:29};
    expect(canvasGlyphOrigins("offi",[[111],[102,102,105]],text=>widths[text])).toEqual([0,11]);
    expect(canvasGlyphOrigins("offi",[[111],[102]],()=>0)).toBeUndefined();
  });
  it("keeps ordinary QR, text, and solid shapes eligible for vector output", () => {
    const project = createStarterProject("decals");
    expect(project.layers.map(rasterReason).filter(Boolean)).toEqual([]);
  });
  it("reports effects and unsupported fonts instead of silently changing them", () => {
    const project = createStarterProject("decals");
    project.layers[0].shadowEnabled = true;
    const title = project.layers.find(layer => layer.type === "text")!;
    if (title.type === "text") title.fontFamily = "Comic Sans MS";
    const warnings = productionPreflight(project).filter(issue => issue.severity === "warning");
    expect(warnings.map(issue => issue.code)).toContain("raster-layer");
    expect(warnings.some(issue => issue.message.includes("font"))).toBe(true);
  });
  it("blocks empty QR data and blank serial ranges", () => {
    const project = createStarterProject("stickers", { payload: "https://example.com" });
    if (project.data.groups[0].mode === "fixed") project.data.groups[0].fixed.value = "";
    expect(productionPreflight(project).some(issue => issue.severity === "error" && issue.code === "empty-qr")).toBe(true);
    const serial = createStarterProject("decals", { records: 10 });
    const shorter = structuredClone(serial.data.groups[0]);
    shorter.id = "short";
    if (shorter.mode === "serial") shorter.serial.quantity = 2;
    serial.data.groups.push(shorter);
    const qr = serial.layers.find(layer => layer.type === "qr")!;
    if (qr.type === "qr") qr.dataGroupId = "short";
    expect(productionPreflight(serial).some(issue => issue.code === "missing-serial")).toBe(true);
  });
  it("includes physical page dimensions and the trim offset in a standalone cut SVG", () => {
    const project = createStarterProject("blank", { width: 50.8, height: 50.8, bleedMm: 3.175 });
    const svg = cutOutlineSvg(project);
    expect(svg).toContain('width="57.15mm"');
    expect(svg).toContain('viewBox="0 0 162 162"');
    expect(svg).toContain('translate(9 9)');
    expect(svg).toContain('fill="none"');
    expect(svg).not.toContain("CutContour");
  });
  it("uses circular arcs for rounded rectangle cuts and clamps the corner radius", () => {
    const project = createStarterProject("blank");
    const shape = { ...project.document.shape, cornerRadius: 100 };
    expect(outlinePath(80, 40, shape)).toContain("A 20 20 0 0 1");
  });
  it("reports an invalid page paint before rendering", () => {
    const project = createStarterProject("blank");
    project.document.backgroundColor = "red";
    expect(productionPreflight(project).some(issue => issue.code === "page-color" && issue.severity === "error")).toBe(true);
  });
});
