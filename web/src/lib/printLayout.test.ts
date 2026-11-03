import { describe, expect, it } from "vitest";
import { initialProject, normalizeProject } from "./project";
import { createStarterProject } from "./templates";
import { calculateLayout, defaultLayoutSettings, layoutPanel, normalizeLayoutSettings, placementIdentity, csvCell } from "./printLayout";

describe("print layout", () => {
  it("matches the audited 5,000 sticker roll including its partial final panel", () => {
    const p = createStarterProject("stickers", { width: 50.8, height: 50.8, copies: 5000 });
    const plan = calculateLayout(p, defaultLayoutSettings());
    expect([plan.columns, plan.rows, plan.capacity, plan.panelCount]).toEqual([9,16,144,35]);
    expect(plan.totalLengthMm).toBeCloseTo(33843.8);
    const last = layoutPanel(plan, 34);
    expect(last.placements).toHaveLength(104);
    expect(last.heightMm).toBeCloseTo(734.6);
    expect(last.placements.at(-1)?.itemIndex).toBe(4999);
  });
  it("uses exact dimensions, gaps only between envelopes and separate edge margins", () => {
    const p = createStarterProject("blank", { width: 25.4, height: 50.8, bleedMm: 0, copies: 8 });
    const s = { ...defaultLayoutSettings(), media: "sheet" as const, widthMm: 57.8, heightMm: 115.6,
      marginTop: 4, marginRight: 2, marginBottom: 7, marginLeft: 3, gapX: 2, gapY: 3, orientation: "original" as const };
    const a = calculateLayout(p,s);
    expect([a.columns,a.rows,a.panelCount]).toEqual([2,2,2]);
    const panel = layoutPanel(a,1);
    expect([panel.widthMm,panel.heightMm]).toEqual([57.8,115.6]);
    expect(panel.placements[0].xMm).toBe(3);
    expect(panel.placements[0].yMm).toBe(4);
    const inches = structuredClone(p); inches.document.unit = "in"; inches.document.width = 1; inches.document.height = 2;
    expect(calculateLayout(inches,s)).toEqual(a);
  });
  it("fits zero gaps and rotates a non-square item without changing its size", () => {
    const p = createStarterProject("blank", { width: 80, height: 30, bleedMm: 0, copies: 4 });
    const s = { ...defaultLayoutSettings(), widthMm: 60, heightMm: 160, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, gapX: 0, gapY: 0 };
    const plan = calculateLayout(p,s);
    expect([plan.rotation,plan.columns,plan.rows]).toEqual([90,2,2]);
    expect([plan.envelopeWidthMm,plan.envelopeHeightMm]).toEqual([30,80]);
    expect(layoutPanel(plan,0).heightMm).toBe(160);
    expect(() => calculateLayout(p,{...s,orientation:"original"})).toThrow(/fit/);
  });
  it("best fit minimizes actual media use and resolves square ties predictably", () => {
    const p = createStarterProject("blank", { width: 80, height: 30, bleedMm: 0, copies: 1 });
    const s = {...defaultLayoutSettings(),widthMm:300,heightMm:1000};
    expect(calculateLayout(p,s).rotation).toBe(0);
    p.document.width=30;
    expect(calculateLayout(p,s).rotation).toBe(0);
  });
  it.each([NaN,Infinity,-1,0,5001])("rejects invalid media dimensions %s", bad => {
    expect(() => calculateLayout(initialProject,{...defaultLayoutSettings(),widthMm:bad})).toThrow();
  });
  it("rejects bad margins, spacing and overflowing panel navigation", () => {
    expect(() => calculateLayout(initialProject,{...defaultLayoutSettings(),gapX:-1})).toThrow(/gap|spacing/i);
    expect(() => calculateLayout(initialProject,{...defaultLayoutSettings(),marginLeft:610})).toThrow(/fit/);
    expect(() => layoutPanel(calculateLayout(initialProject,defaultLayoutSettings()), -1)).toThrow(/panel/i);
  });
  it("keeps record and copy indices independent", () => {
    expect(Array.from({length:6},(_,i)=>placementIdentity(i,2))).toEqual([
      {recordIndex:0,copyIndex:0},{recordIndex:0,copyIndex:1},{recordIndex:1,copyIndex:0},
      {recordIndex:1,copyIndex:1},{recordIndex:2,copyIndex:0},{recordIndex:2,copyIndex:1}]);
  });
  it("keeps old files layout-free, roundtrips settings and preserves recoverable invalid settings", () => {
    expect(normalizeProject(initialProject).production.layout).toBeUndefined();
    const project = {...initialProject,production:{...initialProject.production,layout:defaultLayoutSettings()}};
    expect(normalizeProject(project).production.layout).toEqual(defaultLayoutSettings());
    const bad = normalizeLayoutSettings({media:"roll",widthMm:null});
    expect(() => calculateLayout(initialProject,bad!)).toThrow();
    expect(normalizeLayoutSettings(null)).toBeDefined();
    expect(typeof normalizeLayoutSettings({units:{bad:true}})!.units).toBe("string");
  });
  it("quotes manifest content and protects spreadsheet formula prefixes", () => {
    expect(csvCell('one,"two"')).toBe('"one,""two"""');
    for(const value of ["=HYPERLINK(\"x\")"," +SUM(1)","\t@a","-1"]) expect(csvCell(value)).toMatch(/^"'/);
    expect(csvCell("PARK-0001")).toBe('"PARK-0001"');
  });
});
