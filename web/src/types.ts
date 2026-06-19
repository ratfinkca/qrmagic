export type Unit = "px" | "in" | "mm";

export type LayerType = "image" | "qr" | "text" | "shape";

export type GuideSnapTarget = "page" | "trim" | "bleed" | "safeArea";

export type EditorTool = "select" | "pan";

export type LayerBase = {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
};

export type QrLayer = LayerBase & {
  type: "qr";
  dataGroupId: string;
  payloadTemplate: string;
  foreground: string;
  background: string;
};

export type TextLayer = LayerBase & {
  type: "text";
  dataGroupId?: string;
  textTemplate: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  fillOpacity: number;
  align: "left" | "center" | "right";
};

export type ImageLayer = LayerBase & {
  type: "image";
  assetId: string;
  src: string;
  fit: "stretch" | "contain" | "cover" | "original";
};

export type ShapeLayer = LayerBase & {
  type: "shape";
  shape: "rectangle";
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  dash: number[];
  cornerRadius: number;
};

export type ProjectLayer = QrLayer | TextLayer | ImageLayer | ShapeLayer;

export type SerialSettings = {
  prefix: string;
  suffix: string;
  start: number;
  quantity: number;
  step: number;
  padding: number;
};

export type DataGroup = {
  id: string;
  name: string;
  mode: "serial";
  serial: SerialSettings;
};

export type QrMagicProject = {
  version: 1;
  document: {
    name: string;
    unit: Unit;
    width: number;
    height: number;
    dpi: number;
    backgroundColor: string;
    transparentBackground: boolean;
    guides: {
      enabled: boolean;
      showTrim: boolean;
      showBleed: boolean;
      showSafeArea: boolean;
      bleedRatio: number;
      safeAreaRatio: number;
    };
  };
  layers: ProjectLayer[];
  data: {
    mode: "serial";
    groups: DataGroup[];
  };
  export: {
    filenameTemplate: string;
    formats: Array<"png" | "jpg" | "pdf" | "svg" | "eps" | "bmp">;
    renderMode: "flattened" | "layered";
    includeGuides: boolean;
  };
};

export type QrMagicProjectFile = {
  format: "qrmagic.project";
  savedAt: string;
  project: QrMagicProject;
};

export type RenderRecord = {
  index: number;
  serial: string;
  groups: Record<
    string,
    {
      serial: string;
    }
  >;
};
