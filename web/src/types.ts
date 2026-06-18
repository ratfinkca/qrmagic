export type Unit = "px" | "in" | "mm";

export type LayerType = "image" | "qr" | "text" | "shape";

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
  payloadTemplate: string;
  foreground: string;
  background: string;
};

export type TextLayer = LayerBase & {
  type: "text";
  textTemplate: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  align: "left" | "center" | "right";
};

export type ImageLayer = LayerBase & {
  type: "image";
  assetId: string;
  fit: "stretch" | "contain" | "cover" | "original";
};

export type ShapeLayer = LayerBase & {
  type: "shape";
  shape: "rectangle";
  fill: string;
  stroke: string;
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

export type QrMagicProject = {
  version: 1;
  document: {
    name: string;
    unit: Unit;
    width: number;
    height: number;
    dpi: number;
    backgroundColor: string;
  };
  layers: ProjectLayer[];
  data: {
    mode: "serial";
    serial: SerialSettings;
  };
  export: {
    filenameTemplate: string;
    formats: Array<"png" | "jpg" | "pdf" | "svg" | "eps" | "bmp">;
    renderMode: "flattened" | "layered";
  };
};

export type RenderRecord = {
  index: number;
  serial: string;
};
