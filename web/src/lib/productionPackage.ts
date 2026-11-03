import JSZip from "jszip";
import type { QrMagicProject, RenderRecord } from "../types";
import { productionCount, productionGeometry } from "./production";
import { createDataRecords } from "./serial";
import { renderProductionPdf } from "./productionPdf";

export async function productionPackage(project: QrMagicProject, records: RenderRecord[]) {
  const result = await renderProductionPdf(project, records);
  const geometry = productionGeometry(project);
  const zip = new JSZip();
  zip.file("artwork.pdf", result.blob);
  zip.file("cut-outline.svg", result.cutSvg);
  zip.file("job.json", JSON.stringify({
    format: "qrmagic.production-job", version: 1, name: project.document.name,
    quantity: productionCount(project),
    order: "Each record followed by all of its copies; PDF page count includes copies.",
    document: project.document, pagePoints: geometry.points, trimPoints: geometry.trimPoints,
    records: createDataRecords(project.data.groups),
  }, null, 2));
  zip.file("preflight.json", JSON.stringify({
    colorSpace: "RGB", machineProfile: null, pdfX: false,
    stats: result.stats, issues: result.issues,
    limits: ["No ICC conversion or output intent", "No machine cut separation or registration marks", "One finished item per page; no roll imposition"],
  }, null, 2));
  zip.file("README.txt", [
    `QR Magic production package: ${project.document.name}`,
    "",
    "ARTWORK: artwork.pdf has one finished item per page, including every requested copy.",
    "Print at 100% / actual size. Do not fit to page. MediaBox and BleedBox include bleed; TrimBox is the finished size.",
    "QR codes, supported text (embedded Inter), and solid shapes are vectors. Images, gradients, shadows, unsupported fonts and glyphs are rasterized at document DPI. Read preflight.json for the actual result.",
    "Color is RGB, with transparency where designed. This is not PDF/X and has no ICC conversion or output intent. Let the print shop configure color and media in its RIP.",
    "",
    "CUT REFERENCE: cut-outline.svg contains the finished contour on the same physical page and bleed offset as the PDF. It has no artwork and applies to each page. Import at 100% with no auto-fit or rotation.",
    "This SVG is reference geometry, not a machine-ready cutting file. It has no CutContour spot-color separation, cut settings, registration marks, nesting or cutter commands. Configure and validate these in the shop workflow before production.",
    "",
    "JOB: job.json lists dimensions, quantities and source record values. Copies repeat the same QR and serial. Page order is record 1 and all its copies, then record 2 and all its copies, and so on.",
    "Vector/raster layer counts in preflight.json count unique rendered records; repeated copies reuse PDF artwork.",
    "Proof and scan a physical sample at final size before printing the batch. This generic package has not yet been validated with a specific Mimaki/RIP profile.",
  ].join("\n"));
  return zip.generateAsync({ type: "blob" });
}
