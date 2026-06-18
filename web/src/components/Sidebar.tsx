import { useState } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Box,
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  FileText,
  ImagePlus,
  Layers,
  QrCode,
  Type,
} from "lucide-react";
import type { ProjectLayer, QrMagicProject } from "../types";

type SidebarProps = {
  project: QrMagicProject;
  selectedLayerId: string;
  onSelectLayer: (layerId: string) => void;
  onUpdateSerial: (patch: Partial<QrMagicProject["data"]["serial"]>) => void;
  onUpdateDocument: (patch: Partial<QrMagicProject["document"]>) => void;
  onAddShapeLayer: () => void;
  onAddTextLayer: () => void;
  onAddQrLayer: () => void;
  onAddImageLayer: () => void;
  onMoveLayer: (
    layerId: string,
    direction: "front" | "forward" | "backward" | "back",
  ) => void;
  onToggleLayerVisibility: (layerId: string) => void;
};

type OpenPanel = "document" | "guides" | "data" | "layers";

export function Sidebar({
  project,
  selectedLayerId,
  onSelectLayer,
  onUpdateSerial,
  onUpdateDocument,
  onAddShapeLayer,
  onAddTextLayer,
  onAddQrLayer,
  onAddImageLayer,
  onMoveLayer,
  onToggleLayerVisibility,
}: SidebarProps) {
  const serial = project.data.serial;
  const [openPanels, setOpenPanels] = useState<Record<OpenPanel, boolean>>({
    document: true,
    guides: true,
    data: true,
    layers: true,
  });
  const layersTopFirst = [...project.layers].reverse();

  function togglePanel(panel: OpenPanel) {
    setOpenPanels((current) => ({
      ...current,
      [panel]: !current[panel],
    }));
  }

  function handleAddLayer(value: string) {
    if (value === "shape") onAddShapeLayer();
    if (value === "text") onAddTextLayer();
    if (value === "qr") onAddQrLayer();
    if (value === "image") onAddImageLayer();
  }

  return (
    <aside className="sidebar">
      <section className="panel">
        <button className="panel-heading" onClick={() => togglePanel("document")}>
          <span className="panel-title">
            <FileText size={16} />
            <span>Document</span>
          </span>
          {openPanels.document ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {openPanels.document ? (
          <>
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
                    onUpdateDocument({
                      unit: event.target.value as QrMagicProject["document"]["unit"],
                    })
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
            <label>
              Page color
              <div className="color-row">
                <input
                  type="color"
                  value={project.document.backgroundColor}
                  disabled={project.document.transparentBackground}
                  onChange={(event) => onUpdateDocument({ backgroundColor: event.target.value })}
                />
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={project.document.transparentBackground}
                    onChange={(event) =>
                      onUpdateDocument({ transparentBackground: event.target.checked })
                    }
                  />
                  Transparent
                </label>
              </div>
            </label>
            <div className="guide-controls">
              <button className="subpanel-heading" onClick={() => togglePanel("guides")}>
                <span>Guides</span>
                {openPanels.guides ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              {openPanels.guides ? (
                <>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={project.document.guides.enabled}
                      onChange={(event) =>
                        onUpdateDocument({
                          guides: { ...project.document.guides, enabled: event.target.checked },
                        })
                      }
                    />
                    Show document guides
                  </label>
                  <div className="guide-toggle-grid">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={project.document.guides.showTrim}
                        onChange={(event) =>
                          onUpdateDocument({
                            guides: {
                              ...project.document.guides,
                              showTrim: event.target.checked,
                            },
                          })
                        }
                      />
                      Trim
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={project.document.guides.showBleed}
                        onChange={(event) =>
                          onUpdateDocument({
                            guides: {
                              ...project.document.guides,
                              showBleed: event.target.checked,
                            },
                          })
                        }
                      />
                      Bleed
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={project.document.guides.showSafeArea}
                        onChange={(event) =>
                          onUpdateDocument({
                            guides: {
                              ...project.document.guides,
                              showSafeArea: event.target.checked,
                            },
                          })
                        }
                      />
                      Safe
                    </label>
                  </div>
                  <div className="field-grid">
                    <label>
                      Bleed %
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.25"
                        value={Number((project.document.guides.bleedRatio * 100).toFixed(2))}
                        onChange={(event) =>
                          onUpdateDocument({
                            guides: {
                              ...project.document.guides,
                              bleedRatio: Number(event.target.value) / 100,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Safe %
                      <input
                        type="number"
                        min="0"
                        max="40"
                        step="0.5"
                        value={Number((project.document.guides.safeAreaRatio * 100).toFixed(2))}
                        onChange={(event) =>
                          onUpdateDocument({
                            guides: {
                              ...project.document.guides,
                              safeAreaRatio: Number(event.target.value) / 100,
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      <section className="panel">
        <button className="panel-heading" onClick={() => togglePanel("data")}>
          <span className="panel-title">
            <Database size={16} />
            <span>Data</span>
          </span>
          {openPanels.data ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {openPanels.data ? (
          <>
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
          </>
        ) : null}
      </section>

      <section className="panel">
        <button className="panel-heading" onClick={() => togglePanel("layers")}>
          <span className="panel-title">
            <Layers size={16} />
            <span>Layers</span>
          </span>
          {openPanels.layers ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {openPanels.layers ? (
          <>
            <label>
              Add layer
              <select
                value=""
                onChange={(event) => {
                  handleAddLayer(event.target.value);
                  event.target.value = "";
                }}
              >
                <option value="" disabled>
                  Choose layer type
                </option>
                <option value="image">Image from file</option>
                <option value="shape">Color / shape</option>
                <option value="text">Text</option>
                <option value="qr">QR code</option>
              </select>
            </label>
            <div className="layer-list">
              {layersTopFirst.map((layer: ProjectLayer) => (
                <div
                  className={`layer-row ${layer.id === selectedLayerId ? "selected" : ""} ${
                    layer.visible ? "" : "hidden-layer"
                  }`}
                  key={layer.id}
                >
                  <button
                    className="icon-button"
                    title={layer.visible ? "Hide layer" : "Show layer"}
                    onClick={() => onToggleLayerVisibility(layer.id)}
                  >
                    {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button className="layer-main" onClick={() => onSelectLayer(layer.id)}>
                    {layer.type === "qr" ? <QrCode size={15} /> : null}
                    {layer.type === "text" ? <Type size={15} /> : null}
                    {layer.type === "shape" ? <Box size={15} /> : null}
                    {layer.type === "image" ? <ImagePlus size={15} /> : null}
                    <span>{layer.name}</span>
                    <small>{layer.type}</small>
                  </button>
                  <div className="layer-order-controls">
                    <button
                      className="icon-button"
                      title="Bring to front"
                      onClick={() => onMoveLayer(layer.id, "front")}
                    >
                      <ArrowUpToLine size={13} />
                    </button>
                    <button
                      className="icon-button"
                      title="Move forward"
                      onClick={() => onMoveLayer(layer.id, "forward")}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      className="icon-button"
                      title="Move backward"
                      onClick={() => onMoveLayer(layer.id, "backward")}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      className="icon-button"
                      title="Send to back"
                      onClick={() => onMoveLayer(layer.id, "back")}
                    >
                      <ArrowDownToLine size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </aside>
  );
}
