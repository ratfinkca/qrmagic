import { useMemo, useRef, useState } from "react";
import type Konva from "konva";
import JSZip from "jszip";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDownToLine,
  MousePointer2,
  PanelLeft,
  ScanQrCode,
} from "lucide-react";
import { EditorCanvas } from "./components/EditorCanvas";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import { documentPixelSize, initialProject } from "./lib/project";
import { createSerialRecords, renderTemplate } from "./lib/serial";
import type { ProjectLayer, QrMagicProject } from "./types";

export function App() {
  const [project, setProject] = useState<QrMagicProject>(initialProject);
  const [selectedLayerId, setSelectedLayerId] = useState(initialProject.layers[0].id);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(0);
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [isExportingBatch, setIsExportingBatch] = useState(false);
  const stageRef = useRef<Konva.Stage | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const records = useMemo(
    () => createSerialRecords(project.data.serial),
    [project.data.serial],
  );
  const docSize = useMemo(() => documentPixelSize(project), [project]);
  const currentRecord = records[Math.min(selectedRecordIndex, records.length - 1)] ?? records[0];
  const selectedLayer = project.layers.find((layer) => layer.id === selectedLayerId);

  function updateLayer(layerId: string, patch: Partial<ProjectLayer>) {
    setProject((current) => ({
      ...current,
      layers: current.layers.map((layer) =>
        layer.id === layerId ? ({ ...layer, ...patch } as ProjectLayer) : layer,
      ),
    }));
  }

  function addLayer(layer: ProjectLayer) {
    setProject((current) => ({
      ...current,
      layers: [...current.layers, layer],
    }));
    setSelectedLayerId(layer.id);
  }

  function addShapeLayer() {
    const layerId = `layer_shape_${Date.now()}`;
    addLayer({
      id: layerId,
      type: "shape",
      shape: "rectangle",
      name: "Color Shape",
      visible: true,
      locked: false,
      x: Math.round(docSize.width * 0.15),
      y: Math.round(docSize.height * 0.15),
      width: Math.round(docSize.width * 0.35),
      height: Math.round(docSize.height * 0.25),
      rotation: 0,
      opacity: 1,
      fill: "#14b8a6",
      fillOpacity: 1,
      stroke: "transparent",
      strokeOpacity: 1,
      strokeWidth: 0,
      dash: [],
      cornerRadius: 12,
    });
  }

  function addTextLayer() {
    const layerId = `layer_text_${Date.now()}`;
    addLayer({
      id: layerId,
      type: "text",
      name: "Text",
      visible: true,
      locked: false,
      x: Math.round(docSize.width * 0.2),
      y: Math.round(docSize.height * 0.2),
      width: Math.round(docSize.width * 0.5),
      height: 64,
      rotation: 0,
      opacity: 1,
      textTemplate: "New text",
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 36,
      fontWeight: 800,
      fill: "#111827",
      fillOpacity: 1,
      align: "left",
    });
  }

  function addQrLayer() {
    const layerId = `layer_qr_${Date.now()}`;
    addLayer({
      id: layerId,
      type: "qr",
      name: "QR Code",
      visible: true,
      locked: false,
      x: Math.round(docSize.width * 0.35),
      y: Math.round(docSize.height * 0.3),
      width: 240,
      height: 240,
      rotation: 0,
      opacity: 1,
      payloadTemplate: "{{serial}}",
      foreground: "#111827",
      background: "#ffffff",
    });
  }

  function toggleLayerVisibility(layerId: string) {
    setProject((current) => ({
      ...current,
      layers: current.layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      ),
    }));
  }

  function deleteLayer(layerId: string) {
    setProject((current) => {
      const layers = current.layers.filter((layer) => layer.id !== layerId);
      if (selectedLayerId === layerId) {
        setSelectedLayerId(layers[layers.length - 1]?.id ?? "");
      }
      return { ...current, layers };
    });
  }

  function reorderLayers(layers: ProjectLayer[]) {
    setProject((current) => ({
      ...current,
      layers,
    }));
  }

  function updateSerial(patch: Partial<QrMagicProject["data"]["serial"]>) {
    setProject((current) => ({
      ...current,
      data: {
        ...current.data,
        serial: {
          ...current.data.serial,
          ...patch,
        },
      },
    }));
  }

  function updateDocument(patch: Partial<QrMagicProject["document"]>) {
    setProject((current) => ({
      ...current,
      document: {
        ...current.document,
        ...patch,
      },
    }));
  }

  function updateExport(patch: Partial<QrMagicProject["export"]>) {
    setProject((current) => ({
      ...current,
      export: {
        ...current.export,
        ...patch,
      },
    }));
  }

  function exportPng() {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = exportStageDataUrl(stage);
    const link = document.createElement("a");
    link.download = `${currentRecord.serial}.png`;
    link.href = uri;
    link.click();
  }

  function dataUrlToBlob(dataUrl: string) {
    const [meta, data] = dataUrl.split(",");
    const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/png";
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mime });
  }

  function waitForCanvasUpdate() {
    return new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 50);
    });
  }

  function exportStageDataUrl(stage: Konva.Stage) {
    const guidesLayer = stage.findOne(".guides-layer");
    const wasVisible = guidesLayer?.visible() ?? false;
    const transformerNodes = stage.find("Transformer");
    const transformerVisibility = transformerNodes.map((node) => node.visible());

    if (!project.export.includeGuides) {
      guidesLayer?.visible(false);
    }
    transformerNodes.forEach((node) => node.visible(false));
    stage.batchDraw();
    const uri = stage.toDataURL({ pixelRatio: 2 });
    guidesLayer?.visible(wasVisible);
    transformerNodes.forEach((node, index) => node.visible(transformerVisibility[index]));
    stage.batchDraw();
    return uri;
  }

  async function exportBatchPngs() {
    const stage = stageRef.current;
    if (!stage || isExportingBatch) return;

    setIsExportingBatch(true);
    const originalRecordIndex = selectedRecordIndex;
    const zip = new JSZip();

    for (const record of records) {
      setSelectedRecordIndex(record.index);
      await waitForCanvasUpdate();
      const uri = exportStageDataUrl(stage);
      const baseName = renderTemplate(project.export.filenameTemplate, record)
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim();
      zip.file(`${baseName || record.serial}.png`, dataUrlToBlob(uri));
    }

    setSelectedRecordIndex(originalRecordIndex);
    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.download = `${project.document.name.replace(/[\\/:*?"<>|]/g, "_") || "qrmagic"}-png-set.zip`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    setIsExportingBatch(false);
  }

  function snapSelectedLayerToPage() {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, {
      x: 0,
      y: 0,
      width: docSize.width,
      height: docSize.height,
      rotation: 0,
    });
  }

  function alignSelectedLayer(
    alignment: "left" | "center-x" | "right" | "top" | "center-y" | "bottom",
  ) {
    if (!selectedLayer) return;

    const patch: Partial<ProjectLayer> = {};
    if (alignment === "left") patch.x = 0;
    if (alignment === "center-x") patch.x = (docSize.width - selectedLayer.width) / 2;
    if (alignment === "right") patch.x = docSize.width - selectedLayer.width;
    if (alignment === "top") patch.y = 0;
    if (alignment === "center-y") patch.y = (docSize.height - selectedLayer.height) / 2;
    if (alignment === "bottom") patch.y = docSize.height - selectedLayer.height;
    updateLayer(selectedLayer.id, patch);
  }

  function addImageLayer(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const layerId = `layer_image_${Date.now()}`;
      const layer: ProjectLayer = {
        id: layerId,
        type: "image",
        name: file.name.replace(/\.[^.]+$/, "") || "Image",
        visible: true,
        locked: false,
        x: 0,
        y: 0,
        width: docSize.width,
        height: docSize.height,
        rotation: 0,
        opacity: 1,
        assetId: layerId,
        src,
        fit: "stretch",
      };
      addLayer(layer);
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <ScanQrCode size={24} />
          <span>QR Magic</span>
        </div>
        <nav className="tool-strip" aria-label="Editor tools">
          <button className="tool-button selected" title="Select">
            <MousePointer2 size={17} />
          </button>
          <button
            className={`tool-button ${panelsVisible ? "" : "selected"}`}
            title={panelsVisible ? "Hide panels" : "Show panels"}
            onClick={() => setPanelsVisible((visible) => !visible)}
          >
            <PanelLeft size={17} />
          </button>
          <button className="tool-button" title="Align left" onClick={() => alignSelectedLayer("left")}>
            <AlignHorizontalJustifyStart size={17} />
          </button>
          <button
            className="tool-button"
            title="Align horizontal center"
            onClick={() => alignSelectedLayer("center-x")}
          >
            <AlignCenterHorizontal size={17} />
          </button>
          <button className="tool-button" title="Align right" onClick={() => alignSelectedLayer("right")}>
            <AlignHorizontalJustifyEnd size={17} />
          </button>
          <button className="tool-button" title="Align top" onClick={() => alignSelectedLayer("top")}>
            <AlignVerticalJustifyStart size={17} />
          </button>
          <button
            className="tool-button"
            title="Align vertical center"
            onClick={() => alignSelectedLayer("center-y")}
          >
            <AlignCenterVertical size={17} />
          </button>
          <button className="tool-button" title="Align bottom" onClick={() => alignSelectedLayer("bottom")}>
            <AlignVerticalJustifyEnd size={17} />
          </button>
          <span className="toolbar-divider" />
          <button className="tool-button" title="Export PNG set" onClick={exportBatchPngs}>
            <ArrowDownToLine size={17} />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) addImageLayer(file);
              event.target.value = "";
            }}
          />
        </nav>
        <div className="topbar-status">
          <span>{records.length.toLocaleString()} records</span>
          <strong>{currentRecord.serial}</strong>
        </div>
      </header>

      <div className={`workspace ${panelsVisible ? "" : "panels-hidden"}`}>
        {panelsVisible ? (
          <Sidebar
            project={project}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateSerial={updateSerial}
            onUpdateDocument={updateDocument}
            onAddShapeLayer={addShapeLayer}
            onAddTextLayer={addTextLayer}
            onAddQrLayer={addQrLayer}
            onAddImageLayer={() => imageInputRef.current?.click()}
            onToggleLayerVisibility={toggleLayerVisibility}
            onDeleteLayer={deleteLayer}
            onReorderLayers={reorderLayers}
          />
        ) : null}
        <EditorCanvas
          project={project}
          selectedLayerId={selectedLayerId}
          record={currentRecord}
          onSelectLayer={setSelectedLayerId}
          onUpdateLayer={updateLayer}
          registerStage={(stage) => {
            stageRef.current = stage;
          }}
        />
        {panelsVisible ? (
          <Inspector
            selectedLayer={selectedLayer}
            project={project}
            onUpdateLayer={updateLayer}
            onExportPng={exportPng}
            onExportBatch={exportBatchPngs}
            onUpdateExport={updateExport}
            isExportingBatch={isExportingBatch}
            onSnapToPage={snapSelectedLayerToPage}
          />
        ) : null}
      </div>
    </main>
  );
}
