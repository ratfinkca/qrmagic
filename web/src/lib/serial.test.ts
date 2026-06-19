import { describe, expect, it } from "vitest";
import type { DataGroup } from "../types";
import { createDataRecords } from "./serial";

function serialGroup(id: string, quantity: number): DataGroup {
  return {
    id,
    name: id,
    mode: "serial",
    serial: {
      prefix: "S-",
      suffix: "",
      start: 1,
      quantity,
      step: 1,
      padding: 2,
    },
  };
}

function fixedGroup(id: string, value: string, quantity: number): DataGroup {
  return {
    id,
    name: id,
    mode: "fixed",
    fixed: {
      value,
      quantity,
    },
  };
}

describe("createDataRecords", () => {
  it("keeps serial-only group behavior", () => {
    const records = createDataRecords([serialGroup("serial", 3)]);

    expect(records).toHaveLength(3);
    expect(records.map((record) => record.serial)).toEqual(["S-01", "S-02", "S-03"]);
  });

  it("uses serial groups for quantity when fixed groups are mixed in", () => {
    const records = createDataRecords([serialGroup("serial", 2), fixedGroup("fixed", "STATIC", 9)]);

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.groups.fixed.serial)).toEqual(["STATIC", "STATIC"]);
  });

  it("repeats fixed-only groups for their own quantity", () => {
    const records = createDataRecords([fixedGroup("fixed", "STATIC", 4)]);

    expect(records).toHaveLength(4);
    expect(records.map((record) => record.serial)).toEqual([
      "STATIC",
      "STATIC",
      "STATIC",
      "STATIC",
    ]);
  });
});
