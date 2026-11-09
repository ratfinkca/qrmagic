import type { QrMagicProject } from "../types";
import { createDataRecords, dataRecordCount } from "./serial";

export function positiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100000) {
    throw new Error(`${name} must be a whole number between 1 and 100,000.`);
  }
  return value;
}

export function productionGeometry(project: QrMagicProject) {
  const doc = project.document;
  const millimetresPerUnit = doc.unit === "in" ? 25.4 : doc.unit === "px" ? 25.4 / doc.dpi : 1;
  const widthMm = doc.width * millimetresPerUnit;
  const heightMm = doc.height * millimetresPerUnit;
  const bleedMm = doc.bleedMm ?? 0;
  if (![doc.width, doc.height, doc.dpi].every(value => Number.isFinite(value) && value > 0) || doc.dpi > 1200) {
    throw new Error("Finished dimensions and DPI must be positive. Maximum DPI is 1,200.");
  }
  if (!Number.isFinite(bleedMm) || bleedMm < 0 || bleedMm > 25 ||
      !Number.isFinite(doc.safeAreaMm) || doc.safeAreaMm < 0) {
    throw new Error("Bleed must be between 0 and 25 mm and the safe inset must be non-negative.");
  }
  const bleedPixels = Math.round(bleedMm / 25.4 * doc.dpi);
  const trim = {
    width: Math.round(widthMm / 25.4 * doc.dpi),
    height: Math.round(heightMm / 25.4 * doc.dpi),
  };
  const output = { width: trim.width + bleedPixels * 2, height: trim.height + bleedPixels * 2 };
  if (trim.width < 1 || trim.height < 1 || output.width > 16384 || output.height > 16384 || output.width * output.height > 64000000) {
    throw new Error("This document exceeds the browser export limit. Reduce dimensions or DPI (maximum 64 million pixels).");
  }
  return {
    trim, bleedPixels,
    output,
    points: { width: (widthMm + bleedMm * 2) / 25.4 * 72, height: (heightMm + bleedMm * 2) / 25.4 * 72 },
    bleedPoints: bleedMm / 25.4 * 72,
    trimPoints: { width: widthMm / 25.4 * 72, height: heightMm / 25.4 * 72 },
  };
}

export function productionCount(project: QrMagicProject) {
  const records = dataRecordCount(project.data.groups, project.data.csv);
  const copiesPerRecord = positiveInteger(project.production?.copiesPerRecord ?? 1, "Copies per record");
  const total = records * copiesPerRecord;
  if (total > 100000) throw new Error("A job may contain at most 100,000 finished items.");
  return { records, copiesPerRecord, total };
}

export function usesRecordIndex(project: QrMagicProject) {
  return project.export.filenameTemplate.includes("{{index}}") || project.layers.some(layer =>
    layer.type === "qr" ? layer.payloadTemplate.includes("{{index}}")
      : layer.type === "text" && layer.textTemplate.includes("{{index}}"));
}

export function isRepeatedJob(project: QrMagicProject) {
  return !project.data.csv && !project.data.groups.some(group => group.mode === "serial") && !usesRecordIndex(project);
}

export function normalizeFixedJob(project: QrMagicProject): QrMagicProject {
  if (!isRepeatedJob(project)) return project;
  const count = productionCount(project);
  if (project.data.groups.every(group => group.mode === "fixed" && group.fixed.quantity === 1)) return project;
  return {
    ...project,
    production: { ...project.production, copiesPerRecord: count.total },
    data: { ...project.data, groups: project.data.groups.map(group => group.mode === "fixed"
      ? { ...group, fixed: { ...group.fixed, quantity: 1 } } : group) },
  };
}

export function jobSummary(project: QrMagicProject) {
  const count = productionCount(project);
  if (isRepeatedJob(project)) return `${count.total.toLocaleString()} ${count.total === 1 ? "copy" : "copies"} · same design`;
  if (project.data.csv) {
    const rows = count.records === 1 ? "row" : "rows";
    const copies = count.copiesPerRecord === 1 ? "copy" : "copies";
    const items = count.total === 1 ? "item" : "items";
    return `${count.records.toLocaleString()} CSV ${rows} × ${count.copiesPerRecord.toLocaleString()} ${copies} = ${count.total.toLocaleString()} ${items}`;
  }
  const noun = project.data.groups.some(group => group.mode === "serial") ? "serials" : "variations";
  return `${count.records.toLocaleString()} ${noun} × ${count.copiesPerRecord.toLocaleString()} copies = ${count.total.toLocaleString()} items`;
}

export function createPrintRecords(project: QrMagicProject) {
  const { copiesPerRecord } = productionCount(project);
  return createDataRecords(project.data.groups, project.data.csv).flatMap(record => Array.from({ length: copiesPerRecord }, () => record));
}
