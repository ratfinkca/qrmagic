import { useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { ArrowDownToLine, MousePointer2, PanelLeft, ScanQrCode } from "lucide-react";
import { EditorCanvas } from "./components/EditorCanvas";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import { initialProject } from "./lib/project";
import { createSerialRecords } from "./lib/serial";
import type { ProjectLayer, QrMagicProject } from "./types";

export function App() {
  const [project, setProject] = useState<QrMagicProject>(initialProject);
  const [selectedLayerId, setSelectedLayerId] = useState(initialProject.layers[0].id);
  const stageRef = useRef<Konva.Stage | null>(null);
  const records = useMemo(
    () => createSerialRecords(project.data.serial),
    [project.data.serial],
  );
  const currentRecord = records[0];
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
          <button className="tool-button" title="Panels">
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

      <div className="workspace">
        <Sidebar
          project={project}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          onUpdateSerial={updateSerial}
          onUpdateDocument={updateDocument}
        />
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
        <Inspector
          selectedLayer={selectedLayer}
          project={project}
          onUpdateLayer={updateLayer}
          onExportPng={exportPng}
        />
      </div>
    </main>
  );
}
