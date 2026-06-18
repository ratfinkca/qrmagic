import { useMemo, useRef, useState } from "react";
import type Konva from "konva";
import JSZip from "jszip";
import { ArrowDownToLine, MousePointer2, PanelLeft, ScanQrCode } from "lucide-react";
import { EditorCanvas } from "./components/EditorCanvas";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import { initialProject } from "./lib/project";
import { createSerialRecords, renderTemplate } from "./lib/serial";
import type { ProjectLayer, QrMagicProject } from "./types";

export function App() {
  const [project, setProject] = useState<QrMagicProject>(initialProject);
  const [selectedLayerId, setSelectedLayerId] = useState(initialProject.layers[0].id);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(0);
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [isExportingBatch, setIsExportingBatch] = useState(false);
  const stageRef = useRef<Konva.Stage | null>(null);
  const records = useMemo(
    () => createSerialRecords(project.data.serial),
    [project.data.serial],
  );
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

  function exportPng() {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = stage.toDataURL({ pixelRatio: 2 });
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

  async function exportBatchPngs() {
    const stage = stageRef.current;
    if (!stage || isExportingBatch) return;

    setIsExportingBatch(true);
    const originalRecordIndex = selectedRecordIndex;
    const zip = new JSZip();

    for (const record of records) {
      setSelectedRecordIndex(record.index);
      await waitForCanvasUpdate();
      const uri = stage.toDataURL({ pixelRatio: 2 });
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
          <button className="tool-button" title="Export">
            <ArrowDownToLine size={17} />
          </button>
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
            isExportingBatch={isExportingBatch}
          />
        ) : null}
      </div>
    </main>
  );
}
