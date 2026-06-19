import { useState } from "react";
import type { ReactNode } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Box,
  Download,
  RotateCw,
  SlidersHorizontal,
} from "lucide-react";
import { documentPixelSize } from "../lib/project";
import type { DataGroup, GuideSnapTarget, ProjectLayer, QrMagicProject } from "../types";

type Alignment = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";

type InspectorProps = {
  selectedLayer: ProjectLayer | undefined;
  selectedLayerCount: number;
  project: QrMagicProject;
  dataGroups: DataGroup[];
  onUpdateLayer: (layerId: string, patch: Partial<ProjectLayer>) => void;
  onExportPng: () => void;
  onExportBatch: () => void;
  onUpdateExport: (patch: Partial<QrMagicProject["export"]>) => void;
  isExportingBatch: boolean;
  onSnapToTarget: (target: GuideSnapTarget) => void;
  onAlignLayer: (layerId: string, alignment: Alignment) => void;
};

export function Inspector({
  selectedLayer,
  selectedLayerCount,
  project,
  dataGroups,
  onUpdateLayer,
  onExportPng,
  onExportBatch,
  onUpdateExport,
  isExportingBatch,
  onSnapToTarget,
  onAlignLayer,
}: InspectorProps) {
  const [snapTarget, setSnapTarget] = useState<GuideSnapTarget>("page");
  const docSize = documentPixelSize(project);

  function isAligned(alignment: Alignment) {
    if (!selectedLayer) return false;
    const tolerance = 0.5;
    if (alignment === "left") return Math.abs(selectedLayer.x) <= tolerance;
    if (alignment === "center-x") {
      return Math.abs(selectedLayer.x - (docSize.width - selectedLayer.width) / 2) <= tolerance;
    }
    if (alignment === "right") {
      return Math.abs(selectedLayer.x - (docSize.width - selectedLayer.width)) <= tolerance;
    }
    if (alignment === "top") return Math.abs(selectedLayer.y) <= tolerance;
    if (alignment === "center-y") {
      return Math.abs(selectedLayer.y - (docSize.height - selectedLayer.height) / 2) <= tolerance;
    }
    return Math.abs(selectedLayer.y - (docSize.height - selectedLayer.height)) <= tolerance;
  }

  function alignmentButton(alignment: Alignment, title: string, icon: ReactNode) {
    if (!selectedLayer) return null;
    return (
      <button
        className={`tool-button ${isAligned(alignment) ? "selected" : ""}`}
        title={title}
        onClick={() => onAlignLayer(selectedLayer.id, alignment)}
      >
        {icon}
      </button>
    );
  }

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
            <label>
              Align to document
              <div className="alignment-grid">
                {alignmentButton(
                  "left",
                  "Align left",
                  <AlignHorizontalJustifyStart size={16} />,
                )}
                {alignmentButton(
                  "center-x",
                  "Align horizontal center",
                  <AlignCenterHorizontal size={16} />,
                )}
                {alignmentButton(
                  "right",
                  "Align right",
                  <AlignHorizontalJustifyEnd size={16} />,
                )}
                {alignmentButton("top", "Align top", <AlignVerticalJustifyStart size={16} />)}
                {alignmentButton(
                  "center-y",
                  "Align vertical center",
                  <AlignCenterVertical size={16} />,
                )}
                {alignmentButton(
                  "bottom",
                  "Align bottom",
                  <AlignVerticalJustifyEnd size={16} />,
                )}
              </div>
            </label>
            {selectedLayer.type === "shape" || selectedLayer.type === "image" ? (
              <label>
                Snap layer to
                <div className="snap-row">
                  <select
                    value={snapTarget}
                    onChange={(event) => setSnapTarget(event.target.value as GuideSnapTarget)}
                  >
                    <option value="page">Page bounds</option>
                    <option value="trim">Trim line</option>
                    <option value="bleed">Bleed guide</option>
                    <option value="safeArea">Safe area</option>
                  </select>
                  <button
                    className="secondary-action"
                    onClick={() => onSnapToTarget(snapTarget)}
                  >
                    Snap
                  </button>
                </div>
              </label>
            ) : null}
            {selectedLayer.type === "qr" ? (
              <>
                <label>
                  Data group
                  <select
                    value={selectedLayer.dataGroupId}
                    onChange={(event) =>
                      onUpdateLayer(selectedLayer.id, {
                        dataGroupId: event.target.value,
                      } as Partial<ProjectLayer>)
                    }
                  >
                    {dataGroups.map((group) => (
                      <option value={group.id} key={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
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
                  Data group
                  <select
                    value={selectedLayer.dataGroupId ?? ""}
                    onChange={(event) =>
                      onUpdateLayer(selectedLayer.id, {
                        dataGroupId: event.target.value || undefined,
                      } as Partial<ProjectLayer>)
                    }
                  >
                    <option value="">Primary serial</option>
                    {dataGroups.map((group) => (
                      <option value={group.id} key={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
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
            <span>
              {selectedLayerCount > 1
                ? `${selectedLayerCount} layers selected. Use the canvas handles to move or resize them.`
                : "Select a layer to edit it."}
            </span>
          </div>
        )}
      </section>
    </aside>
  );
}
