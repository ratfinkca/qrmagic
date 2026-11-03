import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import JSZip from "jszip";
import {
  Focus,
  FilePlus2,
  FolderOpen,
  Hand,
  Maximize2,
  MousePointer2,
  PanelLeft,
  Redo2,
  Save,
  ScanQrCode,
  Search,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ProjectChooser } from "./components/ProjectChooser";
import { PrintLayout } from "./components/PrintLayout";
import { createPrintRecords, productionCount, productionGeometry, positiveInteger, normalizeFixedJob, jobSummary, isRepeatedJob } from "./lib/production";
import { EditorCanvas } from "./components/EditorCanvas";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import {
  createDataGroup,
  createFixedDataGroup,
  convertDataGroupMode,
  createProjectId,
  defaultLayerShadow,
  defaultShapeFill,
  defaultShapeGeometry,
  documentPixelSize,
  guideSnapRect,
  initialProject,
  normalizeProject,
} from "./lib/project";
import {
  renderGuidePngBlob,
  renderLayeredTemplatePdfBlob,
  renderProjectImageBlob,
  renderProjectPdfBlob,
  renderProjectPngBlob,
} from "./lib/exportRenderer";
import { createDataRecords, renderTemplate } from "./lib/serial";
import type {
  DataGroup,
  EditorTool,
  GuideSnapTarget,
  ProjectLayer,
  QrMagicProject,
  QrMagicProjectFile,
} from "./types";

type Alignment = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";
type AlignTarget = GuideSnapTarget | "selection";
type ProjectHistory = {
  past: QrMagicProject[];
  future: QrMagicProject[];
};
type ZoomCommand = {
  id: number;
  mode: "fit" | "selection";
};
type ProjectUpdateOptions = {
  recordHistory?: boolean;
};
type ExportSetFormat = "png" | "jpg" | "pdf" | "production-pdf";

const MAX_HISTORY_STEPS = 80;
const EXPORT_SET_FORMATS: ExportSetFormat[] = ["png", "jpg", "pdf", "production-pdf"];

function getExportSetFormat(project: QrMagicProject): ExportSetFormat {
  const [format] = project.export.formats;
  return EXPORT_SET_FORMATS.includes(format as ExportSetFormat)
    ? (format as ExportSetFormat)
    : "png";
}
const MAX_RECENT_COLORS = 14;

function normalizeHexColor(color: string) {
  const normalized = color.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null;
}

export function App() {
  const [layoutOpen,setLayoutOpen]=useState(false);
  const [chooserOpen, setChooserOpen] = useState(true);
  const [project, setProject] = useState<QrMagicProject>(initialProject);
  const [projectHistory, setProjectHistory] = useState<ProjectHistory>({ past: [], future: [] });
  const [selectedLayerIds, setSelectedLayerIds] = useState([initialProject.layers[0].id]);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(0);
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [compactPanel, setCompactPanel] = useState<"document" | "inspector" | null>(null);
  const [exportStatus, setExportStatus] = useState<"template" | "set" | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [zoomCommand, setZoomCommand] = useState<ZoomCommand | null>(null);
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const stageRef = useRef<Konva.Stage | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const pendingProjectHistoryRef = useRef<QrMagicProject | null>(null);
  const projectRef = useRef(project);
  const lastSavedProjectRef = useRef<QrMagicProject | null>(initialProject);
  const exportLockedRef = useRef(false);
  const records = useMemo(() => createDataRecords(project.data.groups), [project.data.groups]);
  const docSize = useMemo(() => documentPixelSize(project), [project]);
  const currentRecord = records[Math.min(selectedRecordIndex, records.length - 1)] ?? records[0];
  const primarySelectedLayerId = selectedLayerIds[selectedLayerIds.length - 1] ?? "";
  const selectedLayer =
    selectedLayerIds.length === 1
      ? project.layers.find((layer) => layer.id === primarySelectedLayerId)
      : undefined;
  const selectedLayers = project.layers.filter((layer) => selectedLayerIds.includes(layer.id));
  const canUndo = projectHistory.past.length > 0;
  const canRedo = projectHistory.future.length > 0;
  const isExportLocked = exportStatus !== null;
  const exportSetFormat = getExportSetFormat(project);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    exportLockedRef.current = isExportLocked;
  }, [isExportLocked]);

  const updateProject = useCallback(
    (
      updater: QrMagicProject | ((current: QrMagicProject) => QrMagicProject),
      options: ProjectUpdateOptions = {},
    ) => {
      if (exportLockedRef.current) return;

      setProject((current) => {
        const proposed = typeof updater === "function" ? updater(current) : updater;
        let nextProject: QrMagicProject;
        try {
          nextProject = normalizeFixedJob(proposed);
          productionCount(nextProject);
          productionGeometry(nextProject);
        } catch { return current; }
        if (nextProject === current) return current;

        if (options.recordHistory !== false) {
          setProjectHistory((history) => ({
            past: [...history.past, current].slice(-MAX_HISTORY_STEPS),
            future: [],
          }));
        }
        return nextProject;
      });
    },
    [],
  );

  const resetProject = useCallback((nextProject: QrMagicProject) => {
    setProject(nextProject);
    setProjectHistory({ past: [], future: [] });
    projectRef.current = nextProject;
    lastSavedProjectRef.current = nextProject;
    pendingProjectHistoryRef.current = null;
  }, []);

  useEffect(() => {
    // Also normalize an in-progress project retained by the local dev server.
    updateProject(current => current, { recordHistory: false });
  }, [updateProject]);

  const undoProjectChange = useCallback(() => {
    setProjectHistory((history) => {
      const previousProject = history.past.at(-1);
      if (!previousProject) return history;

      setProject(normalizeFixedJob(previousProject));
      return {
        past: history.past.slice(0, -1),
        future: [project, ...history.future].slice(0, MAX_HISTORY_STEPS),
      };
    });
  }, [project]);

  const redoProjectChange = useCallback(() => {
    setProjectHistory((history) => {
      const nextProject = history.future[0];
      if (!nextProject) return history;

      setProject(normalizeFixedJob(nextProject));
      return {
        past: [...history.past, project].slice(-MAX_HISTORY_STEPS),
        future: history.future.slice(1),
      };
    });
  }, [project]);

  const beginProjectChangeTransaction = useCallback(() => {
    pendingProjectHistoryRef.current ??= projectRef.current;
  }, []);

  const commitProjectChangeTransaction = useCallback(() => {
    const historySnapshot = pendingProjectHistoryRef.current;
    const currentProject = projectRef.current;
    pendingProjectHistoryRef.current = null;
    if (!historySnapshot || historySnapshot === currentProject) return;

    setProjectHistory((history) => ({
      past: [...history.past, historySnapshot].slice(-MAX_HISTORY_STEPS),
      future: [],
    }));
  }, []);

  useEffect(() => {
    setSelectedLayerIds((currentSelection) => {
      const layerIds = new Set(project.layers.map((layer) => layer.id));
      const validSelection = currentSelection.filter((layerId) => layerIds.has(layerId));
      if (validSelection.length) return validSelection;
      return [project.layers[project.layers.length - 1]?.id ?? ""].filter(Boolean);
    });
  }, [project.layers]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if(layoutOpen) return;
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isEditableTarget || (!event.ctrlKey && !event.metaKey)) return;
      if (exportLockedRef.current) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoProjectChange();
      }
      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redoProjectChange();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redoProjectChange, undoProjectChange, layoutOpen]);

  function updateLayer(
    layerId: string,
    patch: Partial<ProjectLayer>,
    options?: ProjectUpdateOptions,
  ) {
    updateProject((current) => ({
      ...current,
      layers: current.layers.map((layer) =>
        layer.id === layerId ? ({ ...layer, ...patch } as ProjectLayer) : layer,
      ),
    }), options);
  }

  function addLayer(layer: ProjectLayer) {
    updateProject((current) => ({
      ...current,
      layers: [...current.layers, layer],
    }));
    setSelectedLayerIds([layer.id]);
  }

  function uniqueName(baseName: string, existingNames: string[]) {
    if (!existingNames.includes(baseName)) return baseName;

    let suffix = 2;
    while (existingNames.includes(`${baseName} ${suffix}`)) {
      suffix += 1;
    }
    return `${baseName} ${suffix}`;
  }

  function addShapeLayer() {
    const layerId = createProjectId("layer_shape");
    addLayer({
      id: layerId,
      type: "shape",
      name: "Color Shape",
      visible: true,
      locked: false,
      x: Math.round(docSize.width * 0.15),
      y: Math.round(docSize.height * 0.15),
      width: Math.round(docSize.width * 0.35),
      height: Math.round(docSize.height * 0.25),
      rotation: 0,
      opacity: 1,
      ...defaultLayerShadow,
      fill: "#14b8a6",
      ...defaultShapeFill,
      fillOpacity: 1,
      stroke: "transparent",
      strokeOpacity: 1,
      strokeWidth: 0,
      dash: [],
      ...defaultShapeGeometry,
      shape: "rectangle",
      cornerRadius: 12,
    });
  }

  function addTextLayer() {
    const layerId = createProjectId("layer_text");
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
      ...defaultLayerShadow,
      textTemplate: "New text",
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 36,
      fontWeight: 800,
      fill: "#111827",
      fillOpacity: 1,
      align: "left",
    });
  }

  function addQrLayer(mode: DataGroup["mode"] = "fixed", includeLabel = false) {
    const qrLayerId = createProjectId("layer_qr");
    const serialLayerId = createProjectId("layer_text");
    updateProject((current) => {
      const group = (mode === "serial" ? createDataGroup : createFixedDataGroup)(
        uniqueName(
          mode === "serial" ? "QR serial" : "QR content",
          current.data.groups.map((groupItem) => groupItem.name),
        ),
      );
      const count = productionCount(current);
      const wasRepeated = isRepeatedJob(current);
      if (group.mode === "fixed") group.fixed.quantity = 1;
      if (group.mode === "serial") group.serial.quantity = wasRepeated ? count.total : count.records;
      const layerNames = current.layers.map((layer) => layer.name);
      const qrX = Math.round(docSize.width * 0.35);
      const qrY = Math.round(docSize.height * 0.3);
      const qrSize = 240;
      const serialWidth = Math.max(260, Math.round(qrSize * 1.5));
      const qrLayer: ProjectLayer = {
        id: qrLayerId,
        type: "qr",
        name: uniqueName("QR Code", layerNames),
        dataGroupId: group.id,
        visible: true,
        locked: false,
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
        rotation: 0,
        opacity: 1,
        ...defaultLayerShadow,
        payloadTemplate: "{{serial}}",
        foreground: "#111827",
        background: "#ffffff",
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
      const serialLayer: ProjectLayer = {
        id: serialLayerId,
        type: "text",
        name: uniqueName("Serial", [...layerNames, qrLayer.name]),
        dataGroupId: group.id,
        visible: true,
        locked: false,
        x: Math.round(qrX + qrSize / 2 - serialWidth / 2),
        y: qrY + qrSize + 24,
        width: serialWidth,
        height: 52,
        rotation: 0,
        opacity: 1,
        ...defaultLayerShadow,
        textTemplate: "{{serial}}",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 34,
        fontWeight: 800,
        fill: "#111827",
        fillOpacity: 1,
        align: "center",
      };

      return {
        ...current,
        production: wasRepeated && mode === "serial" ? { copiesPerRecord: 1 } : current.production,
        data: {
          mode: "serial",
          groups: [...current.data.groups, group],
        },
        layers: [...current.layers, qrLayer, ...(includeLabel ? [serialLayer] : [])],
      };
    });
    setSelectedLayerIds([qrLayerId]);
  }

  function toggleLayerVisibility(layerId: string) {
    updateProject((current) => ({
      ...current,
      layers: current.layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      ),
    }));
  }

  function deleteLayer(layerId: string) {
    updateProject((current) => {
      const layers = current.layers.filter((layer) => layer.id !== layerId);
      if (selectedLayerIds.includes(layerId)) {
        setSelectedLayerIds((currentSelection) => {
          const remainingSelection = currentSelection.filter((selectedId) => selectedId !== layerId);
          return remainingSelection.length ? remainingSelection : [layers[layers.length - 1]?.id ?? ""].filter(Boolean);
        });
      }
      return { ...current, layers };
    });
  }

  function reorderLayers(layers: ProjectLayer[]) {
    updateProject((current) => ({
      ...current,
      layers,
    }));
  }

  function updateDataGroup(groupId: string, patch: { name?: string }) {
    updateProject((current) => ({
      ...current,
      data: {
        ...current.data,
        groups: current.data.groups.map((group) =>
          group.id === groupId ? { ...group, ...patch } : group,
        ),
      },
    }));
  }

  function updateDataGroupSerial(
    groupId: string,
    patch: { prefix?: string; suffix?: string; start?: number; quantity?: number; step?: number; padding?: number },
  ) {
    updateProject((current) => ({
      ...current,
      data: {
        ...current.data,
        groups: current.data.groups.map((group) =>
          group.id === groupId && group.mode === "serial"
            ? { ...group, serial: { ...group.serial, ...patch } }
            : group,
        ),
      },
    }));
  }

  function updateDataGroupFixed(groupId: string, patch: { value?: string; quantity?: number }) {
    updateProject((current) => ({
      ...current,
      data: {
        ...current.data,
        groups: current.data.groups.map((group) =>
          group.id === groupId && group.mode === "fixed"
            ? { ...group, fixed: { ...group.fixed, ...patch } }
            : group,
        ),
      },
    }));
  }

  function updateDataGroupMode(groupId: string, mode: DataGroup["mode"]) {
    updateProject(current => {
      const count = productionCount(current);
      const wasRepeated = isRepeatedJob(current);
      const quantity = wasRepeated ? count.total : count.records;
      return { ...current,
        production: wasRepeated && mode === "serial" ? { copiesPerRecord: 1 } : current.production,
        data: { ...current.data, groups: current.data.groups.map(group => group.id === groupId
          ? convertDataGroupMode(group, mode, quantity) : group) },
      };
    });
  }

  function changeQrContentMode(layerId: string, mode: DataGroup["mode"]) {
    updateProject(current => {
      const layer = current.layers.find(item => item.id === layerId);
      if (layer?.type !== "qr") return current;
      const count = productionCount(current);
      const wasRepeated = isRepeatedJob(current);
      const quantity = wasRepeated ? count.total : count.records;
      const existing = current.data.groups.find(group => group.id === layer.dataGroupId);
      const base = existing ?? createFixedDataGroup("QR content");
      const source = convertDataGroupMode(base, mode, quantity);
      return { ...current,
        production: wasRepeated && mode === "serial" ? { copiesPerRecord: 1 } : current.production,
        data: { ...current.data, groups: existing
          ? current.data.groups.map(group => group.id === source.id ? source : group)
          : [...current.data.groups, source] },
        layers: current.layers.map(item => item.id === layerId
          ? { ...layer, dataGroupId: source.id, payloadTemplate: "{{serial}}" } : item),
      };
    });
  }

  function makeQrIndependent(layerId: string) {
    updateProject(current => {
      const layer = current.layers.find(item => item.id === layerId);
      if (layer?.type !== "qr") return current;
      const group = current.data.groups.find(source => source.id === layer.dataGroupId);
      if (!group) return current;
      const source = { ...structuredClone(group), id: createProjectId("group"), name: `${group.name} (independent)` };
      return { ...current, data: { ...current.data, groups: [...current.data.groups, source] },
        layers: current.layers.map(item => item.id === layerId ? { ...layer, dataGroupId: source.id } : item) };
    });
  }

  function updateDocument(
    patch: Partial<QrMagicProject["document"]>,
    options?: ProjectUpdateOptions,
  ) {
    if (patch.unit && patch.unit !== project.document.unit) {
      const mmPerUnit = (unit: QrMagicProject["document"]["unit"]) =>
        unit === "mm" ? 1 : unit === "in" ? 25.4 : 25.4 / project.document.dpi;
      const factor = mmPerUnit(project.document.unit) / mmPerUnit(patch.unit);
      patch = { ...patch, width: project.document.width * factor, height: project.document.height * factor };
    }
    const next = { ...project.document, ...patch };
    if (![next.width, next.height, next.dpi].every(value => Number.isFinite(value) && value > 0)) return;
    if (![next.bleedMm, next.safeAreaMm].every(value => Number.isFinite(value) && value >= 0 && value <= 25)) return;
    if (next.dpi > 1200) return;
    updateProject((current) => ({
      ...current,
      document: {
        ...current.document,
        ...patch,
      },
    }), options);
  }

  function updateExport(patch: Partial<QrMagicProject["export"]>) {
    updateProject((current) => ({
      ...current,
      export: {
        ...current.export,
        ...patch,
      },
    }));
  }

  function rememberColor(color: string) {
    const normalized = normalizeHexColor(color);
    if (!normalized) return;

    updateProject((current) => ({
      ...current,
      colors: {
        ...current.colors,
        recent: [
          normalized,
          ...current.colors.recent.filter((existingColor) => existingColor !== normalized),
        ].slice(0, MAX_RECENT_COLORS),
      },
    }), { recordHistory: false });
  }

  function savePaletteColor(color: string) {
    const normalized = normalizeHexColor(color);
    if (!normalized) return;

    updateProject((current) => {
      if (current.colors.palette.includes(normalized)) return current;
      return {
        ...current,
        colors: {
          ...current.colors,
          palette: [...current.colors.palette, normalized],
        },
      };
    });
  }

  function removePaletteColor(color: string) {
    const normalized = normalizeHexColor(color);
    if (!normalized) return;

    updateProject((current) => ({
      ...current,
      colors: {
        ...current.colors,
        palette: current.colors.palette.filter((existingColor) => existingColor !== normalized),
      },
    }));
  }

  function downloadBlob(blob: Blob, filename: string) {
    const link = document.createElement("a");
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function sanitizeFilename(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "qrmagic";
  }

  async function exportPngTemplate() {
    if (exportLockedRef.current) return;

    const projectSnapshot = projectRef.current;
    const record = currentRecord;
    const baseName = sanitizeFilename(record.serial);
    const zip = new JSZip();
    exportLockedRef.current = true;
    setExportStatus("template");

    try {
      const [artworkBlob, previewBlob, bleedBlob, trimBlob, safeAreaBlob, layeredPdfBlob] = await Promise.all([
        renderProjectPngBlob(projectSnapshot, record, { includeGuides: false }),
        renderProjectPngBlob(projectSnapshot, record, { includeGuides: true }),
        renderGuidePngBlob(projectSnapshot, "bleed"),
        renderGuidePngBlob(projectSnapshot, "trim"),
        renderGuidePngBlob(projectSnapshot, "safeArea"),
        renderLayeredTemplatePdfBlob(projectSnapshot, record),
      ]);
      zip.file(`${baseName}-artwork.png`, artworkBlob);
      zip.file(`${baseName}-template-preview.png`, previewBlob);
      zip.file(`${baseName}-guide-bleed.png`, bleedBlob);
      zip.file(`${baseName}-guide-trim.png`, trimBlob);
      zip.file(`${baseName}-guide-safe-area.png`, safeAreaBlob);
      zip.file(`${baseName}-template-layered.pdf`, layeredPdfBlob);
      zip.file(
        "README.txt",
        [
          "QR Magic template export",
          "",
          "Import the PNG files into GIMP as layers.",
          "Use artwork as the bottom layer, then place guide overlays above it.",
          "The template-preview file is a flattened reference image with guides visible.",
          "The layered PDF uses optional content groups for apps that expose PDF layers.",
        ].join("\n"),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${baseName}-template.zip`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "QR Magic could not export the template.");
    } finally {
      exportLockedRef.current = false;
      setExportStatus(null);
    }
  }

  async function exportBatchPngs() {
    if (exportLockedRef.current) return;

    const projectSnapshot = projectRef.current;
    const recordSnapshot = createPrintRecords(projectSnapshot);
    const format = getExportSetFormat(projectSnapshot);
    const zip = new JSZip();
    const usedFilenames = new Set<string>();
    exportLockedRef.current = true;
    setExportStatus("set");

    try {
      if (format === "production-pdf") {
        const { productionPackage } = await import("./lib/productionPackage");
        const blob = await productionPackage(projectSnapshot, recordSnapshot);
        downloadBlob(blob, `${sanitizeFilename(projectSnapshot.document.name)}-production.zip`);
        return;
      }
      if (format === "pdf") {
        const blob = await renderProjectPdfBlob(projectSnapshot, recordSnapshot, {
          includeGuides: projectSnapshot.export.includeGuides,
        });
        downloadBlob(blob, `${sanitizeFilename(projectSnapshot.document.name)}-pdf-set.pdf`);
        return;
      }

      let previousRecord: typeof currentRecord | undefined;
      let recordBlob: Blob | undefined;
      for (const record of recordSnapshot) {
        if (record !== previousRecord || !recordBlob) {
          recordBlob = await renderProjectImageBlob(projectSnapshot, record, {
            includeGuides: projectSnapshot.export.includeGuides,
            format,
          });
          previousRecord = record;
        }
        const requestedBaseName = sanitizeFilename(
          renderTemplate(projectSnapshot.export.filenameTemplate, record),
        );
        let baseName = requestedBaseName;
        let duplicateIndex = 2;
        while (usedFilenames.has(`${baseName}.${format}`)) {
          baseName = `${requestedBaseName}-${duplicateIndex}`;
          duplicateIndex += 1;
        }
        usedFilenames.add(`${baseName}.${format}`);
        zip.file(`${baseName}.${format}`, recordBlob);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(
        blob,
        `${sanitizeFilename(projectSnapshot.document.name)}-${format}-set.zip`,
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "QR Magic could not export the set.");
    } finally {
      exportLockedRef.current = false;
      setExportStatus(null);
    }
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
    lastSavedProjectRef.current = project;
  }

  function canReplaceProject() {
    return projectRef.current === lastSavedProjectRef.current || window.confirm(
      "Replace the current design? Save a project file first to keep your changes.",
    );
  }

  function isProject(value: unknown): value is QrMagicProject {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<QrMagicProject>;
    return (
      (candidate.version === 1 || candidate.version === 2) &&
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
        if (!canReplaceProject()) return;
        resetProject(loadedProject);
        setChooserOpen(false);
        setSelectedLayerIds([loadedProject.layers[0]?.id ?? ""].filter(Boolean));
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

  function setActualZoom(nextScale: number) {
    const safeFitScale = fitScale > 0 ? fitScale : 1;
    setZoom(Math.min(8, Math.max(0.25, Number((nextScale / safeFitScale).toFixed(3)))));
  }

  function requestZoomCommand(mode: ZoomCommand["mode"]) {
    setZoomCommand((current) => ({ id: (current?.id ?? 0) + 1, mode }));
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

  function alignSelectedLayers(alignment: Alignment, target: AlignTarget) {
    const layers = project.layers.filter((layer) => selectedLayerIds.includes(layer.id));
    if (!layers.length) return;
    const selectedBounds = selectionBounds(layers);
    const targetRect = target === "selection" ? selectedBounds : guideSnapRect(project, target);
    const layerIds = new Set(layers.map((layer) => layer.id));
    const isVerticalSelectionAlignment =
      target === "selection" &&
      layers.length > 1 &&
      (alignment === "top" || alignment === "center-y" || alignment === "bottom");

    if (target !== "selection" && layers.length > 1) {
      const targetCenterX = targetRect.x + targetRect.width / 2;
      const targetCenterY = targetRect.y + targetRect.height / 2;
      const selectionCenterX = selectedBounds.x + selectedBounds.width / 2;
      const selectionCenterY = selectedBounds.y + selectedBounds.height / 2;
      let deltaX = 0;
      let deltaY = 0;

      if (alignment === "left") deltaX = targetRect.x - selectedBounds.x;
      if (alignment === "center-x") deltaX = targetCenterX - selectionCenterX;
      if (alignment === "right") {
        deltaX = targetRect.x + targetRect.width - (selectedBounds.x + selectedBounds.width);
      }
      if (alignment === "top") deltaY = targetRect.y - selectedBounds.y;
      if (alignment === "center-y") deltaY = targetCenterY - selectionCenterY;
      if (alignment === "bottom") {
        deltaY = targetRect.y + targetRect.height - (selectedBounds.y + selectedBounds.height);
      }

      updateProject((current) => ({
        ...current,
        layers: current.layers.map((layer) =>
          layerIds.has(layer.id)
            ? ({ ...layer, x: layer.x + deltaX, y: layer.y + deltaY } as ProjectLayer)
            : layer,
        ),
      }));
      return;
    }

    if (isVerticalSelectionAlignment) {
      const sortedLayers = [...layers].sort((firstLayer, secondLayer) => {
        if (firstLayer.y !== secondLayer.y) return firstLayer.y - secondLayer.y;
        return firstLayer.x - secondLayer.x;
      });
      const totalHeight = sortedLayers.reduce((sum, layer) => sum + layer.height, 0);
      let nextY = targetRect.y;

      if (alignment === "center-y") {
        nextY = targetRect.y + (targetRect.height - totalHeight) / 2;
      }

      if (alignment === "bottom") {
        nextY = targetRect.y + targetRect.height - totalHeight;
      }

      const yByLayerId = new Map<string, number>();
      sortedLayers.forEach((layer) => {
        yByLayerId.set(layer.id, nextY);
        nextY += layer.height;
      });

      updateProject((current) => ({
        ...current,
        layers: current.layers.map((layer) =>
          layerIds.has(layer.id)
            ? ({ ...layer, y: yByLayerId.get(layer.id) ?? layer.y } as ProjectLayer)
            : layer,
        ),
      }));
      return;
    }

    updateProject((current) => ({
      ...current,
      layers: current.layers.map((layer) => {
        if (!layerIds.has(layer.id)) return layer;
        const patch: Partial<ProjectLayer> = {};
        if (alignment === "left") patch.x = targetRect.x;
        if (alignment === "center-x") {
          patch.x = targetRect.x + (targetRect.width - layer.width) / 2;
        }
        if (alignment === "right") patch.x = targetRect.x + targetRect.width - layer.width;
        if (alignment === "top") patch.y = targetRect.y;
        if (alignment === "center-y") {
          patch.y = targetRect.y + (targetRect.height - layer.height) / 2;
        }
        if (alignment === "bottom") patch.y = targetRect.y + targetRect.height - layer.height;
        return { ...layer, ...patch } as ProjectLayer;
      }),
    }));
  }

  function updateSelectedGroupBounds(
    patch: Partial<Pick<ProjectLayer, "x" | "y" | "width" | "height">>,
  ) {
    const selectedIds = new Set(selectedLayerIds);
    updateProject((current) => {
      const layers = current.layers.filter((layer) => selectedIds.has(layer.id));
      if (!layers.length) return current;

      const bounds = selectionBounds(layers);
      const nextBounds = {
        x: patch.x ?? bounds.x,
        y: patch.y ?? bounds.y,
        width: patch.width ?? bounds.width,
        height: patch.height ?? bounds.height,
      };
      const scaleX = bounds.width > 0 ? nextBounds.width / bounds.width : 1;
      const scaleY = bounds.height > 0 ? nextBounds.height / bounds.height : 1;

      return {
        ...current,
        layers: current.layers.map((layer) => {
          if (!selectedIds.has(layer.id)) return layer;
          return {
            ...layer,
            x: nextBounds.x + (layer.x - bounds.x) * scaleX,
            y: nextBounds.y + (layer.y - bounds.y) * scaleY,
            width: layer.width * scaleX,
            height: layer.height * scaleY,
          } as ProjectLayer;
        }),
      };
    });
  }

  function updateSelectedLayers(
    patch: Partial<Pick<ProjectLayer, "opacity">>,
    options?: ProjectUpdateOptions,
  ) {
    const selectedIds = new Set(selectedLayerIds);
    updateProject((current) => ({
      ...current,
      layers: current.layers.map((layer) =>
        selectedIds.has(layer.id) ? ({ ...layer, ...patch } as ProjectLayer) : layer,
      ),
    }), options);
  }

  function addImageLayer(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const layerId = createProjectId("layer_image");
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
        ...defaultLayerShadow,
        assetId: layerId,
        src,
        fit: "stretch",
      };
      addLayer(layer);
    };
    reader.readAsDataURL(file);
  }

  if(layoutOpen) return <PrintLayout project={project} onBack={()=>setLayoutOpen(false)} onSave={saveProjectFile}
    onChange={layout=>updateProject(current=>({...current,production:{...current.production,layout}}))}/>;

  return (
    <main className="app-shell">
      {chooserOpen ? <ProjectChooser onClose={() => setChooserOpen(false)}
        onOpen={() => projectInputRef.current?.click()}
        onCreate={next => {
          if (!canReplaceProject()) return;
          resetProject(next);
          lastSavedProjectRef.current = null;
          projectRef.current = next;
          pendingProjectHistoryRef.current = null;
          setSelectedLayerIds([next.layers.find(layer => layer.type === "qr")?.id ?? next.layers[0]?.id ?? ""].filter(Boolean));
          setSelectedRecordIndex(0); setZoom(1); setActiveTool("select"); setChooserOpen(false);
        }} /> : null}
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
            disabled={isExportLocked}
          >
            <MousePointer2 size={17} />
          </button>
          <button
            className={`tool-button ${activeTool === "pan" ? "selected" : ""}`}
            title="Pan canvas"
            onClick={() => setActiveTool("pan")}
            disabled={isExportLocked}
          >
            <Hand size={17} />
          </button>
          <button
            className={`tool-button ${panelsVisible ? "" : "selected"}`}
            title={panelsVisible ? "Hide panels" : "Show panels"}
            onClick={() => setPanelsVisible((visible) => !visible)}
            disabled={isExportLocked}
          >
            <PanelLeft size={17} />
          </button>
          <span className="toolbar-divider" />
          <button className="tool-button" title="Undo" onClick={undoProjectChange} disabled={!canUndo || isExportLocked}>
            <Undo2 size={17} />
          </button>
          <button className="tool-button" title="Redo" onClick={redoProjectChange} disabled={!canRedo || isExportLocked}>
            <Redo2 size={17} />
          </button>
          <span className="toolbar-divider" />
          <button className="tool-button" title="Zoom out" onClick={() => updateZoom(-0.1)} disabled={isExportLocked}>
            <ZoomOut size={17} />
          </button>
          <button className="zoom-indicator" title="Actual size" onClick={() => setActualZoom(1)} disabled={isExportLocked}>
            <Search size={14} />
            <span>{Math.round(fitScale * zoom * 100)}%</span>
          </button>
          <button className="tool-button" title="Zoom in" onClick={() => updateZoom(0.1)} disabled={isExportLocked}>
            <ZoomIn size={17} />
          </button>
          <button className="tool-button" title="Fit page" onClick={() => requestZoomCommand("fit")} disabled={isExportLocked}>
            <Maximize2 size={17} />
          </button>
          <button
            className="tool-button"
            title="Zoom to selection"
            onClick={() => requestZoomCommand("selection")}
            disabled={!selectedLayerIds.length || isExportLocked}
          >
            <Focus size={17} />
          </button>
          <span className="toolbar-divider" />
          <button className="tool-button" title="New project" aria-label="New project" disabled={isExportLocked} onClick={() => setChooserOpen(true)}><FilePlus2 size={17} /></button>
          <button
            className="tool-button"
            title="Open project"
            onClick={() => projectInputRef.current?.click()}
            disabled={isExportLocked}
          >
            <FolderOpen size={17} />
          </button>
          <button className="tool-button" title="Save project" onClick={saveProjectFile} disabled={isExportLocked}>
            <Save size={17} />
          </button>
          <button className="compact-panel-button" aria-pressed={compactPanel === "document"} onClick={() => { setPanelsVisible(true); setCompactPanel(current => current === "document" ? null : "document"); }}>Document & job</button>
          <button className="compact-panel-button" aria-pressed={compactPanel === "inspector"} onClick={() => { setPanelsVisible(true); setCompactPanel(current => current === "inspector" ? null : "inspector"); }}>Inspector</button>
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
          <span aria-live="polite">{jobSummary(project)}</span>
          <strong>{currentRecord.serial}</strong>
        </div>
      </header>

      <div
        className={`workspace ${compactPanel ? `compact-${compactPanel}` : ""} ${panelsVisible ? "" : "panels-hidden"} ${
          isExportLocked ? "export-locked" : ""
        }`}
        aria-busy={isExportLocked}
      >
        {panelsVisible ? (
          <Sidebar
            project={project}
            selectedLayerIds={selectedLayerIds}
            onSelectLayers={(layerIds) => setSelectedLayerIds(layerIds)}
            onUpdateDataGroup={updateDataGroup}
            onUpdateDataGroupSerial={updateDataGroupSerial}
            onUpdateDataGroupFixed={updateDataGroupFixed}
            onUpdateDataGroupMode={updateDataGroupMode}
            onUpdateDocument={updateDocument}
            onUpdateProduction={(copies) => {
              try {
                positiveInteger(copies, "Copies per record");
                if (copies * records.length > 100000) return;
                updateProject(current => ({ ...current, production: { ...current.production, copiesPerRecord: copies } }));
              } catch { /* Keep the last valid quantity while editing. */ }
            }}
            onBeginProjectChange={beginProjectChangeTransaction}
            onCommitProjectChange={commitProjectChangeTransaction}
            onUseColor={rememberColor}
            onSaveColor={savePaletteColor}
            onRemoveColor={removePaletteColor}
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
          selectedLayerIds={selectedLayerIds}
          record={currentRecord}
          zoom={zoom}
          zoomCommand={zoomCommand}
          activeTool={activeTool}
          onZoomDelta={updateZoom}
          onZoomChange={setZoom}
          onFitScaleChange={setFitScale}
          onSelectLayers={setSelectedLayerIds}
          onUpdateLayer={updateLayer}
          registerStage={(stage) => {
            stageRef.current = stage;
          }}
        />
        {panelsVisible ? (
          <Inspector
            selectedLayer={selectedLayer}
            selectedLayers={selectedLayers}
            selectedLayerCount={selectedLayerIds.length}
            project={project}
            dataGroups={project.data.groups}
            onChangeQrMode={changeQrContentMode}
            onChangeFixed={updateDataGroupFixed}
            onMakeQrIndependent={makeQrIndependent}
            onUpdateLayer={updateLayer}
            onExportPng={exportPngTemplate}
            onUseColor={rememberColor}
            onSaveColor={savePaletteColor}
            onRemoveColor={removePaletteColor}
            onExportBatch={exportBatchPngs}
            onPrintLayout={()=>setLayoutOpen(true)}
            onUpdateExport={updateExport}
            exportStatus={exportStatus}
            exportSetFormat={exportSetFormat}
            onSnapToTarget={snapSelectedLayerToTarget}
            onAlignSelection={alignSelectedLayers}
            onUpdateSelectionBounds={updateSelectedGroupBounds}
            onUpdateSelectedLayers={updateSelectedLayers}
            onBeginProjectChange={beginProjectChangeTransaction}
            onCommitProjectChange={commitProjectChangeTransaction}
          />
        ) : null}
        {isExportLocked ? (
          <div className="export-lock-overlay" role="status" aria-live="polite">
            {exportStatus === "set"
              ? exportSetFormat === "production-pdf" ? "Preparing production package..." : `Exporting ${exportSetFormat.toUpperCase()} set...`
              : "Exporting template..."}
          </div>
        ) : null}
      </div>
    </main>
  );
}
