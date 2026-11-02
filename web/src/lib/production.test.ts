import { describe, expect, it } from "vitest";
import { initialProject, normalizeProject, guideSnapRect } from "./project";
import { productionGeometry, createPrintRecords, productionCount } from "./production";
import { createStarterProject } from "./templates";

describe("production documents", () => {
  it("folds identical fixed records into quantity without changing the item count", () => {
    const project = createStarterProject("stickers", { copies: 10 });
    if (project.data.groups[0].mode === "fixed") project.data.groups[0].fixed.quantity = 4;
    const migrated = normalizeProject(project);
    expect(productionCount(migrated)).toEqual({ records: 1, copiesPerRecord: 40, total: 40 });
  });
  it("preserves indexed variations in fixed jobs", () => {
    const project = createStarterProject("stickers", { copies: 10 });
    if (project.data.groups[0].mode === "fixed") project.data.groups[0].fixed.quantity = 4;
    const title = project.layers.find(layer => layer.type === "text");
    if (title?.type === "text") title.textTemplate = "Ticket {{index}}";
    expect(productionCount(normalizeProject(project))).toEqual({ records: 4, copiesPerRecord: 10, total: 40 });
  });
  it("places physical bleed outside trim and preserves physical size across DPI", () => {
    const project = createStarterProject("stickers", { width: 50.8, height: 50.8, bleedMm: 3.175 });
    const geometry = productionGeometry(project);
    expect(geometry.trim).toEqual({ width: 600, height: 600 });
    expect(geometry.bleedPixels).toBe(38);
    expect(geometry.output).toEqual({ width: 676, height: 676 });
    expect(geometry.points.width).toBeCloseTo(162);
    expect(guideSnapRect(project, "bleed").x).toBe(-38);
    expect(productionGeometry({ ...project, document: { ...project.document, dpi: 600 } }).points.width).toBeCloseTo(162);
  });
  it("preserves legacy output size, artwork, record order, and is idempotent", () => {
    const legacy = structuredClone(initialProject) as any;
    legacy.version = 1;
    delete legacy.production;
    delete legacy.document.bleedMm;
    delete legacy.document.safeAreaMm;
    const migrated = normalizeProject(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.document.bleedMm).toBe(0);
    expect(migrated.layers[0].x).toBe(legacy.layers[0].x);
    expect(productionGeometry(migrated).output).toEqual(productionGeometry(migrated).trim);
    expect(normalizeProject(migrated)).toEqual(migrated);
    expect(createPrintRecords(migrated)).toHaveLength(10);
  });
  it("keeps one fixed record separate from 5000 copies", () => {
    const project = createStarterProject("stickers", { records: 100, copies: 5000, payload: "https://example.com" });
    expect(productionCount(project)).toEqual({ records: 1, copiesPerRecord: 5000, total: 5000 });
    const records = createPrintRecords(project);
    expect(records).toHaveLength(5000);
    expect(records[0]).toBe(records[4999]);
    expect(records[0].serial).toBe("https://example.com");
  });
  it("repeats each serial without advancing its index", () => {
    const project = createStarterProject("decals", { records: 3, copies: 2 });
    expect(createPrintRecords(project).map(record => record.serial)).toEqual([
      "PARK-0001", "PARK-0001", "PARK-0002", "PARK-0002", "PARK-0003", "PARK-0003",
    ]);
  });
  it("creates an empty canvas and independent starter projects", () => {
    expect(createStarterProject("blank").layers).toEqual([]);
    const a = createStarterProject("poster");
    a.document.shape.cornerRadius = 300;
    expect(createStarterProject("poster").document.shape.cornerRadius).toBe(0);
  });
  it("rejects invalid dimensions, quantities, and bleed", () => {
    for (const options of [{ width: 0 }, { copies: 0 }, { copies: 1.2 }, { bleedMm: -1 }, { height: NaN }]) {
      expect(() => createStarterProject("blank", options)).toThrow();
    }
  });
});
