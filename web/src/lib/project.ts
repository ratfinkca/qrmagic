import type { QrMagicProject } from "../types";

export const initialProject: QrMagicProject = {
  version: 1,
  document: {
    name: "Festival Parking Decal",
    unit: "in",
    width: 4,
    height: 3,
    dpi: 300,
    backgroundColor: "#f8fafc",
  },
  layers: [
    {
      id: "layer_qr",
      type: "qr",
      name: "QR Code",
      visible: true,
      locked: false,
      x: 780,
      y: 300,
      width: 260,
      height: 260,
      rotation: 0,
      opacity: 1,
      payloadTemplate: "{{serial}}",
      foreground: "#111827",
      background: "#ffffff",
    },
    {
      id: "layer_serial",
      type: "text",
      name: "Serial",
      visible: true,
      locked: false,
      x: 710,
      y: 585,
      width: 400,
      height: 58,
      rotation: 0,
      opacity: 1,
      textTemplate: "{{serial}}",
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 42,
      fontWeight: 800,
      fill: "#111827",
      align: "center",
    },
  ],
  data: {
    mode: "serial",
    serial: {
      prefix: "PARK-",
      suffix: "",
      start: 1,
      quantity: 250,
      step: 1,
      padding: 4,
    },
  },
  export: {
    filenameTemplate: "{{serial}}",
    formats: ["png"],
    renderMode: "flattened",
  },
};

export function documentPixelSize(project: QrMagicProject) {
  if (project.document.unit === "px") {
    return {
      width: project.document.width,
      height: project.document.height,
    };
  }

  if (project.document.unit === "mm") {
    return {
      width: Math.round((project.document.width / 25.4) * project.document.dpi),
      height: Math.round((project.document.height / 25.4) * project.document.dpi),
    };
  }

  return {
    width: Math.round(project.document.width * project.document.dpi),
    height: Math.round(project.document.height * project.document.dpi),
  };
}
