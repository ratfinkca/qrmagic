import { Box, Download, RotateCw, SlidersHorizontal } from "lucide-react";
import type { ProjectLayer, QrMagicProject } from "../types";

type InspectorProps = {
  selectedLayer: ProjectLayer | undefined;
  project: QrMagicProject;
  onUpdateLayer: (layerId: string, patch: Partial<ProjectLayer>) => void;
  onExportPng: () => void;
  onExportBatch: () => void;
  onUpdateExport: (patch: Partial<QrMagicProject["export"]>) => void;
  isExportingBatch: boolean;
  onSnapToPage: () => void;
};

export function Inspector({
  selectedLayer,
  project,
  onUpdateLayer,
  onExportPng,
  onExportBatch,
  onUpdateExport,
  isExportingBatch,
  onSnapToPage,
}: InspectorProps) {
  return (
    <aside className="inspector">
      <section className="panel">
        <div className="panel-title">
          <Download size={16} />
          <span>Export</span>
        </div>
        <div className="export-summary">
          <strong>{project.export.renderMode}</strong>
          <span>{project.export.formats.join(", ").toUpperCase()}</span>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={project.export.includeGuides}
            onChange={(event) => onUpdateExport({ includeGuides: event.target.checked })}
          />
          Include visible guides
        </label>
        <button className="primary-action" onClick={onExportPng}>
          <Download size={16} />
          Export PNG
        </button>
        <button
          className="secondary-action"
          onClick={onExportBatch}
          disabled={isExportingBatch}
        >
          <Download size={16} />
          {isExportingBatch ? "Exporting set..." : "Export PNG Set"}
        </button>
      </section>

      <section className="panel inspector-panel">
        <div className="panel-title">
          <SlidersHorizontal size={16} />
          <span>Inspector</span>
        </div>
        {selectedLayer ? (
          <>
            <label>
              Layer name
              <input
                value={selectedLayer.name}
                onChange={(event) =>
                  onUpdateLayer(selectedLayer.id, { name: event.target.value })
                }
              />
            </label>
            <div className="field-grid">
              <label>
                X
                <input
                  type="number"
                  value={Math.round(selectedLayer.x)}
                  onChange={(event) =>
                    onUpdateLayer(selectedLayer.id, { x: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  value={Math.round(selectedLayer.y)}
                  onChange={(event) =>
                    onUpdateLayer(selectedLayer.id, { y: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <div className="field-grid">
              <label>
                Width
                <input
                  type="number"
                  value={Math.round(selectedLayer.width)}
                  onChange={(event) =>
                    onUpdateLayer(selectedLayer.id, { width: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  value={Math.round(selectedLayer.height)}
                  onChange={(event) =>
                    onUpdateLayer(selectedLayer.id, { height: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <label>
              <span className="inline-label">
                <RotateCw size={14} />
                Rotation
              </span>
              <input
                type="number"
                value={Math.round(selectedLayer.rotation)}
                onChange={(event) =>
                  onUpdateLayer(selectedLayer.id, { rotation: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Layer opacity
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selectedLayer.opacity}
                onChange={(event) =>
                  onUpdateLayer(selectedLayer.id, { opacity: Number(event.target.value) })
                }
              />
            </label>
            {selectedLayer.type === "shape" || selectedLayer.type === "image" ? (
              <button className="secondary-action" onClick={onSnapToPage}>
                Snap to page
              </button>
            ) : null}
            {selectedLayer.type === "qr" ? (
              <>
                <label>
                  Payload
                  <input
                    value={selectedLayer.payloadTemplate}
                    onChange={(event) =>
                      onUpdateLayer(selectedLayer.id, {
                        payloadTemplate: event.target.value,
                      } as Partial<ProjectLayer>)
                    }
                  />
                </label>
                <div className="field-grid">
                  <label>
                    Foreground
                    <input
                      type="color"
                      value={selectedLayer.foreground}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          foreground: event.target.value,
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                  <label>
                    Background
                    <input
                      type="color"
                      value={selectedLayer.background}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          background: event.target.value,
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                </div>
              </>
            ) : null}
            {selectedLayer.type === "text" ? (
              <>
                <label>
                  Text
                  <input
                    value={selectedLayer.textTemplate}
                    onChange={(event) =>
                      onUpdateLayer(selectedLayer.id, {
                        textTemplate: event.target.value,
                      } as Partial<ProjectLayer>)
                    }
                  />
                </label>
                <div className="field-grid">
                  <label>
                    Size
                    <input
                      type="number"
                      value={selectedLayer.fontSize}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          fontSize: Number(event.target.value),
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                  <label>
                    Color
                    <input
                      type="color"
                      value={selectedLayer.fill}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          fill: event.target.value,
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                </div>
                <label>
                  Color opacity
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedLayer.fillOpacity}
                    onChange={(event) =>
                      onUpdateLayer(selectedLayer.id, {
                        fillOpacity: Number(event.target.value),
                      } as Partial<ProjectLayer>)
                    }
                  />
                </label>
              </>
            ) : null}
            {selectedLayer.type === "shape" ? (
              <>
                <div className="field-grid">
                  <label>
                    Fill
                    <input
                      type="color"
                      value={
                        selectedLayer.fill === "transparent" ? "#ffffff" : selectedLayer.fill
                      }
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          fill: event.target.value,
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                  <label>
                    Stroke
                    <input
                      type="color"
                      value={
                        selectedLayer.stroke === "transparent" ? "#111827" : selectedLayer.stroke
                      }
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          stroke: event.target.value,
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                </div>
                <div className="field-grid">
                  <label>
                    Fill opacity
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedLayer.fillOpacity}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          fillOpacity: Number(event.target.value),
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                  <label>
                    Stroke opacity
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedLayer.strokeOpacity}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          strokeOpacity: Number(event.target.value),
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                </div>
                <div className="field-grid">
                  <label>
                    Stroke width
                    <input
                      type="number"
                      value={selectedLayer.strokeWidth}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          strokeWidth: Number(event.target.value),
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                  <label>
                    Corner radius
                    <input
                      type="number"
                      value={selectedLayer.cornerRadius}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          cornerRadius: Number(event.target.value),
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                </div>
                <label>
                  Dash pattern
                  <input
                    value={selectedLayer.dash.join(", ")}
                    onChange={(event) =>
                      onUpdateLayer(selectedLayer.id, {
                        dash: event.target.value
                          .split(",")
                          .map((value) => Number(value.trim()))
                          .filter((value) => Number.isFinite(value) && value >= 0),
                      } as Partial<ProjectLayer>)
                    }
                  />
                </label>
              </>
            ) : null}
          </>
        ) : (
          <div className="empty-state">
            <Box size={28} />
            <span>Select a layer to edit it.</span>
          </div>
        )}
      </section>
    </aside>
  );
}
