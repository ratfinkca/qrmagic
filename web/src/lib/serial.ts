import type { DataGroup, RenderRecord, SerialSettings } from "../types";

export function formatSerial(settings: SerialSettings, index: number): string {
  const value = settings.start + index * settings.step;
  const numeric = String(value).padStart(settings.padding, "0");
  return `${settings.prefix}${numeric}${settings.suffix}`;
}

export function createSerialRecords(settings: SerialSettings): RenderRecord[] {
  return Array.from({ length: settings.quantity }, (_, index) => ({
    index,
    serial: formatSerial(settings, index),
    groups: {},
  }));
}

export function createDataRecords(groups: DataGroup[]): RenderRecord[] {
  const quantity = Math.max(1, ...groups.map((group) => group.serial.quantity));
  return Array.from({ length: quantity }, (_, index) => {
    const groupValues = Object.fromEntries(
      groups.map((group) => [
        group.id,
        {
          serial: index < group.serial.quantity ? formatSerial(group.serial, index) : "",
        },
      ]),
    );
    const primarySerial = groupValues[groups[0]?.id]?.serial ?? "";
    return {
      index,
      serial: primarySerial,
      groups: groupValues,
    };
  });
}

export function renderTemplate(
  template: string,
  record: RenderRecord,
  dataGroupId?: string,
): string {
  const serial = dataGroupId ? (record.groups[dataGroupId]?.serial ?? "") : record.serial;
  return template
    .replaceAll("{{serial}}", serial)
    .replaceAll("{{index}}", String(record.index + 1));
}
