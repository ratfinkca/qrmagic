import type {
  DataGroup,
  FixedSettings,
  GuideSnapTarget,
  ProjectLayer,
  QrLayer,
  QrMagicProject,
  SerialSettings,
  ShapeFillMode,
  ShapeGeometry,
  ShapeLayer,
} from "../types";
import { normalizedShapeGeometry, presetShapeGeometry } from "./shapeGeometry";

export const DEFAULT_DATA_GROUP_ID = "group_primary";

const defaultSerialSettings: SerialSettings = {
  prefix: "PARK-",
  suffix: "",
  start: 1,
  quantity: 10,
  step: 1,
  padding: 4,
};

const defaultFixedSettings: FixedSettings = {
  value: "QR-FIXED",
  quantity: 10,
};

export const defaultLayerShadow = {
  shadowEnabled: false,
  shadowColor: "#111827",
  shadowOpacity: 0.28,
  shadowBlur: 16,
  shadowOffsetX: 0,
  shadowOffsetY: 8,
};

export const defaultShapeGeometry: ShapeGeometry = {
  shape: "rectangle",
  cornerRadius: 0,
  vertices: 5,
  vertexInset: 1,
  vertexRadius: 0,
  sideDeflection: 0,
};

export const defaultShapeFill = {
  fillMode: "solid" as const,
  fillGradientFrom: "#14b8a6",
  fillGradientTo: "#0f766e",
  fillGradientAngle: 45,
};

const SHAPE_FILL_MODES: ShapeFillMode[] = ["solid", "linear-gradient", "radial-gradient"];

function normalizedShapeFillMode(fillMode: ShapeFillMode | undefined): ShapeFillMode {
  return fillMode && SHAPE_FILL_MODES.includes(fillMode) ? fillMode : defaultShapeFill.fillMode;
}

export const defaultQrStyle: Pick<
  QrLayer,
  | "errorCorrectionLevel"
  | "margin"
  | "dotStyle"
  | "cornerSquareStyle"
  | "cornerDotStyle"
  | "logoEnabled"
  | "logoSrc"
  | "logoSize"
  | "logoMargin"
  | "logoHideBackgroundDots"
> = {
  errorCorrectionLevel: "M",
  margin: 2,
  dotStyle: "square",
  cornerSquareStyle: "square",
  cornerDotStyle: "square",
  logoEnabled: false,
  logoSrc: "",
  logoSize: 0.38,
  logoMargin: 8,
  logoHideBackgroundDots: true,
};

export function createProjectId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.round(Math.random() * 1_000_000)}`;
}

export function createDataGroup(name = "Primary serial", id = createProjectId("group")): DataGroup {
  return {
    id,
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

export function createFixedDataGroup(
  name = "Fixed value",
  id = createProjectId("group"),
): DataGroup {
  return {
    id,
    name,
    mode: "fixed",
    fixed: {
      ...defaultFixedSettings,
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
    shape: {
      ...defaultShapeGeometry,
      cornerRadius: 18,
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
      ...defaultLayerShadow,
      fill: "#f59e0b",
      ...defaultShapeFill,
      fillGradientFrom: "#f59e0b",
      fillGradientTo: "#f97316",
      fillOpacity: 1,
      stroke: "transparent",
      strokeOpacity: 1,
      strokeWidth: 0,
      dash: [],
      cornerRadius: 18,
      vertices: 4,
      vertexInset: 1,
      vertexRadius: 0,
      sideDeflection: 0,
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
      ...defaultLayerShadow,
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
      ...defaultLayerShadow,
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
      ...defaultLayerShadow,
      payloadTemplate: "{{serial}}",
      foreground: "#111827",
      background: "#ffffff",
      ...defaultQrStyle,
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
      ...defaultLayerShadow,
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

function normalizeDataGroup(group: DataGroup | (Partial<DataGroup> & { serial?: SerialSettings })): DataGroup {
  if (group.mode === "fixed") {
    return {
      id: group.id ?? createProjectId("group"),
      name: group.name ?? "Fixed value",
      mode: "fixed",
      fixed: {
        ...defaultFixedSettings,
        ...(group.fixed ?? {}),
        quantity: Math.max(1, Number(group.fixed?.quantity ?? defaultFixedSettings.quantity)),
      },
    };
  }

  return {
    id: group.id ?? createProjectId("group"),
    name: group.name ?? "Primary serial",
    mode: "serial",
    serial: {
      ...defaultSerialSettings,
      ...(group.serial ?? {}),
      quantity: Math.max(1, Number(group.serial?.quantity ?? defaultSerialSettings.quantity)),
      padding: Math.max(0, Number(group.serial?.padding ?? defaultSerialSettings.padding)),
    },
  };
}

function normalizeShapeLayer(layer: ShapeLayer): ShapeLayer {
  const legacyShape = layer.shape as ShapeLayer["shape"] | "star";
  return {
    ...layer,
    ...defaultLayerShadow,
    ...defaultShapeFill,
    ...layer,
    shadowEnabled: Boolean(layer.shadowEnabled ?? defaultLayerShadow.shadowEnabled),
    shadowColor: layer.shadowColor ?? defaultLayerShadow.shadowColor,
    shadowOpacity: Math.max(0, Math.min(1, Number(layer.shadowOpacity ?? defaultLayerShadow.shadowOpacity))),
    shadowBlur: Math.max(0, Number(layer.shadowBlur ?? defaultLayerShadow.shadowBlur)),
    shadowOffsetX: Number(layer.shadowOffsetX ?? defaultLayerShadow.shadowOffsetX),
    shadowOffsetY: Number(layer.shadowOffsetY ?? defaultLayerShadow.shadowOffsetY),
    fillMode: normalizedShapeFillMode(layer.fillMode),
    fillGradientFrom: layer.fillGradientFrom ?? defaultShapeFill.fillGradientFrom,
    fillGradientTo: layer.fillGradientTo ?? defaultShapeFill.fillGradientTo,
    fillGradientAngle: Number(layer.fillGradientAngle ?? defaultShapeFill.fillGradientAngle),
    ...normalizedShapeGeometry({
      ...presetShapeGeometry(legacyShape === "star" ? "polygon" : legacyShape),
      ...layer,
    }),
  };
}

function normalizeLayerBase<TLayer extends ProjectLayer>(layer: TLayer): TLayer {
  return {
    ...defaultLayerShadow,
    ...layer,
    shadowEnabled: Boolean(layer.shadowEnabled ?? defaultLayerShadow.shadowEnabled),
    shadowColor: layer.shadowColor ?? defaultLayerShadow.shadowColor,
    shadowOpacity: Math.max(0, Math.min(1, Number(layer.shadowOpacity ?? defaultLayerShadow.shadowOpacity))),
    shadowBlur: Math.max(0, Number(layer.shadowBlur ?? defaultLayerShadow.shadowBlur)),
    shadowOffsetX: Number(layer.shadowOffsetX ?? defaultLayerShadow.shadowOffsetX),
    shadowOffsetY: Number(layer.shadowOffsetY ?? defaultLayerShadow.shadowOffsetY),
  };
}

function normalizeQrLayer(layer: QrLayer): QrLayer {
  return {
    ...defaultQrStyle,
    ...normalizeLayerBase(layer),
    margin: Math.max(0, Number(layer.margin ?? defaultQrStyle.margin)),
    logoSize: Math.max(0.05, Math.min(0.8, Number(layer.logoSize ?? defaultQrStyle.logoSize))),
    logoMargin: Math.max(0, Number(layer.logoMargin ?? defaultQrStyle.logoMargin)),
  };
}

export function normalizeProject(project: QrMagicProject | LegacyProject): QrMagicProject {
  const legacySerial = "serial" in project.data ? project.data.serial : undefined;
  const groups =
    project.data.groups?.length
      ? project.data.groups.map((group) => normalizeDataGroup(group))
      : [
          normalizeDataGroup({
            id: DEFAULT_DATA_GROUP_ID,
            name: "Primary serial",
            mode: "serial" as const,
            serial: legacySerial ?? defaultSerialSettings,
          }),
        ];
  const defaultGroupId = groups[0]?.id ?? DEFAULT_DATA_GROUP_ID;
  const layers = project.layers.map((layer): ProjectLayer => {
    if (layer.type === "shape") {
      return normalizeShapeLayer(layer);
    }
    if (layer.type === "qr" && !layer.dataGroupId) {
      return normalizeQrLayer({ ...layer, dataGroupId: defaultGroupId });
    }
    if (layer.type === "qr") {
      return normalizeQrLayer(layer);
    }
    if (layer.type === "text" && layer.textTemplate.includes("{{serial}}") && !layer.dataGroupId) {
      return normalizeLayerBase({ ...layer, dataGroupId: defaultGroupId });
    }
    return normalizeLayerBase(layer);
  });

  return {
    ...project,
    document: {
      ...project.document,
      shape: {
        ...normalizedShapeGeometry({
          ...defaultShapeGeometry,
          ...(project.document.shape ?? {}),
        }),
      },
    },
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
