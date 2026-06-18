import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import QRCode from "qrcode";
import type { ProjectLayer, QrMagicProject, RenderRecord } from "../types";
import { documentPixelSize } from "../lib/project";
import { renderTemplate } from "../lib/serial";

type EditorCanvasProps = {
  project: QrMagicProject;
  selectedLayerId: string;
  record: RenderRecord;
  onSelectLayer: (layerId: string) => void;
  onUpdateLayer: (layerId: string, patch: Partial<ProjectLayer>) => void;
  registerStage: (stage: Konva.Stage | null) => void;
};

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
        fill={layer.fill}
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

export function EditorCanvas({
  project,
  selectedLayerId,
  record,
  onSelectLayer,
  onUpdateLayer,
  registerStage,
}: EditorCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const docSize = useMemo(() => documentPixelSize(project), [project]);
  const scale = Math.min(1, 860 / docSize.width, 610 / docSize.height);
  const stageWidth = docSize.width * scale;
  const stageHeight = docSize.height * scale;

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
              fill={project.document.backgroundColor}
              shadowColor="rgba(15, 23, 42, 0.18)"
              shadowBlur={28}
              shadowOffsetY={16}
            />
            <Rect
              x={36}
              y={36}
              width={docSize.width - 72}
              height={docSize.height - 72}
              fill="#f59e0b"
              opacity={0.94}
              cornerRadius={18}
            />
            <Rect
              x={82}
              y={82}
              width={docSize.width - 164}
              height={docSize.height - 164}
              stroke="#111827"
              strokeWidth={8}
              dash={[18, 16]}
              cornerRadius={24}
              opacity={0.65}
            />
            <Text
              x={96}
              y={108}
              width={760}
              text="FESTIVAL PARKING"
              fontFamily="Inter, Arial, sans-serif"
              fontSize={54}
              fontStyle="800"
              fill="#111827"
            />
            <Text
              x={100}
              y={184}
              width={560}
              text="LOT A - WEEKEND ACCESS"
              fontFamily="Inter, Arial, sans-serif"
              fontSize={28}
              fontStyle="700"
              fill="#374151"
            />
            {project.layers.map((layer) => {
              if (!layer.visible) return null;
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
        </Stage>
      </div>
    </div>
  );
}
