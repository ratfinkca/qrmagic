import { Database, FileText, Layers, QrCode } from "lucide-react";
import type { ProjectLayer, QrMagicProject } from "../types";

type SidebarProps = {
  project: QrMagicProject;
  selectedLayerId: string;
  onSelectLayer: (layerId: string) => void;
  onUpdateSerial: (patch: Partial<QrMagicProject["data"]["serial"]>) => void;
  onUpdateDocument: (patch: Partial<QrMagicProject["document"]>) => void;
};

export function Sidebar({
  project,
  selectedLayerId,
  onSelectLayer,
  onUpdateSerial,
  onUpdateDocument,
}: SidebarProps) {
  const serial = project.data.serial;

  return (
    <aside className="sidebar">
      <section className="panel">
        <div className="panel-title">
          <FileText size={16} />
          <span>Document</span>
        </div>
        <label>
          Name
          <input
            value={project.document.name}
            onChange={(event) => onUpdateDocument({ name: event.target.value })}
          />
        </label>
        <div className="field-grid">
          <label>
            Width
            <input
              type="number"
              value={project.document.width}
              onChange={(event) => onUpdateDocument({ width: Number(event.target.value) })}
            />
          </label>
          <label>
            Height
            <input
              type="number"
              value={project.document.height}
              onChange={(event) => onUpdateDocument({ height: Number(event.target.value) })}
            />
          </label>
        </div>
        <div className="field-grid">
          <label>
            Unit
            <select
              value={project.document.unit}
              onChange={(event) =>
                onUpdateDocument({ unit: event.target.value as QrMagicProject["document"]["unit"] })
              }
            >
              <option value="in">in</option>
              <option value="mm">mm</option>
              <option value="px">px</option>
            </select>
          </label>
          <label>
            DPI
            <input
              type="number"
              value={project.document.dpi}
              onChange={(event) => onUpdateDocument({ dpi: Number(event.target.value) })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <Database size={16} />
          <span>Data</span>
        </div>
        <div className="field-grid">
          <label>
            Prefix
            <input
              value={serial.prefix}
              onChange={(event) => onUpdateSerial({ prefix: event.target.value })}
            />
          </label>
          <label>
            Padding
            <input
              type="number"
              value={serial.padding}
              onChange={(event) => onUpdateSerial({ padding: Number(event.target.value) })}
            />
          </label>
        </div>
        <div className="field-grid">
          <label>
            Start
            <input
              type="number"
              value={serial.start}
              onChange={(event) => onUpdateSerial({ start: Number(event.target.value) })}
            />
          </label>
          <label>
            Quantity
            <input
              type="number"
              value={serial.quantity}
              onChange={(event) => onUpdateSerial({ quantity: Number(event.target.value) })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <Layers size={16} />
          <span>Layers</span>
        </div>
        <div className="layer-list">
          {project.layers.map((layer: ProjectLayer) => (
            <button
              className={`layer-row ${layer.id === selectedLayerId ? "selected" : ""}`}
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
            >
              <QrCode size={15} />
              <span>{layer.name}</span>
              <small>{layer.type}</small>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
