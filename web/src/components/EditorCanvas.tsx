import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import QRCode from "qrcode";
import type { ProjectLayer, QrMagicProject, RenderRecord } from "../types";
import { documentPixelSize, guideSnapRect } from "../lib/project";
import { renderTemplate } from "../lib/serial";

type EditorCanvasProps = {
  project: QrMagicProject;
  selectedLayerId: string;
  record: RenderRecord;
  zoom: number;
  onSelectLayer: (layerId: string) => void;
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

function useQrDataUrl(layer: ProjectLayer, record: RenderRecord) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (layer.type !== "qr") {
      setDataUrl("");
      return;
    }

    let canceled = false;
    QRCode.toDataURL(renderTemplate(layer.payloadTemplate, record), {
      margin: 2,
      color: {
        dark: layer.foreground,
        light: layer.background,
      },
      errorCorrectionLevel: "M",
      width: Math.max(layer.width, layer.height),
    }).then((url) => {
      if (!canceled) {
        setDataUrl(url);
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

function ImageNode({
  layer,
  selected,
  onSelect,
  onUpdate,
}: {
  layer: ProjectLayer;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<ProjectLayer>) => void;
}) {
  const imageRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const image = useHtmlImage(layer.type === "image" ? layer.src : "");

  useEffect(() => {
    if (selected && transformerRef.current && imageRef.current) {
      transformerRef.current.nodes([imageRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  if (layer.type !== "image") {
    return null;
  }

  return (
    <>
      {image ? (
        <KonvaImage
          ref={imageRef}
          image={image}
          x={layer.x}
          y={layer.y}
          width={layer.width}
          height={layer.height}
          rotation={layer.rotation}
          opacity={layer.opacity}
          draggable={!layer.locked}
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(event) => onUpdate({ x: event.target.x(), y: event.target.y() })}
          onTransformEnd={() => {
            const node = imageRef.current;
            if (!node) return;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            onUpdate({
              x: node.x(),
              y: node.y(),
              width: Math.max(20, layer.width * scaleX),
              height: Math.max(20, layer.height * scaleY),
              rotation: node.rotation(),
            });
          }}
        />
      ) : null}
      {selected ? <Transformer ref={transformerRef} rotateEnabled /> : null}
    </>
  );
}

function QrNode({
  layer,
  selected,
  record,
  onSelect,
  onUpdate,
}: {
  layer: ProjectLayer;
  selected: boolean;
  record: RenderRecord;
  onSelect: () => void;
  onUpdate: (patch: Partial<ProjectLayer>) => void;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const dataUrl = useQrDataUrl(layer, record);
  const image = useHtmlImage(dataUrl);

  useEffect(() => {
    if (selected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  if (layer.type !== "qr") {
    return null;
  }

  return (
    <>
      <Group
        ref={groupRef}
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={layer.height}
        rotation={layer.rotation}
        opacity={layer.opacity}
        draggable={!layer.locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(event) => onUpdate({ x: event.target.x(), y: event.target.y() })}
        onTransformEnd={() => {
          const node = groupRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onUpdate({
            x: node.x(),
            y: node.y(),
            width: Math.max(72, layer.width * scaleX),
            height: Math.max(72, layer.height * scaleY),
            rotation: node.rotation(),
          });
        }}
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
      {selected ? (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 72 || newBox.height < 72) return oldBox;
            return newBox;
          }}
        />
      ) : null}
    </>
  );
}

function TextNode({
  layer,
  selected,
  record,
  onSelect,
  onUpdate,
}: {
  layer: ProjectLayer;
  selected: boolean;
  record: RenderRecord;
  onSelect: () => void;
  onUpdate: (patch: Partial<ProjectLayer>) => void;
}) {
  const textRef = useRef<Konva.Text>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (selected && transformerRef.current && textRef.current) {
      transformerRef.current.nodes([textRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  if (layer.type !== "text") {
    return null;
  }

  return (
    <>
      <Text
        ref={textRef}
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={layer.height}
        text={renderTemplate(layer.textTemplate, record)}
        fontFamily={layer.fontFamily}
        fontSize={layer.fontSize}
        fontStyle={String(layer.fontWeight)}
        fill={colorWithOpacity(layer.fill, layer.fillOpacity)}
        align={layer.align}
        verticalAlign="middle"
        rotation={layer.rotation}
        opacity={layer.opacity}
        draggable={!layer.locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(event) => onUpdate({ x: event.target.x(), y: event.target.y() })}
        onTransformEnd={() => {
          const node = textRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onUpdate({
            x: node.x(),
            y: node.y(),
            width: Math.max(80, layer.width * scaleX),
            height: Math.max(28, layer.height * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {selected ? <Transformer ref={transformerRef} rotateEnabled /> : null}
    </>
  );
}

function ShapeNode({
  layer,
  selected,
  onSelect,
  onUpdate,
}: {
  layer: ProjectLayer;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<ProjectLayer>) => void;
}) {
  const rectRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (selected && transformerRef.current && rectRef.current) {
      transformerRef.current.nodes([rectRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  if (layer.type !== "shape") {
    return null;
  }

  return (
    <>
      <Rect
        ref={rectRef}
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={layer.height}
        fill={colorWithOpacity(layer.fill, layer.fillOpacity)}
        stroke={colorWithOpacity(layer.stroke, layer.strokeOpacity)}
        strokeWidth={layer.strokeWidth}
        dash={layer.dash}
        cornerRadius={layer.cornerRadius}
        rotation={layer.rotation}
        opacity={layer.opacity}
        draggable={!layer.locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(event) => onUpdate({ x: event.target.x(), y: event.target.y() })}
        onTransformEnd={() => {
          const node = rectRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onUpdate({
            x: node.x(),
            y: node.y(),
            width: Math.max(20, layer.width * scaleX),
            height: Math.max(20, layer.height * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {selected ? <Transformer ref={transformerRef} rotateEnabled /> : null}
    </>
  );
}

export function EditorCanvas({
  project,
  selectedLayerId,
  record,
  zoom,
  onSelectLayer,
  onUpdateLayer,
  registerStage,
}: EditorCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const docSize = useMemo(() => documentPixelSize(project), [project]);
  const fitScale = Math.min(1, 860 / docSize.width, 610 / docSize.height);
  const scale = fitScale * zoom;
  const stageWidth = docSize.width * scale;
  const stageHeight = docSize.height * scale;
  const bleedRect = guideSnapRect(project, "bleed");
  const safeAreaRect = guideSnapRect(project, "safeArea");

  useEffect(() => {
    registerStage(stageRef.current);
    return () => registerStage(null);
  }, [registerStage]);

  return (
    <div className="canvas-shell">
      <div className="canvas-meta">
        <span>{project.document.name}</span>
        <span>
          {project.document.width} {project.document.unit} x {project.document.height}{" "}
          {project.document.unit} at {project.document.dpi} DPI
        </span>
      </div>
      <div className="canvas-viewport">
        <div className="canvas-stage-wrap">
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            scaleX={scale}
            scaleY={scale}
            className="document-stage"
          >
            <Layer>
              <Rect
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
                      selected={layer.id === selectedLayerId}
                      onSelect={() => onSelectLayer(layer.id)}
                      onUpdate={(patch) => onUpdateLayer(layer.id, patch)}
                    />
                  );
                }
                if (layer.type === "image") {
                  return (
                    <ImageNode
                      key={layer.id}
                      layer={layer}
                      selected={layer.id === selectedLayerId}
                      onSelect={() => onSelectLayer(layer.id)}
                      onUpdate={(patch) => onUpdateLayer(layer.id, patch)}
                    />
                  );
                }
                if (layer.type === "qr") {
                  return (
                    <QrNode
                      key={layer.id}
                      layer={layer}
                      selected={layer.id === selectedLayerId}
                      record={record}
                      onSelect={() => onSelectLayer(layer.id)}
                      onUpdate={(patch) => onUpdateLayer(layer.id, patch)}
                    />
                  );
                }
                if (layer.type === "text") {
                  return (
                    <TextNode
                      key={layer.id}
                      layer={layer}
                      selected={layer.id === selectedLayerId}
                      record={record}
                      onSelect={() => onSelectLayer(layer.id)}
                      onUpdate={(patch) => onUpdateLayer(layer.id, patch)}
                    />
                  );
                }
                return null;
              })}
            </Layer>
            {project.document.guides.enabled ? (
              <Layer name="guides-layer" listening={false}>
                {project.document.guides.showBleed ? (
                  <Rect
                    x={bleedRect.x}
                    y={bleedRect.y}
                    width={bleedRect.width}
                    height={bleedRect.height}
                    stroke="#f97316"
                    strokeWidth={2}
                    dash={[10, 8]}
                    opacity={0.9}
                  />
                ) : null}
                {project.document.guides.showTrim ? (
                  <Rect
                    x={0.5}
                    y={0.5}
                    width={docSize.width - 1}
                    height={docSize.height - 1}
                    stroke="#0f172a"
                    strokeWidth={2}
                    dash={[18, 12]}
                    opacity={0.75}
                  />
                ) : null}
                {project.document.guides.showSafeArea ? (
                  <Rect
                    x={safeAreaRect.x}
                    y={safeAreaRect.y}
                    width={safeAreaRect.width}
                    height={safeAreaRect.height}
                    stroke="#0f766e"
                    strokeWidth={2}
                    dash={[6, 8]}
                    opacity={0.9}
                  />
                ) : null}
              </Layer>
            ) : null}
          </Stage>
        </div>
      </div>
    </div>
  );
}
