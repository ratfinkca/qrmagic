import { describe, expect, it } from "vitest";
import { csvPreflight, parseCsvBatch, reviewCsvBatch, withCsvBatch } from "./csvBatch";
import { initialProject } from "./project";
import { projectForEditor } from "./projectValidation";
import { createPrintRecords, productionCount } from "./production";
import { renderLayerValue } from "./serial";

describe("CSV batches", () => {
  it("reads quoted, multiline and empty values without interpreting cell content", () => {
    const csv = parseCsvBatch("records.csv", '\uFEFF Code ,Name\r\n001,"Doe, Jane"\r\n002,"First\nSecond"\r\n003\r\n,"{{serial}}"\r\n');
    expect(csv.columns).toEqual(["Code", "Name"]);
    expect(csv.rows).toEqual([["001", "Doe, Jane"], ["002", "First\nSecond"], ["003", ""], ["", "{{serial}}"]]);
    expect(parseCsvBatch("blank.csv", 'Code\n001\n""\n').rows).toEqual([["001"], [""]]);
  });

  it.each(["Code,code\na,b", "Code,\na,b", "Code\n", 'Code\n"oops', "Code\na,b"])("rejects malformed input %s", input => {
    expect(() => parseCsvBatch("records.csv", input)).toThrow();
  });

  it("persists mappings, keeps copies in row order and uses raw cells alongside generated serials", () => {
    const csv = parseCsvBatch("records.csv", "Code,Name\n001,{{serial}}\n002,Ada\n003,Bea");
    const project = projectForEditor(JSON.parse(JSON.stringify({
      ...withCsvBatch(initialProject, csv),
      data: { ...initialProject.data, groups: initialProject.data.groups.map(group => group.mode === "serial"
        ? { ...group, serial: { ...group.serial, quantity: 1 } } : group), csv },
      production: { copiesPerRecord: 2 },
      layers: initialProject.layers.map(layer => layer.type === "qr" ? { ...layer, csvColumn: "Code" }
        : layer.type === "text" && layer.name === "Title" ? { ...layer, csvColumn: "Name" } : layer),
    })));
    expect(productionCount(project)).toEqual({ records: 3, copiesPerRecord: 2, total: 6 });
    const qr = project.layers.find(layer => layer.type === "qr")!;
    const label = project.layers.find(layer => layer.type === "text")!;
    const records = createPrintRecords(project);
    expect(records.map(record => renderLayerValue(qr, record))).toEqual(["001", "001", "002", "002", "003", "003"]);
    expect(renderLayerValue(label, records[0])).toBe("{{serial}}");
    expect(records[5].serial).toBe("PARK-0003");
    const replacement = withCsvBatch(project, parseCsvBatch("new.csv", "Code\n007"));
    expect(replacement.layers.find(layer => layer.type === "qr")?.csvColumn).toBe("Code");
    expect(replacement.layers.find(layer => layer.type === "text")?.csvColumn).toBeUndefined();
    expect(productionCount(withCsvBatch(replacement)).records).toBe(1);
  });

  it("flags both repeated QR rows, distinguishes missing text, and ignores hidden layers and copies", () => {
    const csv = parseCsvBatch("records.csv", "Code,Name\n001,Ada\n001,\n ,Bea\n1,Cam");
    const project = {
      ...withCsvBatch(initialProject, csv),
      layers: initialProject.layers.map(layer => layer.type === "qr" ? { ...layer, csvColumn: "Code" }
        : layer.type === "text" && layer.name === "Title" ? { ...layer, csvColumn: "Name" } : layer),
      production: { copiesPerRecord: 10 },
    };
    const review = reviewCsvBatch(project);
    expect(review.duplicateQrRows).toBe(2);
    expect(review.missingQrRows).toBe(1);
    expect(review.missingTextRows).toBe(1);
    expect(review.rows.get(0)?.map(issue => issue.kind)).toEqual(["duplicate-qr"]);
    expect(review.rows.get(1)?.map(issue => issue.kind)).toEqual(["missing-text", "duplicate-qr"]);
    expect(review.rows.has(3)).toBe(false);
    expect(csvPreflight(project).map(issue => issue.severity)).toEqual(["error", "warning", "warning"]);
    const allowed = withCsvBatch(project, { ...csv, allowRepeatedQr: true });
    expect(reviewCsvBatch(allowed).duplicateQrRows).toBe(0);
    expect(reviewCsvBatch({ ...allowed, layers: allowed.layers.map(layer => ({ ...layer, visible: false })) }).rows.size).toBe(0);
  });
});
