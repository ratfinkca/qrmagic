import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Path,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import Konva from "konva";
import type { EditorTool, ProjectLayer, QrLayer, QrMagicProject, RenderRecord, ShapeGeometry } from "../types";
import { documentPixelSize, guideSnapRect } from "../lib/project";
import { renderStyledQrDataUrl } from "../lib/qrStyling";
import { renderTemplate } from "../lib/serial";
import { polygonPath } from "../lib/shapeGeometry";

type EditorCanvasProps = {
  project: QrMagicProject;
  selectedLayerIds: string[];
  record: RenderRecord;
  zoom: number;
  zoomCommand: { id: number; mode: "fit" | "selection" } | null;
  activeTool: EditorTool;
  onZoomDelta: (delta: number) => void;
  onZoomChange: (zoom: number) => void;
  onFitScaleChange: (fitScale: number) => void;
  onSelectLayers: (layerIds: string[]) => void;
  onUpdateLayer: (layerId: string, patch: Partial<ProjectLayer>) => void;
  registerStage: (stage: Konva.Stage | null) => void;
};

function colorWithOpacity(color: string, opacity: number) {
  if (color === "transparent") {
    return color;
  }

  const normalized = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return color;
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
}

function useQrDataUrl(layer: QrLayer, record: RenderRecord) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let canceled = false;
    renderStyledQrDataUrl(layer, record)
      .then((url) => {
        if (!canceled) {
          setDataUrl(url);
        }
      })
      .catch(() => {
        if (!canceled) {
          setDataUrl("");
        }
      });

    return () => {
      canceled = true;
    };
  }, [layer, record]);

  return dataUrl;
}

function useHtmlImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    const nextImage = new window.Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = src;
  }, [src]);

  return image;
}

const WORKSPACE_GUTTER = 180;

type ShapeVisualProps = ShapeGeometry & {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
  opacity?: number;
  rotation?: number;
  listening?: boolean;
  draggable?: boolean;
  onMouseDown?: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseMove?: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseLeave?: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onClick?: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onTap?: (event: Konva.KonvaEventObject<Event>) => void;
  onDragStart?: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (event: Konva.KonvaEventObject<DragEvent>) => void;
};

function ShapeVisual({
  shape,
  cornerRadius,
  vertices,
  vertexInset,
  vertexRadius,
  sideDeflection,
  width,
  height,
  ...props
}: ShapeVisualProps) {
  if (shape === "ellipse") {
    return (
      <Ellipse
        {...props}
        x={(props.x ?? 0) + width / 2}
        y={(props.y ?? 0) + height / 2}
        radiusX={width / 2}
        radiusY={height / 2}
      />
    );
  }

  if (shape === "pill") {
    return (
      <Rect
        {...props}
        width={width}
        height={height}
        cornerRadius={Math.min(width, height) / 2}
      />
    );
  }

  if (shape !== "rectangle") {
    return (
      <Path
        {...props}
        data={polygonPath(width, height, {
          shape,
          cornerRadius,
          vertices,
          vertexInset,
          vertexRadius,
          sideDeflection,
        })}
      />
    );
  }

  return <Rect {...props} width={width} height={height} cornerRadius={cornerRadius} />;
}

function ImageNode({
  layer,
  selected,
  editable,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  layer: ProjectLayer;
  selected: boolean;
  editable: boolean;
  onSelect: (additive: boolean) => void;
  onPointerDown: (layer: ProjectLayer, node: Konva.Node) => void;
  onPointerMove: (layer: ProjectLayer, node: Konva.Node) => void;
  onPointerLeave: (node: Konva.Node) => void;
  onDragStart: (layerId: string, node: Konva.Node) => void;
  onDragMove: (layerId: string, node: Konva.Node) => void;
  onDragEnd: (layerId: string, node: Konva.Node) => void;
}) {
  const imageRef = useRef<Konva.Image>(null);
  const image = useHtmlImage(layer.type === "image" ? layer.src : "");

  if (layer.type !== "image") {
    return null;
  }

  return (
    <>
      {image ? (
        <KonvaImage
          ref={imageRef}
          id={layer.id}
          name="design-layer"
          image={image}
          x={layer.x}
          y={layer.y}
          width={layer.width}
          height={layer.height}
          rotation={layer.rotation}
          opacity={layer.opacity}
          draggable={editable && selected && !layer.locked}
          onMouseDown={(event) => editable && onPointerDown(layer, event.currentTarget)}
          onMouseMove={(event) => editable && onPointerMove(layer, event.currentTarget)}
          onMouseLeave={(event) => editable && onPointerLeave(event.currentTarget)}
          onClick={(event) => editable && onSelect(event.evt.shiftKey)}
          onTap={() => editable && onSelect(false)}
          onDragStart={(event) => onDragStart(layer.id, event.currentTarget)}
          onDragMove={(event) => onDragMove(layer.id, event.currentTarget)}
          onDragEnd={(event) => onDragEnd(layer.id, event.currentTarget)}
        />
      ) : null}
    </>
  );
}

function QrNode({
  layer,
  selected,
  editable,
  record,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  layer: QrLayer;
  selected: boolean;
  editable: boolean;
  record: RenderRecord;
  onSelect: (additive: boolean) => void;
  onPointerDown: (layer: ProjectLayer, node: Konva.Node) => void;
  onPointerMove: (layer: ProjectLayer, node: Konva.Node) => void;
  onPointerLeave: (node: Konva.Node) => void;
  onDragStart: (layerId: string, node: Konva.Node) => void;
  onDragMove: (layerId: string, node: Konva.Node) => void;
  onDragEnd: (layerId: string, node: Konva.Node) => void;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const dataUrl = useQrDataUrl(layer, record);
  const image = useHtmlImage(dataUrl);

  return (
    <>
      <Group
        ref={groupRef}
        id={layer.id}
        name="design-layer"
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={layer.height}
        rotation={layer.rotation}
        opacity={layer.opacity}
        draggable={editable && selected && !layer.locked}
        onMouseDown={(event) => editable && onPointerDown(layer, event.currentTarget)}
        onMouseMove={(event) => editable && onPointerMove(layer, event.currentTarget)}
        onMouseLeave={(event) => editable && onPointerLeave(event.currentTarget)}
        onClick={(event) => editable && onSelect(event.evt.shiftKey)}
        onTap={() => editable && onSelect(false)}
        onDragStart={(event) => onDragStart(layer.id, event.currentTarget)}
        onDragMove={(event) => onDragMove(layer.id, event.currentTarget)}
        onDragEnd={(event) => onDragEnd(layer.id, event.currentTarget)}
      >
        <Rect
          width={layer.width}
          height={layer.height}
          fill={layer.background}
          cornerRadius={6}
          shadowColor="rgba(15, 23, 42, 0.16)"
          shadowBlur={selected ? 16 : 8}
          shadowOffsetY={selected ? 8 : 4}
        />
        {image ? (
          <KonvaImage image={image} width={layer.width} height={layer.height} />
        ) : null}
      </Group>
    </>
  );
}

function TextNode({
  layer,
  selected,
  editable,
  record,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  layer: ProjectLayer;
  selected: boolean;
  editable: boolean;
  record: RenderRecord;
  onSelect: (additive: boolean) => void;
  onPointerDown: (layer: ProjectLayer, node: Konva.Node) => void;
  onPointerMove: (layer: ProjectLayer, node: Konva.Node) => void;
  onPointerLeave: (node: Konva.Node) => void;
  onDragStart: (layerId: string, node: Konva.Node) => void;
  onDragMove: (layerId: string, node: Konva.Node) => void;
  onDragEnd: (layerId: string, node: Konva.Node) => void;
}) {
  const textRef = useRef<Konva.Text>(null);

  if (layer.type !== "text") {
    return null;
  }

  return (
    <>
      <Text
        ref={textRef}
        id={layer.id}
        name="design-layer"
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={layer.height}
        text={renderTemplate(layer.textTemplate, record, layer.dataGroupId)}
        fontFamily={layer.fontFamily}
        fontSize={layer.fontSize}
        fontStyle={String(layer.fontWeight)}
        fill={colorWithOpacity(layer.fill, layer.fillOpacity)}
        align={layer.align}
        verticalAlign="middle"
        rotation={layer.rotation}
        opacity={layer.opacity}
        draggable={editable && selected && !layer.locked}
        onMouseDown={(event) => editable && onPointerDown(layer, event.currentTarget)}
        onMouseMove={(event) => editable && onPointerMove(layer, event.currentTarget)}
        onMouseLeave={(event) => editable && onPointerLeave(event.currentTarget)}
        onClick={(event) => editable && onSelect(event.evt.shiftKey)}
        onTap={() => editable && onSelect(false)}
        onDragStart={(event) => onDragStart(layer.id, event.currentTarget)}
        onDragMove={(event) => onDragMove(layer.id, event.currentTarget)}
        onDragEnd={(event) => onDragEnd(layer.id, event.currentTarget)}
      />
    </>
  );
}

function ShapeNode({
  layer,
  selected,
  editable,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  layer: ProjectLayer;
  selected: boolean;
  editable: boolean;
  onSelect: (additive: boolean) => void;
  onPointerDown: (layer: ProjectLayer, node: Konva.Node) => void;
  onPointerMove: (layer: ProjectLayer, node: Konva.Node) => void;
  onPointerLeave: (node: Konva.Node) => void;
  onDragStart: (layerId: string, node: Konva.Node) => void;
  onDragMove: (layerId: string, node: Konva.Node) => void;
  onDragEnd: (layerId: string, node: Konva.Node) => void;
}) {
  if (layer.type !== "shape") {
    return null;
  }

  return (
    <>
      <ShapeVisual
        id={layer.id}
        name="design-layer"
        shape={layer.shape}
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={layer.height}
        fill={colorWithOpacity(layer.fill, layer.fillOpacity)}
        stroke={colorWithOpacity(layer.stroke, layer.strokeOpacity)}
        strokeWidth={layer.strokeWidth}
        dash={layer.dash}
        cornerRadius={layer.cornerRadius}
        vertices={layer.vertices}
        vertexInset={layer.vertexInset}
        vertexRadius={layer.vertexRadius}
        sideDeflection={layer.sideDeflection}
        rotation={layer.rotation}
        opacity={layer.opacity}
        draggable={editable && selected && !layer.locked}
        onMouseDown={(event) => editable && onPointerDown(layer, event.currentTarget)}
        onMouseMove={(event) => editable && onPointerMove(layer, event.currentTarget)}
        onMouseLeave={(event) => editable && onPointerLeave(event.currentTarget)}
        onClick={(event) => editable && onSelect(event.evt.shiftKey)}
        onTap={() => editable && onSelect(false)}
        onDragStart={(event) => onDragStart(layer.id, event.currentTarget)}
        onDragMove={(event) => onDragMove(layer.id, event.currentTarget)}
        onDragEnd={(event) => onDragEnd(layer.id, event.currentTarget)}
      />
    </>
  );
}

export function EditorCanvas({
  project,
  selectedLayerIds,
  record,
  zoom,
  zoomCommand,
  activeTool,
  onZoomDelta,
  onZoomChange,
  onFitScaleChange,
  onSelectLayers,
  onUpdateLayer,
  registerStage,
}: EditorCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [selectionRect, setSelectionRect] = useState<{
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const panRef = useRef({
    active: false,
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const lassoRef = useRef<{
    active: boolean;
    additive: boolean;
    startX: number;
    startY: number;
  }>({
    active: false,
    additive: false,
    startX: 0,
    startY: 0,
  });
  const dragGroupRef = useRef<{
    layerId: string;
    startX: number;
    startY: number;
    positions: Record<string, { x: number; y: number }>;
  } | null>(null);
  const ignoreNextLayerClickRef = useRef(false);
  const docSize = useMemo(() => documentPixelSize(project), [project]);
  const fitScale = useMemo(() => {
    if (!viewportSize.width || !viewportSize.height) {
      return Math.min(1, 860 / docSize.width, 610 / docSize.height);
    }

    return Math.min(
      1,
      Math.max(0.05, (viewportSize.width - 72) / docSize.width),
      Math.max(0.05, (viewportSize.height - 72) / docSize.height),
    );
  }, [docSize.height, docSize.width, viewportSize.height, viewportSize.width]);
  const scale = fitScale * zoom;
  const stageWidth = (docSize.width + WORKSPACE_GUTTER * 2) * scale;
  const stageHeight = (docSize.height + WORKSPACE_GUTTER * 2) * scale;
  const bleedRect = guideSnapRect(project, "bleed");
  const safeAreaRect = guideSnapRect(project, "safeArea");
  const layerEditingEnabled = activeTool === "select";
  const previousScaleRef = useRef(scale);
  const pendingWheelZoomRef = useRef<{
    viewportX: number;
    viewportY: number;
    documentX: number;
    documentY: number;
  } | null>(null);
  const lastZoomCommandIdRef = useRef<number | null>(null);
  const centeredDocumentKeyRef = useRef("");
  const selectedLayers = useMemo(
    () => project.layers.filter((layer) => selectedLayerIds.includes(layer.id)),
    [project.layers, selectedLayerIds],
  );
  const selectedLayerSet = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds]);
  const lassoTargetIds = useMemo(() => {
    if (!selectionRect.visible) return [];
    return project.layers
      .filter((layer) => layer.visible && !layer.locked)
      .filter((layer) => layerIsInsideRect(layer, selectionRect))
      .map((layer) => layer.id);
  }, [project.layers, selectionRect]);
  const lassoTargetSet = useMemo(() => new Set(lassoTargetIds), [lassoTargetIds]);

  useEffect(() => {
    registerStage(stageRef.current);
    return () => registerStage(null);
  }, [registerStage]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const observedViewport = viewport;

    function updateViewportSize() {
      const rect = observedViewport.getBoundingClientRect();
      setViewportSize((current) => {
        if (current.width === rect.width && current.height === rect.height) {
          return current;
        }
        return {
          width: rect.width,
          height: rect.height,
        };
      });
    }

    updateViewportSize();
    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(observedViewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onFitScaleChange(fitScale);
  }, [fitScale, onFitScaleChange]);

  useEffect(() => {
    if (!viewportSize.width || !viewportSize.height) return;

    const documentKey = `${docSize.width}x${docSize.height}`;
    if (centeredDocumentKeyRef.current === documentKey) return;

    centeredDocumentKeyRef.current = documentKey;
    window.requestAnimationFrame(() => {
      centerViewportOnRect({ x: 0, y: 0, width: docSize.width, height: docSize.height }, 1);
    });
  }, [docSize.height, docSize.width, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage || activeTool !== "select") {
      transformer?.nodes([]);
      return;
    }

    const selectedNodes = selectedLayerIds
      .map((layerId) => stage.findOne(`#${layerId}`))
      .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(selectedNodes);
    transformer.getLayer()?.batchDraw();
  }, [activeTool, project.layers, selectedLayerIds]);

  useEffect(() => {
    const pendingZoom = pendingWheelZoomRef.current;
    const viewport = viewportRef.current;
    if (pendingZoom && viewport) {
      viewport.scrollLeft = pendingZoom.documentX * scale - pendingZoom.viewportX;
      viewport.scrollTop = pendingZoom.documentY * scale - pendingZoom.viewportY;
      pendingWheelZoomRef.current = null;
    }
    previousScaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const wheelViewport = viewport;

    function zoomPanMode(event: WheelEvent) {
      if (activeTool !== "pan") return;
      event.preventDefault();
      const rect = wheelViewport.getBoundingClientRect();
      const viewportX = event.clientX - rect.left;
      const viewportY = event.clientY - rect.top;
      pendingWheelZoomRef.current = {
        viewportX,
        viewportY,
        documentX: (wheelViewport.scrollLeft + viewportX) / previousScaleRef.current,
        documentY: (wheelViewport.scrollTop + viewportY) / previousScaleRef.current,
      };
      onZoomDelta(event.deltaY > 0 ? -0.1 : 0.1);
    }

    wheelViewport.addEventListener("wheel", zoomPanMode, { passive: false });
    return () => wheelViewport.removeEventListener("wheel", zoomPanMode);
  }, [activeTool, onZoomDelta]);

  useEffect(() => {
    if (!zoomCommand) return;
    if (lastZoomCommandIdRef.current === zoomCommand.id) return;
    lastZoomCommandIdRef.current = zoomCommand.id;

    const selectedBounds = selectedLayers.length ? selectionBounds(selectedLayers) : null;
    const targetRect =
      zoomCommand.mode === "selection" && selectedBounds
        ? selectedBounds
        : { x: 0, y: 0, width: docSize.width, height: docSize.height };
    const nextZoom =
      zoomCommand.mode === "selection" && selectedBounds ? zoomForRect(targetRect) : 1;

    onZoomChange(nextZoom);
    window.requestAnimationFrame(() => centerViewportOnRect(targetRect, nextZoom));
  }, [docSize.height, docSize.width, onZoomChange, selectedLayers, zoomCommand]);

  function startPan(event: ReactMouseEvent<HTMLDivElement>) {
    if (activeTool !== "pan" || !viewportRef.current) return;
    panRef.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    };
    event.preventDefault();
  }

  function movePan(event: ReactMouseEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!panRef.current.active || !viewport) return;
    viewport.scrollLeft = panRef.current.scrollLeft - (event.clientX - panRef.current.x);
    viewport.scrollTop = panRef.current.scrollTop - (event.clientY - panRef.current.y);
  }

  function stopPan() {
    panRef.current.active = false;
  }

  function selectLayer(layerId: string, additive: boolean) {
    if (ignoreNextLayerClickRef.current) {
      ignoreNextLayerClickRef.current = false;
      return;
    }

    if (!additive) {
      onSelectLayers([layerId]);
      return;
    }

    onSelectLayers(
      selectedLayerIds.includes(layerId)
        ? selectedLayerIds.filter((selectedId) => selectedId !== layerId)
        : [...selectedLayerIds, layerId],
    );
  }

  function documentPointerPosition() {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return null;
    return {
      x: pointer.x / scale - WORKSPACE_GUTTER,
      y: pointer.y / scale - WORKSPACE_GUTTER,
    };
  }

  function pointerIsNearLayerEdge(layer: ProjectLayer) {
    if (!selectedLayerSet.has(layer.id) || layer.locked) return false;
    const pointer = documentPointerPosition();
    if (!pointer) return false;
    const tolerance = Math.max(8, 12 / scale);
    const insideX = pointer.x >= layer.x - tolerance && pointer.x <= layer.x + layer.width + tolerance;
    const insideY = pointer.y >= layer.y - tolerance && pointer.y <= layer.y + layer.height + tolerance;
    if (!insideX || !insideY) return false;

    return (
      Math.abs(pointer.x - layer.x) <= tolerance ||
      Math.abs(pointer.x - (layer.x + layer.width)) <= tolerance ||
      Math.abs(pointer.y - layer.y) <= tolerance ||
      Math.abs(pointer.y - (layer.y + layer.height)) <= tolerance
    );
  }

  function layerIsInsideRect(
    layer: ProjectLayer,
    rect: { x: number; y: number; width: number; height: number },
  ) {
    return (
      layer.x >= rect.x &&
      layer.y >= rect.y &&
      layer.x + layer.width <= rect.x + rect.width &&
      layer.y + layer.height <= rect.y + rect.height
    );
  }

  function selectionBounds(layers: ProjectLayer[]) {
    const minX = Math.min(...layers.map((layer) => layer.x));
    const minY = Math.min(...layers.map((layer) => layer.y));
    const maxX = Math.max(...layers.map((layer) => layer.x + layer.width));
    const maxY = Math.max(...layers.map((layer) => layer.y + layer.height));
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  function zoomForRect(rect: { width: number; height: number }) {
    const viewport = viewportRef.current;
    if (!viewport || rect.width <= 0 || rect.height <= 0) return 1;

    const targetScale = Math.min(
      4,
      Math.max(
        fitScale,
        Math.min(
          (viewport.clientWidth * 0.78) / rect.width,
          (viewport.clientHeight * 0.78) / rect.height,
        ),
      ),
    );
    return Math.min(8, Math.max(0.25, Number((targetScale / fitScale).toFixed(3))));
  }

  function centerViewportOnRect(
    rect: { x: number; y: number; width: number; height: number },
    nextZoom: number,
  ) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const nextScale = fitScale * nextZoom;
    const centerX = WORKSPACE_GUTTER + rect.x + rect.width / 2;
    const centerY = WORKSPACE_GUTTER + rect.y + rect.height / 2;
    viewport.scrollLeft = centerX * nextScale - viewport.clientWidth / 2;
    viewport.scrollTop = centerY * nextScale - viewport.clientHeight / 2;
  }

  function setStageCursor(cursor: string) {
    const container = stageRef.current?.container();
    if (container) {
      container.style.cursor = cursor;
    }
  }

  function prepareLayerMove(layer: ProjectLayer, node: Konva.Node) {
    const canMove = activeTool === "select" && pointerIsNearLayerEdge(layer);
    setStageCursor(canMove ? "move" : "crosshair");
  }

  function updateLayerMoveCursor(layer: ProjectLayer, node: Konva.Node) {
    const canMove = activeTool === "select" && pointerIsNearLayerEdge(layer);
    if (activeTool === "select") {
      setStageCursor(canMove ? "move" : "crosshair");
    }
  }

  function clearLayerMove(node: Konva.Node) {
    setStageCursor(activeTool === "select" ? "default" : "");
  }

  function closestDesignLayerNode(node: Konva.Node) {
    if (node.hasName("design-layer")) return node;
    return node.getAncestors().find((ancestor) => ancestor.hasName("design-layer")) ?? null;
  }

  function startLasso(event: Konva.KonvaEventObject<globalThis.MouseEvent>) {
    if (activeTool !== "select") return;
    const target = event.target;
    const targetIsTransformer = target.getParent()?.className === "Transformer";
    const designLayerTarget = closestDesignLayerNode(target);
    const targetIsSelectedLayer =
      Boolean(designLayerTarget) &&
      selectedLayerSet.has(designLayerTarget?.id() ?? "");
    if (targetIsTransformer || targetIsSelectedLayer) return;

    const pointer = documentPointerPosition();
    if (!pointer) return;
    lassoRef.current = {
      active: true,
      additive: event.evt.shiftKey,
      startX: pointer.x,
      startY: pointer.y,
    };
    setSelectionRect({
      visible: true,
      x: pointer.x,
      y: pointer.y,
      width: 0,
      height: 0,
    });
  }

  function moveLasso() {
    if (!lassoRef.current.active) return;
    const pointer = documentPointerPosition();
    if (!pointer) return;
    const x = Math.min(lassoRef.current.startX, pointer.x);
    const y = Math.min(lassoRef.current.startY, pointer.y);
    const width = Math.abs(pointer.x - lassoRef.current.startX);
    const height = Math.abs(pointer.y - lassoRef.current.startY);
    setSelectionRect({ visible: true, x, y, width, height });
  }

  function stopLasso() {
    if (!lassoRef.current.active) return;
    const nextSelectionRect = selectionRect;
    const wasClick = nextSelectionRect.width < 4 && nextSelectionRect.height < 4;
    if (wasClick) {
      onSelectLayers([]);
    } else {
      const box = {
        x: nextSelectionRect.x,
        y: nextSelectionRect.y,
        width: nextSelectionRect.width,
        height: nextSelectionRect.height,
      };
      const selectedIds = project.layers
        .filter((layer) => layer.visible && !layer.locked)
        .filter((layer) => layerIsInsideRect(layer, box))
        .map((layer) => layer.id);
      onSelectLayers(
        lassoRef.current.additive
          ? Array.from(new Set([...selectedLayerIds, ...selectedIds]))
          : selectedIds,
      );
      ignoreNextLayerClickRef.current = true;
      window.setTimeout(() => {
        ignoreNextLayerClickRef.current = false;
      }, 0);
    }

    lassoRef.current.active = false;
    setSelectionRect((current) => ({ ...current, visible: false }));
  }

  function dragSelectedLayersStart(layerId: string, node: Konva.Node) {
    if (!selectedLayerSet.has(layerId)) return;
    dragGroupRef.current = {
      layerId,
      startX: node.x(),
      startY: node.y(),
      positions: Object.fromEntries(
        selectedLayers.map((layer) => [layer.id, { x: layer.x, y: layer.y }]),
      ),
    };
  }

  function dragSelectedLayersMove(layerId: string, node: Konva.Node) {
    const dragState = dragGroupRef.current;
    const stage = stageRef.current;
    if (!dragState || !stage || dragState.layerId !== layerId || selectedLayerIds.length < 2) {
      return;
    }

    const deltaX = node.x() - dragState.startX;
    const deltaY = node.y() - dragState.startY;
    selectedLayerIds.forEach((selectedId) => {
      if (selectedId === layerId) return;
      const otherNode = stage.findOne(`#${selectedId}`);
      const otherPosition = dragState.positions[selectedId];
      if (!otherNode || !otherPosition) return;
      otherNode.position({
        x: otherPosition.x + deltaX,
        y: otherPosition.y + deltaY,
      });
    });
    transformerRef.current?.forceUpdate();
  }

  function dragSelectedLayersEnd(layerId: string, node: Konva.Node) {
    const dragState = dragGroupRef.current;
    if (!dragState || dragState.layerId !== layerId) {
      onUpdateLayer(layerId, { x: node.x(), y: node.y() });
      window.requestAnimationFrame(() => transformerRef.current?.forceUpdate());
      return;
    }

    const deltaX = node.x() - dragState.startX;
    const deltaY = node.y() - dragState.startY;
    selectedLayerIds.forEach((selectedId) => {
      const position = dragState.positions[selectedId];
      if (!position) return;
      onUpdateLayer(selectedId, {
        x: position.x + deltaX,
        y: position.y + deltaY,
      });
    });
    dragGroupRef.current = null;
    window.requestAnimationFrame(() => transformerRef.current?.forceUpdate());
  }

  function finishTransform() {
    const transformer = transformerRef.current;
    if (!transformer) return;

    transformer.nodes().forEach((node) => {
      const layer = project.layers.find((currentLayer) => currentLayer.id === node.id());
      if (!layer) return;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      const minSize = layer.type === "qr" ? 72 : layer.type === "text" ? 28 : 20;
      onUpdateLayer(layer.id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(minSize, layer.width * scaleX),
        height: Math.max(minSize, layer.height * scaleY),
        rotation: node.rotation(),
      });
    });
  }

  return (
    <div className="canvas-shell">
      <div className="canvas-meta">
        <span>{project.document.name}</span>
        <span>
          {project.document.width} {project.document.unit} x {project.document.height}{" "}
          {project.document.unit} at {project.document.dpi} DPI
        </span>
      </div>
      <div
        ref={viewportRef}
        className={`canvas-viewport ${activeTool === "pan" ? "pan-mode" : ""}`}
        onMouseDown={startPan}
        onMouseMove={movePan}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
      >
        <div className="canvas-stage-wrap">
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            scaleX={scale}
            scaleY={scale}
            className="document-stage"
            onMouseDown={startLasso}
            onMouseMove={moveLasso}
            onMouseUp={stopLasso}
          >
            <Layer>
              <Rect
                width={docSize.width + WORKSPACE_GUTTER * 2}
                height={docSize.height + WORKSPACE_GUTTER * 2}
                fill="transparent"
              />
              <Group
                name="document-content"
                x={WORKSPACE_GUTTER}
                y={WORKSPACE_GUTTER}
              >
                <Rect
                  name="document-background"
                  width={docSize.width}
                  height={docSize.height}
                  fill={
                    project.document.transparentBackground
                      ? "transparent"
                      : project.document.backgroundColor
                  }
                  shadowColor="rgba(15, 23, 42, 0.18)"
                  shadowBlur={28}
                  shadowOffsetY={16}
                />
                {project.layers.map((layer) => {
                  if (!layer.visible) return null;
                  if (layer.type === "shape") {
                    return (
                      <ShapeNode
                        key={layer.id}
                        layer={layer}
                        selected={selectedLayerSet.has(layer.id)}
                        editable={layerEditingEnabled}
                        onSelect={(additive) => selectLayer(layer.id, additive)}
                        onPointerDown={prepareLayerMove}
                        onPointerMove={updateLayerMoveCursor}
                        onPointerLeave={clearLayerMove}
                        onDragStart={dragSelectedLayersStart}
                        onDragMove={dragSelectedLayersMove}
                        onDragEnd={dragSelectedLayersEnd}
                      />
                    );
                  }
                  if (layer.type === "image") {
                    return (
                      <ImageNode
                        key={layer.id}
                        layer={layer}
                        selected={selectedLayerSet.has(layer.id)}
                        editable={layerEditingEnabled}
                        onSelect={(additive) => selectLayer(layer.id, additive)}
                        onPointerDown={prepareLayerMove}
                        onPointerMove={updateLayerMoveCursor}
                        onPointerLeave={clearLayerMove}
                        onDragStart={dragSelectedLayersStart}
                        onDragMove={dragSelectedLayersMove}
                        onDragEnd={dragSelectedLayersEnd}
                      />
                    );
                  }
                  if (layer.type === "qr") {
                    return (
                      <QrNode
                        key={layer.id}
                        layer={layer}
                        selected={selectedLayerSet.has(layer.id)}
                        editable={layerEditingEnabled}
                        record={record}
                        onSelect={(additive) => selectLayer(layer.id, additive)}
                        onPointerDown={prepareLayerMove}
                        onPointerMove={updateLayerMoveCursor}
                        onPointerLeave={clearLayerMove}
                        onDragStart={dragSelectedLayersStart}
                        onDragMove={dragSelectedLayersMove}
                        onDragEnd={dragSelectedLayersEnd}
                      />
                    );
                  }
                  if (layer.type === "text") {
                    return (
                      <TextNode
                        key={layer.id}
                        layer={layer}
                        selected={selectedLayerSet.has(layer.id)}
                        editable={layerEditingEnabled}
                        record={record}
                        onSelect={(additive) => selectLayer(layer.id, additive)}
                        onPointerDown={prepareLayerMove}
                        onPointerMove={updateLayerMoveCursor}
                        onPointerLeave={clearLayerMove}
                        onDragStart={dragSelectedLayersStart}
                        onDragMove={dragSelectedLayersMove}
                        onDragEnd={dragSelectedLayersEnd}
                      />
                    );
                  }
                  return null;
                })}
                {layerEditingEnabled ? (
                  <>
                    {project.layers.map((layer) => {
                      if (!layer.visible || !selectedLayerSet.has(layer.id)) return null;
                      return (
                        <Rect
                          key={`selected-outline-${layer.id}`}
                          name="selection-overlay"
                          x={layer.x}
                          y={layer.y}
                          width={layer.width}
                          height={layer.height}
                          rotation={layer.rotation}
                          stroke="#0891b2"
                          strokeWidth={1.5}
                          dash={[5, 5]}
                          opacity={0.82}
                          listening={false}
                        />
                      );
                    })}
                    {selectionRect.visible
                      ? project.layers.map((layer) => {
                          if (!layer.visible || !lassoTargetSet.has(layer.id)) return null;
                          return (
                            <Rect
                              key={`lasso-target-${layer.id}`}
                              name="selection-overlay"
                              x={layer.x}
                              y={layer.y}
                              width={layer.width}
                              height={layer.height}
                              rotation={layer.rotation}
                              fill="rgba(20, 184, 166, 0.1)"
                              stroke="#0f766e"
                              strokeWidth={2}
                              dash={[8, 5]}
                              listening={false}
                            />
                          );
                        })
                      : null}
                  </>
                ) : null}
                {layerEditingEnabled ? (
                  <Transformer
                    ref={transformerRef}
                    rotateEnabled
                    onTransformEnd={finishTransform}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 20 || newBox.height < 20) return oldBox;
                      return newBox;
                    }}
                  />
                ) : null}
                {selectionRect.visible ? (
                  <Rect
                    x={selectionRect.x}
                    y={selectionRect.y}
                    width={selectionRect.width}
                    height={selectionRect.height}
                    fill="rgba(20, 184, 166, 0.12)"
                    stroke="#0f766e"
                    strokeWidth={1.5}
                    dash={[6, 5]}
                    listening={false}
                  />
                ) : null}
              </Group>
            </Layer>
            {project.document.guides.enabled ? (
              <Layer name="guides-layer" listening={false}>
                <Group
                  name="document-content"
                  x={WORKSPACE_GUTTER}
                  y={WORKSPACE_GUTTER}
                >
                  {project.document.guides.showBleed ? (
                    <ShapeVisual
                      x={bleedRect.x}
                      y={bleedRect.y}
                      width={bleedRect.width}
                      height={bleedRect.height}
                      shape={project.document.shape.shape}
                      cornerRadius={project.document.shape.cornerRadius}
                      vertices={project.document.shape.vertices}
                      vertexInset={project.document.shape.vertexInset}
                      vertexRadius={project.document.shape.vertexRadius}
                      sideDeflection={project.document.shape.sideDeflection}
                      stroke="#f97316"
                      strokeWidth={2}
                      dash={[10, 8]}
                      opacity={0.9}
                      listening={false}
                    />
                  ) : null}
                  {project.document.guides.showTrim ? (
                    <ShapeVisual
                      x={0.5}
                      y={0.5}
                      width={docSize.width - 1}
                      height={docSize.height - 1}
                      shape={project.document.shape.shape}
                      cornerRadius={project.document.shape.cornerRadius}
                      vertices={project.document.shape.vertices}
                      vertexInset={project.document.shape.vertexInset}
                      vertexRadius={project.document.shape.vertexRadius}
                      sideDeflection={project.document.shape.sideDeflection}
                      stroke="#0f172a"
                      strokeWidth={2}
                      dash={[18, 12]}
                      opacity={0.75}
                      listening={false}
                    />
                  ) : null}
                  {project.document.guides.showSafeArea ? (
                    <ShapeVisual
                      x={safeAreaRect.x}
                      y={safeAreaRect.y}
                      width={safeAreaRect.width}
                      height={safeAreaRect.height}
                      shape={project.document.shape.shape}
                      cornerRadius={project.document.shape.cornerRadius}
                      vertices={project.document.shape.vertices}
                      vertexInset={project.document.shape.vertexInset}
                      vertexRadius={project.document.shape.vertexRadius}
                      sideDeflection={project.document.shape.sideDeflection}
                      stroke="#0f766e"
                      strokeWidth={2}
                      dash={[6, 8]}
                      opacity={0.9}
                      listening={false}
                    />
                  ) : null}
                </Group>
              </Layer>
            ) : null}
          </Stage>
        </div>
      </div>
    </div>
  );
}
