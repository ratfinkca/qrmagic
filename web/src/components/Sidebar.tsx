import { useState } from "react";
import {
  Box,
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  ImagePlus,
  Layers,
  QrCode,
  Trash2,
  Type,
} from "lucide-react";
import { presetShapeGeometry, SHAPE_OPTIONS } from "../lib/shapeGeometry";
import type { DataGroup, ProjectLayer, QrMagicProject } from "../types";

type SidebarProps = {
  project: QrMagicProject;
  selectedLayerIds: string[];
  onSelectLayers: (layerIds: string[]) => void;
  onUpdateDataGroup: (groupId: string, patch: { name?: string }) => void;
  onUpdateDataGroupSerial: (
    groupId: string,
    patch: { prefix?: string; suffix?: string; start?: number; quantity?: number; step?: number; padding?: number },
  ) => void;
  onUpdateDataGroupFixed: (groupId: string, patch: { value?: string; quantity?: number }) => void;
  onUpdateDataGroupMode: (groupId: string, mode: DataGroup["mode"]) => void;
  onUpdateDocument: (patch: Partial<QrMagicProject["document"]>) => void;
  onAddShapeLayer: () => void;
  onAddTextLayer: () => void;
  onAddQrLayer: () => void;
  onAddImageLayer: () => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onReorderLayers: (layers: ProjectLayer[]) => void;
};

type OpenPanel = "document" | "guides" | "data" | "layers";

export function Sidebar({
  project,
  selectedLayerIds,
  onSelectLayers,
  onUpdateDataGroup,
  onUpdateDataGroupSerial,
  onUpdateDataGroupFixed,
  onUpdateDataGroupMode,
  onUpdateDocument,
  onAddShapeLayer,
  onAddTextLayer,
  onAddQrLayer,
  onAddImageLayer,
  onToggleLayerVisibility,
  onDeleteLayer,
  onReorderLayers,
}: SidebarProps) {
  const [openPanels, setOpenPanels] = useState<Record<OpenPanel, boolean>>({
    document: true,
    guides: true,
    data: true,
    layers: true,
  });
  const layersTopFirst = [...project.layers].reverse();
  const selectedLayerSet = new Set(selectedLayerIds);
  const hasSerialGroup = project.data.groups.some((group) => group.mode === "serial");
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);

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

  function reorderByDrop(targetLayerId: string) {
    if (!draggingLayerId || draggingLayerId === targetLayerId) {
      setDraggingLayerId(null);
      setDragOverLayerId(null);
      return;
    }

    const nextTopFirst = [...layersTopFirst];
    const draggedIndex = nextTopFirst.findIndex((layer) => layer.id === draggingLayerId);
    const targetIndex = nextTopFirst.findIndex((layer) => layer.id === targetLayerId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedLayer] = nextTopFirst.splice(draggedIndex, 1);
    nextTopFirst.splice(targetIndex, 0, draggedLayer);
    onReorderLayers([...nextTopFirst].reverse());
    setDraggingLayerId(null);
    setDragOverLayerId(null);
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
                  <label>
                    Guide shape
                    <select
                      value={project.document.shape.shape}
                      onChange={(event) =>
                        onUpdateDocument({
                          shape: {
                            ...presetShapeGeometry(
                              event.target.value as QrMagicProject["document"]["shape"]["shape"],
                            ),
                          },
                        })
                      }
                    >
                      {SHAPE_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {project.document.shape.shape === "rectangle" ? (
                    <label>
                      Guide corner radius
                      <input
                        type="number"
                        min="0"
                        value={project.document.shape.cornerRadius}
                        onChange={(event) =>
                          onUpdateDocument({
                            shape: {
                              ...project.document.shape,
                              cornerRadius: Math.max(0, Number(event.target.value)),
                            },
                          })
                        }
                      />
                    </label>
                  ) : null}
                  <details className="shape-customize">
                    <summary>Customize shape</summary>
                    <div className="field-grid">
                      <label>
                        Vertices
                        <input
                          type="number"
                          min="3"
                          max="12"
                          value={project.document.shape.vertices}
                          onChange={(event) =>
                            onUpdateDocument({
                              shape: {
                                ...project.document.shape,
                                vertices: Math.max(3, Math.min(12, Number(event.target.value))),
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        Vertex inset
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          value={project.document.shape.vertexInset}
                          onChange={(event) =>
                            onUpdateDocument({
                              shape: {
                                ...project.document.shape,
                                vertexInset: Number(event.target.value),
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="field-grid">
                      <label>
                        Vertex radius
                        <input
                          type="range"
                          min="0"
                          max="0.45"
                          step="0.01"
                          value={project.document.shape.vertexRadius}
                          onChange={(event) =>
                            onUpdateDocument({
                              shape: {
                                ...project.document.shape,
                                vertexRadius: Number(event.target.value),
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        Side deflection
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.05"
                          value={project.document.shape.sideDeflection}
                          onChange={(event) =>
                            onUpdateDocument({
                              shape: {
                                ...project.document.shape,
                                sideDeflection: Number(event.target.value),
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  </details>
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
            <div className="data-group-list">
              {project.data.groups.map((group) => (
                <div className="data-group-editor" key={group.id}>
                  <label>
                    Group name
                    <input
                      value={group.name}
                      onChange={(event) =>
                        onUpdateDataGroup(group.id, { name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Mode
                    <select
                      value={group.mode}
                      onChange={(event) =>
                        onUpdateDataGroupMode(group.id, event.target.value as DataGroup["mode"])
                      }
                    >
                      <option value="serial">Serial</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </label>
                  {group.mode === "serial" ? (
                    <>
                  <div className="field-grid">
                    <label>
                      Prefix
                      <input
                        value={group.serial.prefix}
                        onChange={(event) =>
                          onUpdateDataGroupSerial(group.id, { prefix: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Suffix
                      <input
                        value={group.serial.suffix}
                        onChange={(event) =>
                          onUpdateDataGroupSerial(group.id, { suffix: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="field-grid">
                    <label>
                      Start
                      <input
                        type="number"
                        value={group.serial.start}
                        onChange={(event) =>
                          onUpdateDataGroupSerial(group.id, { start: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Step
                      <input
                        type="number"
                        value={group.serial.step}
                        onChange={(event) =>
                          onUpdateDataGroupSerial(group.id, { step: Number(event.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <div className="field-grid">
                    <label>
                      Quantity
                      <input
                        type="number"
                        min="1"
                        value={group.serial.quantity}
                        onChange={(event) =>
                          onUpdateDataGroupSerial(group.id, {
                            quantity: Math.max(1, Number(event.target.value)),
                          })
                        }
                      />
                    </label>
                    <label>
                      Padding
                      <input
                        type="number"
                        min="0"
                        value={group.serial.padding}
                        onChange={(event) =>
                          onUpdateDataGroupSerial(group.id, {
                            padding: Math.max(0, Number(event.target.value)),
                          })
                        }
                      />
                    </label>
                  </div>
                    </>
                  ) : (
                    <>
                      <label>
                        Fixed value
                        <input
                          value={group.fixed.value}
                          onChange={(event) =>
                            onUpdateDataGroupFixed(group.id, { value: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Quantity
                        <input
                          type="number"
                          min="1"
                          value={group.fixed.quantity}
                          disabled={hasSerialGroup}
                          title={
                            hasSerialGroup
                              ? "Serial data groups control quantity when present."
                              : "Fixed-only jobs repeat this value for the set quantity."
                          }
                          onChange={(event) =>
                            onUpdateDataGroupFixed(group.id, {
                              quantity: Math.max(1, Number(event.target.value)),
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
              ))}
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
                  className={`layer-row ${selectedLayerSet.has(layer.id) ? "selected" : ""} ${
                    layer.visible ? "" : "hidden-layer"
                  } ${layer.id === dragOverLayerId ? "drag-over" : ""}`}
                  key={layer.id}
                  draggable
                  onDragStart={() => setDraggingLayerId(layer.id)}
                  onDragEnd={() => {
                    if (dragOverLayerId) {
                      reorderByDrop(dragOverLayerId);
                    } else {
                      setDraggingLayerId(null);
                      setDragOverLayerId(null);
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverLayerId(layer.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    reorderByDrop(layer.id);
                  }}
                >
                  <GripVertical className="drag-handle" size={15} />
                  <button
                    className="icon-button"
                    title={layer.visible ? "Hide layer" : "Show layer"}
                    onClick={() => onToggleLayerVisibility(layer.id)}
                  >
                    {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button
                    className="layer-main"
                    title={layer.name}
                    onClick={(event) =>
                      onSelectLayers(
                        event.shiftKey
                          ? selectedLayerSet.has(layer.id)
                            ? selectedLayerIds.filter((selectedId) => selectedId !== layer.id)
                            : [...selectedLayerIds, layer.id]
                          : [layer.id],
                      )
                    }
                  >
                    {layer.type === "qr" ? <QrCode size={15} /> : null}
                    {layer.type === "text" ? <Type size={15} /> : null}
                    {layer.type === "shape" ? <Box size={15} /> : null}
                    {layer.type === "image" ? <ImagePlus size={15} /> : null}
                    <span>{layer.name}</span>
                    <small>{layer.type}</small>
                  </button>
                  <button
                    className="icon-button danger"
                    title="Delete layer"
                    onClick={() => onDeleteLayer(layer.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </aside>
  );
}
