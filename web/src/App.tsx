import { useMemo, useRef, useState } from "react";
import type Konva from "konva";
import JSZip from "jszip";
import {
  FolderOpen,
  Hand,
  MousePointer2,
  PanelLeft,
  Save,
  ScanQrCode,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { EditorCanvas } from "./components/EditorCanvas";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import {
  createDataGroup,
  documentPixelSize,
  guideSnapRect,
  initialProject,
  normalizeProject,
} from "./lib/project";
import { createDataRecords, renderTemplate } from "./lib/serial";
import type {
  DataGroup,
  EditorTool,
  GuideSnapTarget,
  ProjectLayer,
  QrMagicProject,
  QrMagicProjectFile,
} from "./types";

export function App() {
  const [project, setProject] = useState<QrMagicProject>(initialProject);
  const [selectedLayerId, setSelectedLayerId] = useState(initialProject.layers[0].id);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(0);
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [isExportingBatch, setIsExportingBatch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const stageRef = useRef<Konva.Stage | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const records = useMemo(() => createDataRecords(project.data.groups), [project.data.groups]);
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
      dataGroupId: project.data.groups[0]?.id,
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
    const group = createDataGroup("QR serial");
    const layer: ProjectLayer = {
      id: layerId,
      type: "qr",
      name: "QR Code",
      dataGroupId: group.id,
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
    };
    setProject((current) => ({
      ...current,
      data: {
        mode: "serial",
        groups: [...current.data.groups, group],
      },
      layers: [...current.layers, layer],
    }));
    setSelectedLayerId(layerId);
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

  function updateDataGroup(groupId: string, patch: Partial<DataGroup>) {
    setProject((current) => ({
      ...current,
      data: {
        ...current.data,
        groups: current.data.groups.map((group) =>
          group.id === groupId ? { ...group, ...patch } : group,
        ),
      },
    }));
  }

  function updateDataGroupSerial(groupId: string, patch: Partial<DataGroup["serial"]>) {
    setProject((current) => ({
      ...current,
      data: {
        ...current.data,
        groups: current.data.groups.map((group) =>
          group.id === groupId
            ? { ...group, serial: { ...group.serial, ...patch } }
            : group,
        ),
      },
    }));
  }

  function addDataGroup() {
    setProject((current) => ({
      ...current,
      data: {
        mode: "serial",
        groups: [...current.data.groups, createDataGroup("New serial")],
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

  function downloadBlob(blob: Blob, filename: string) {
    const link = document.createElement("a");
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
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
    const originalStageSize = stage.size();
    const originalScale = stage.scale();

    if (!project.export.includeGuides) {
      guidesLayer?.visible(false);
    }
    transformerNodes.forEach((node) => node.visible(false));
    stage.size(docSize);
    stage.scale({ x: 1, y: 1 });
    stage.batchDraw();
    const uri = stage.toDataURL({ pixelRatio: 1 });
    stage.size(originalStageSize);
    stage.scale(originalScale);
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
    downloadBlob(
      blob,
      `${project.document.name.replace(/[\\/:*?"<>|]/g, "_") || "qrmagic"}-png-set.zip`,
    );
    setIsExportingBatch(false);
  }

  function sanitizeFilename(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "qrmagic";
  }

  function saveProjectFile() {
    const projectFile: QrMagicProjectFile = {
      format: "qrmagic.project",
      savedAt: new Date().toISOString(),
      project,
    };
    downloadBlob(
      new Blob([JSON.stringify(projectFile, null, 2)], { type: "application/json" }),
      `${sanitizeFilename(project.document.name)}.qrmagic.json`,
    );
  }

  function isProject(value: unknown): value is QrMagicProject {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<QrMagicProject>;
    return (
      candidate.version === 1 &&
      Boolean(candidate.document) &&
      Array.isArray(candidate.layers) &&
      Boolean(candidate.data) &&
      Boolean(candidate.export)
    );
  }

  function projectFromFile(value: unknown) {
    if (isProject(value)) return normalizeProject(value);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<QrMagicProjectFile>;
    return candidate.format === "qrmagic.project" && isProject(candidate.project)
      ? normalizeProject(candidate.project)
      : null;
  }

  function openProjectFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const loadedProject = projectFromFile(JSON.parse(String(reader.result)));
        if (!loadedProject) {
          window.alert("That file does not look like a QR Magic project.");
          return;
        }
        setProject(loadedProject);
        setSelectedLayerId(loadedProject.layers[0]?.id ?? "");
        setSelectedRecordIndex(0);
        setZoom(1);
        setActiveTool("select");
      } catch {
        window.alert("QR Magic could not read that project file.");
      }
    };
    reader.readAsText(file);
  }

  function snapSelectedLayerToTarget(target: GuideSnapTarget) {
    if (!selectedLayer) return;
    const snapRect = guideSnapRect(project, target);
    updateLayer(selectedLayer.id, {
      x: snapRect.x,
      y: snapRect.y,
      width: snapRect.width,
      height: snapRect.height,
      rotation: 0,
    });
  }

  function updateZoom(delta: number) {
    setZoom((current) => Math.min(3, Math.max(0.25, Number((current + delta).toFixed(2)))));
  }

  function alignLayer(
    layerId: string,
    alignment: "left" | "center-x" | "right" | "top" | "center-y" | "bottom",
  ) {
    const layer = project.layers.find((currentLayer) => currentLayer.id === layerId);
    if (!layer) return;

    const patch: Partial<ProjectLayer> = {};
    if (alignment === "left") patch.x = 0;
    if (alignment === "center-x") patch.x = (docSize.width - layer.width) / 2;
    if (alignment === "right") patch.x = docSize.width - layer.width;
    if (alignment === "top") patch.y = 0;
    if (alignment === "center-y") patch.y = (docSize.height - layer.height) / 2;
    if (alignment === "bottom") patch.y = docSize.height - layer.height;
    updateLayer(layer.id, patch);
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
          <button
            className={`tool-button ${activeTool === "select" ? "selected" : ""}`}
            title="Select"
            onClick={() => setActiveTool("select")}
          >
            <MousePointer2 size={17} />
          </button>
          <button
            className={`tool-button ${activeTool === "pan" ? "selected" : ""}`}
            title="Pan canvas"
            onClick={() => setActiveTool("pan")}
          >
            <Hand size={17} />
          </button>
          <button
            className={`tool-button ${panelsVisible ? "" : "selected"}`}
            title={panelsVisible ? "Hide panels" : "Show panels"}
            onClick={() => setPanelsVisible((visible) => !visible)}
          >
            <PanelLeft size={17} />
          </button>
          <span className="toolbar-divider" />
          <button className="tool-button" title="Zoom out" onClick={() => updateZoom(-0.1)}>
            <ZoomOut size={17} />
          </button>
          <button className="zoom-indicator" title="Reset zoom" onClick={() => setZoom(1)}>
            <Search size={14} />
            <span>{Math.round(zoom * 100)}%</span>
          </button>
          <button className="tool-button" title="Zoom in" onClick={() => updateZoom(0.1)}>
            <ZoomIn size={17} />
          </button>
          <span className="toolbar-divider" />
          <button
            className="tool-button"
            title="Open project"
            onClick={() => projectInputRef.current?.click()}
          >
            <FolderOpen size={17} />
          </button>
          <button className="tool-button" title="Save project" onClick={saveProjectFile}>
            <Save size={17} />
          </button>
          <input
            ref={projectInputRef}
            type="file"
            accept=".qrmagic.json,application/json"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) openProjectFile(file);
              event.target.value = "";
            }}
          />
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
            onUpdateDataGroup={updateDataGroup}
            onUpdateDataGroupSerial={updateDataGroupSerial}
            onAddDataGroup={addDataGroup}
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
          zoom={zoom}
          activeTool={activeTool}
          onZoomDelta={updateZoom}
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
            dataGroups={project.data.groups}
            onUpdateLayer={updateLayer}
            onExportPng={exportPng}
            onExportBatch={exportBatchPngs}
            onUpdateExport={updateExport}
            isExportingBatch={isExportingBatch}
            onSnapToTarget={snapSelectedLayerToTarget}
            onAlignLayer={alignLayer}
          />
        ) : null}
      </div>
    </main>
  );
}
