import type { RenderRecord, SerialSettings } from "../types";

export function formatSerial(settings: SerialSettings, index: number): string {
  const value = settings.start + index * settings.step;
  const numeric = String(value).padStart(settings.padding, "0");
  return `${settings.prefix}${numeric}${settings.suffix}`;
}

export function createSerialRecords(settings: SerialSettings): RenderRecord[] {
  return Array.from({ length: settings.quantity }, (_, index) => ({
    index,
    serial: formatSerial(settings, index),
  }));
}

export function renderTemplate(template: string, record: RenderRecord): string {
  return template
    .replaceAll("{{serial}}", record.serial)
    .replaceAll("{{index}}", String(record.index + 1));
}
