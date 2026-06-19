import type { DataGroup, GuideSnapTarget, ProjectLayer, QrMagicProject, SerialSettings } from "../types";

export const DEFAULT_DATA_GROUP_ID = "group_primary";

const defaultSerialSettings: SerialSettings = {
  prefix: "PARK-",
  suffix: "",
  start: 1,
  quantity: 10,
  step: 1,
  padding: 4,
};

export function createDataGroup(name = "Primary serial"): DataGroup {
  const timestamp = Date.now();
  return {
    id: `group_${timestamp}`,
    name,
    mode: "serial",
    serial: {
      prefix: "QR-",
      suffix: "",
      start: 1,
      quantity: 10,
      step: 1,
      padding: 4,
    },
  };
}

export const initialProject: QrMagicProject = {
  version: 1,
  document: {
    name: "Festival Parking Decal",
    unit: "in",
    width: 4,
    height: 3,
    dpi: 300,
    backgroundColor: "#f8fafc",
    transparentBackground: false,
    guides: {
      enabled: true,
      showTrim: true,
      showBleed: true,
      showSafeArea: true,
      bleedRatio: 0.03125,
      safeAreaRatio: 0.08,
    },
  },
  layers: [
    {
      id: "layer_artwork_background",
      type: "shape",
      shape: "rectangle",
      name: "Artwork Background",
      visible: true,
      locked: false,
      x: 36,
      y: 36,
      width: 1128,
      height: 828,
      rotation: 0,
      opacity: 1,
      fill: "#f59e0b",
      fillOpacity: 1,
      stroke: "transparent",
      strokeOpacity: 1,
      strokeWidth: 0,
      dash: [],
      cornerRadius: 18,
    },
    {
      id: "layer_title",
      type: "text",
      name: "Title",
      visible: true,
      locked: false,
      x: 96,
      y: 108,
      width: 760,
      height: 70,
      rotation: 0,
      opacity: 1,
      textTemplate: "FESTIVAL PARKING",
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 54,
      fontWeight: 800,
      fill: "#111827",
      fillOpacity: 1,
      align: "left",
    },
    {
      id: "layer_subtitle",
      type: "text",
      name: "Subtitle",
      visible: true,
      locked: false,
      x: 100,
      y: 184,
      width: 560,
      height: 38,
      rotation: 0,
      opacity: 1,
      textTemplate: "LOT A - WEEKEND ACCESS",
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 28,
      fontWeight: 700,
      fill: "#374151",
      fillOpacity: 1,
      align: "left",
    },
    {
      id: "layer_qr",
      type: "qr",
      name: "QR Code",
      dataGroupId: DEFAULT_DATA_GROUP_ID,
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
      dataGroupId: DEFAULT_DATA_GROUP_ID,
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
      fillOpacity: 1,
      align: "center",
    },
  ],
  data: {
    mode: "serial",
    groups: [
      {
        id: DEFAULT_DATA_GROUP_ID,
        name: "Primary serial",
        mode: "serial",
        serial: defaultSerialSettings,
      },
    ],
  },
  export: {
    filenameTemplate: "{{serial}}",
    formats: ["png"],
    renderMode: "flattened",
    includeGuides: false,
  },
};

type LegacyProject = QrMagicProject & {
  data: QrMagicProject["data"] & {
    serial?: SerialSettings;
  };
};

export function normalizeProject(project: QrMagicProject | LegacyProject): QrMagicProject {
  const legacySerial = "serial" in project.data ? project.data.serial : undefined;
  const groups =
    project.data.groups?.length
      ? project.data.groups
      : [
          {
            id: DEFAULT_DATA_GROUP_ID,
            name: "Primary serial",
            mode: "serial" as const,
            serial: legacySerial ?? defaultSerialSettings,
          },
        ];
  const defaultGroupId = groups[0]?.id ?? DEFAULT_DATA_GROUP_ID;
  const layers = project.layers.map((layer): ProjectLayer => {
    if (layer.type === "qr" && !layer.dataGroupId) {
      return { ...layer, dataGroupId: defaultGroupId };
    }
    if (layer.type === "text" && layer.textTemplate.includes("{{serial}}") && !layer.dataGroupId) {
      return { ...layer, dataGroupId: defaultGroupId };
    }
    return layer;
  });

  return {
    ...project,
    layers,
    data: {
      mode: "serial",
      groups,
    },
  };
}

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

export function guideInset(project: QrMagicProject, guide: "bleed" | "safeArea") {
  const size = documentPixelSize(project);
  const ratio =
    guide === "bleed"
      ? project.document.guides.bleedRatio
      : project.document.guides.safeAreaRatio;
  return Math.round(Math.min(size.width, size.height) * ratio);
}

export function guideSnapRect(project: QrMagicProject, target: GuideSnapTarget) {
  const size = documentPixelSize(project);
  const inset =
    target === "bleed" || target === "safeArea" ? guideInset(project, target) : 0;

  return {
    x: inset,
    y: inset,
    width: Math.max(1, size.width - inset * 2),
    height: Math.max(1, size.height - inset * 2),
  };
}
