import type { QrMagicProject } from "../types";
import { initialProject } from "./project";
import { positiveInteger, productionGeometry } from "./production";

export type StarterKind = "decals" | "poster" | "stickers" | "blank";
export type StarterOptions = {
  name?: string; width?: number; height?: number; bleedMm?: number;
  records?: number; copies?: number; payload?: string;
};

export function createStarterProject(kind: StarterKind, options: StarterOptions = {}): QrMagicProject {
  const project = structuredClone(initialProject);
  const poster = kind === "poster";
  project.version = 2;
  project.document = {
    ...project.document,
    name: options.name?.trim() || ({ decals: "Parking decals", poster: "QR poster", stickers: "QR stickers", blank: "Untitled design" })[kind],
    unit: "mm", width: options.width ?? (poster ? 210 : 101.6),
    height: options.height ?? (poster ? 297 : 76.2),
    bleedMm: options.bleedMm ?? 3,
    safeAreaMm: 4, backgroundColor: "#ffffff",
    shape: { ...project.document.shape, shape: "rectangle", cornerRadius: 0 },
  };
  const doc = project.document;
  productionGeometry(project);
  if (![doc.width, doc.height].every(value => Number.isFinite(value) && value > 0 && value <= 2000)) {
    throw new Error("Finished dimensions must be greater than zero and at most 2,000 mm.");
  }
  if (!Number.isFinite(doc.bleedMm) || doc.bleedMm < 0 || doc.bleedMm > 25) {
    throw new Error("Bleed must be between 0 and 25 mm.");
  }
  project.production = { copiesPerRecord: positiveInteger(options.copies ?? 1, "Copies per record") };
  const quantity = kind === "decals" ? positiveInteger(options.records ?? 100, "Unique records") : 1;
  if (quantity * project.production.copiesPerRecord > 100000) throw new Error("A job may contain at most 100,000 finished items.");
  const group = project.data.groups[0];
  if (group.mode !== "serial") throw new Error("Missing starter serial settings.");
  project.data.groups = kind === "decals" ? [{ ...group, serial: { ...group.serial, quantity } }]
    : [{ id: group.id, name: "QR destination", mode: "fixed", fixed: { value: options.payload?.trim() || "https://example.com", quantity: 1 } }];
  if (kind === "blank") {
    project.layers = [];
  } else if (kind !== "decals") {
    const { trim } = productionGeometry(project);
    const qr = structuredClone(project.layers.find(layer => layer.type === "qr")!);
    const text = structuredClone(project.layers.find(layer => layer.type === "text")!);
    const size = Math.min(trim.width, trim.height) * 0.48;
    project.layers = [
      { ...text, x: trim.width * 0.08, y: trim.height * 0.12, width: trim.width * 0.84, height: trim.height * 0.15,
        ...(text.type === "text" ? { textTemplate: poster ? "SCAN TO CONNECT" : "SCAN ME", align: "center" as const, fontSize: Math.min(trim.width, trim.height) * 0.065 } : {}) },
      { ...qr, x: (trim.width - size) / 2, y: trim.height * 0.34, width: size, height: size,
        ...(qr.type === "qr" ? { margin: size * 0.15 } : {}) },
    ];
  } else {
    const { trim } = productionGeometry(project);
    project.layers = project.layers.map(layer => ({ ...layer, x: layer.x * trim.width / 1200,
      y: layer.y * trim.height / 900, width: layer.width * trim.width / 1200, height: layer.height * trim.height / 900 }));
  }
  return project;
}
