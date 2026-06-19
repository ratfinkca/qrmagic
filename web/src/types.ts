export type Unit = "px" | "in" | "mm";

export type LayerType = "image" | "qr" | "text" | "shape";

export type GuideSnapTarget = "page" | "trim" | "bleed" | "safeArea";

export type EditorTool = "select" | "pan";

export type ShapeFillMode = "solid" | "linear-gradient" | "radial-gradient";

export type ShapeKind =
  | "rectangle"
  | "ellipse"
  | "polygon"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "roundedHexagon"
  | "pill"
  | "guitarPick"
  | "shield";

export type ShapeGeometry = {
  shape: ShapeKind;
  cornerRadius: number;
  vertices: number;
  vertexInset: number;
  vertexRadius: number;
  sideDeflection: number;
};

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
  shadowEnabled: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
};

export type QrLayer = LayerBase & {
  type: "qr";
  dataGroupId: string;
  payloadTemplate: string;
  foreground: string;
  background: string;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  margin: number;
  dotStyle: "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
  cornerSquareStyle:
    | "square"
    | "dot"
    | "rounded"
    | "dots"
    | "classy"
    | "classy-rounded"
    | "extra-rounded";
  cornerDotStyle:
    | "square"
    | "dot"
    | "rounded"
    | "dots"
    | "classy"
    | "classy-rounded"
    | "extra-rounded";
  logoEnabled: boolean;
  logoSrc: string;
  logoSize: number;
  logoMargin: number;
  logoHideBackgroundDots: boolean;
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
  shape: ShapeKind;
  fillMode: ShapeFillMode;
  fill: string;
  fillGradientFrom: string;
  fillGradientTo: string;
  fillGradientAngle: number;
  fillOpacity: number;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  dash: number[];
  cornerRadius: number;
  vertices: number;
  vertexInset: number;
  vertexRadius: number;
  sideDeflection: number;
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

export type FixedSettings = {
  value: string;
  quantity: number;
};

export type SerialDataGroup = {
  id: string;
  name: string;
  mode: "serial";
  serial: SerialSettings;
};

export type FixedDataGroup = {
  id: string;
  name: string;
  mode: "fixed";
  fixed: FixedSettings;
};

export type DataGroup = SerialDataGroup | FixedDataGroup;

export type QrMagicProject = {
  version: 1;
  colors: {
    recent: string[];
    palette: string[];
  };
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
    shape: ShapeGeometry;
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
