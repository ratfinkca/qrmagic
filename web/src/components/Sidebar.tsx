import { useEffect, useRef, useState } from "react";
import { HelpTip } from "./HelpTip";
import type { TourTarget } from "../lib/helpContent";
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
import { isRepeatedJob, usesRecordIndex, jobSummary } from "../lib/production";
import { ColorControl } from "./ColorControl";
import { presetShapeGeometry, SHAPE_OPTIONS } from "../lib/shapeGeometry";
import type { DataGroup, ProjectLayer, QrMagicProject } from "../types";

type SidebarProps = {
  tourTarget: TourTarget | null;
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
  onUpdateDocument: (
    patch: Partial<QrMagicProject["document"]>,
    options?: { recordHistory?: boolean },
  ) => void;
  onUpdateProduction: (copies: number) => void;
  onBeginProjectChange: () => void;
  onCommitProjectChange: () => void;
  onUseColor: (color: string) => void;
  onSaveColor: (color: string) => void;
  onRemoveColor: (color: string) => void;
  onAddShapeLayer: () => void;
  onAddTextLayer: () => void;
  onAddQrLayer: (mode?: DataGroup["mode"], includeLabel?: boolean) => void;
  onAddImageLayer: () => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onReorderLayers: (layers: ProjectLayer[]) => void;
};

type OpenPanel = "document" | "guides" | "data" | "layers";

export function Sidebar({
  tourTarget,
  project,
  selectedLayerIds,
  onSelectLayers,
  onUpdateDataGroup,
  onUpdateDataGroupSerial,
  onUpdateDataGroupFixed,
  onUpdateDataGroupMode,
  onUpdateDocument,
  onUpdateProduction,
  onBeginProjectChange,
  onCommitProjectChange,
  onUseColor,
  onSaveColor,
  onRemoveColor,
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
    guides: false,
    data: true,
    layers: true,
  });
  const layersTopFirst = [...project.layers].reverse();
  const tourPanels = useRef<Record<OpenPanel,boolean> | null>(null);
  useEffect(() => {
    if (tourTarget) {
      setOpenPanels(current => {
        tourPanels.current ??= current;
        const panel = tourTarget === "job" ? "data" : tourTarget === "qr" ? "layers" : tourTarget === "document" ? "document" : tourTarget === "layers" ? "layers" : null;
        return panel ? {...current,[panel]:true} : current;
      });
    } else if (tourPanels.current) { setOpenPanels(tourPanels.current); tourPanels.current = null; }
  }, [tourTarget]);
  const selectedLayerSet = new Set(selectedLayerIds);
  const repeated = isRepeatedJob(project);
  const indexed = usesRecordIndex(project);
  const serialGroup = project.data.groups.find(group => group.mode === "serial");
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
    if (value === "qr") onAddQrLayer("fixed");
    if (value === "qr-serial") onAddQrLayer("serial");
    if (value === "qr-label") onAddQrLayer("serial", true);
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

  function updateDocumentColor(color: string) {
    onBeginProjectChange();
    onUpdateDocument({ backgroundColor: color }, { recordHistory: false });
  }

  function commitDocumentColor(color: string) {
    onUseColor(color);
    onCommitProjectChange();
  }

  function updateDocumentOpacity(opacity: number) {
    onBeginProjectChange();
    onUpdateDocument(
      {
        backgroundOpacity: opacity,
        transparentBackground: opacity <= 0,
      },
      { recordHistory: false },
    );
  }

  return (
    <aside className="sidebar">
      <section className="panel" data-guide="document">
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
                Finished width
                <input
                  type="number"
                  value={project.document.width}
                  onChange={(event) => onUpdateDocument({ width: Number(event.target.value) })}
                />
              </label>
              <label>
                Finished height
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

            </div>
            <div className="help-field-note">Size after cutting <HelpTip topic="finished"/></div>
            <div className="document-color-field">
              <div className="field-grid">
                <ColorControl
                  label="Page color"
                  value={project.document.backgroundColor}
                  recentColors={project.colors.recent}
                  paletteColors={project.colors.palette}
                  onChange={updateDocumentColor}
                  onChangeEnd={commitDocumentColor}
                  onSaveColor={onSaveColor}
                  onRemoveColor={onRemoveColor}
                />
                <label>
                  Opacity
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={project.document.backgroundOpacity}
                    onPointerDown={onBeginProjectChange}
                    onKeyDown={onBeginProjectChange}
                    onPointerUp={onCommitProjectChange}
                    onKeyUp={onCommitProjectChange}
                    onBlur={onCommitProjectChange}
                    onChange={(event) =>
                      updateDocumentOpacity(Number(event.target.value))
                    }
                  />
                </label>
              </div>
            </div>
                  <label>
                    Cut shape
                    <select
                      aria-label="Cut shape"
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
                      Cut corner radius (mm)
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={Number((project.document.shape.cornerRadius / project.document.dpi * 25.4).toFixed(3))}
                        onChange={(event) =>
                          onUpdateDocument({
                            shape: {
                              ...project.document.shape,
                              cornerRadius: Math.max(0, Number(event.target.value)) / 25.4 * project.document.dpi,
                            },
                          })
                        }
                      />
                    </label>
                  ) : null}
                  {!["rectangle", "ellipse", "pill"].includes(project.document.shape.shape) ? <details className="shape-customize">
                    <summary>Customize outline</summary>
                    <div className="field-grid">
                      {project.document.shape.shape !== "diamond" ? <label>
                        Points
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
                      </label> : null}
                      <label>
                        Inner radius ({Math.round(project.document.shape.vertexInset * 100)}%)
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
                        Corner rounding ({Math.round(project.document.shape.vertexRadius * 100)}%)
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
                        Side curve ({project.document.shape.sideDeflection.toFixed(2)})
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
                  </details> : null}
          </>
        ) : null}
      </section>

      <section className="panel">
        <button className="panel-heading" onClick={() => togglePanel("guides")} aria-expanded={openPanels.guides}>
          <span>Print setup</span>{openPanels.guides ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {openPanels.guides ? <>
              <label>
                DPI
                <input
                  type="number"
                  value={project.document.dpi}
                  onChange={(event) => onUpdateDocument({ dpi: Number(event.target.value) })}
                />
              </label><div className="help-field-note">Printed image detail <HelpTip topic="dpi"/></div><div className="field-grid">
                    <label>
                      Bleed outside cut (mm)
                      <input
                        aria-describedby="document-bleed-tip"
                        type="number"
                        min="0"
                        max="25"
                        step="0.25"
                        value={project.document.bleedMm}
                        onChange={(event) =>
                          onUpdateDocument({
                            bleedMm: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Safe inset (mm)
                      <input
                        type="number"
                        min="0"
                        max="40"
                        step="0.5"
                        value={project.document.safeAreaMm}
                        onChange={(event) =>
                          onUpdateDocument({
                            safeAreaMm: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="help-field-note">Bleed <HelpTip topic="bleed"/> Safe area <HelpTip topic="safe"/></div>
                  <p className="chooser-hint" id="document-bleed-tip">Bleed is extra artwork beyond the cut edge. Extend backgrounds into it to prevent white edges when trimming. Use your print shop’s required amount, or 0 for no bleed.</p>
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
        </> : null}
      </section>

      <section className="panel" data-guide="job">
        <button className="panel-heading" onClick={() => togglePanel("data")}>
          <span className="panel-title">
            <Database size={16} />
            <span>Job</span>
          </span>
          {openPanels.data ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {openPanels.data ? (
          <>
            <label>{repeated ? "Quantity" : "Copies of each"}
              <input type="number" min="1" max="100000" step="1" value={project.production.copiesPerRecord}
                onChange={event => onUpdateProduction(Number(event.target.value))} />
            </label>
            <div className="help-context-row"><p className="chooser-hint" aria-live="polite">{jobSummary(project)}</p><HelpTip topic="quantities"/></div>
            {serialGroup?.mode === "serial" ? <>
              <label>Number of serials<input type="number" min="1" max="100000" value={serialGroup.serial.quantity}
                onChange={event => onUpdateDataGroupSerial(serialGroup.id, { quantity: Number(event.target.value) })} /></label>
              <div className="field-grid">
                <label>Prefix<input value={serialGroup.serial.prefix} onChange={event => onUpdateDataGroupSerial(serialGroup.id, { prefix: event.target.value })} /></label>
                <label>Start<input type="number" value={serialGroup.serial.start} onChange={event => onUpdateDataGroupSerial(serialGroup.id, { start: Number(event.target.value) })} /></label>
              </div>
            </> : null}
            <details className="editor-disclosure">
              <summary>Advanced content sources</summary>
              <p className="chooser-hint">Sources can be shared by QR and text layers. Fixed values stay present on every item. Numbered sources advance with the job.</p>
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
                      Unique records
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
                      {indexed ? <label>
                        Indexed variations
                        <input
                          type="number"
                          min="1"
                          value={group.fixed.quantity}
                          onChange={(event) =>
                            onUpdateDataGroupFixed(group.id, {
                              quantity: Math.max(1, Number(event.target.value)),
                            })
                          }
                        />
                      </label> : null}
                    </>
                  )}
                </div>
              ))}
            </div>
            </details>
          </>
        ) : null}
      </section>

      <section className="panel" data-guide="layers">
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
                aria-label="Add layer"
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
                <option value="qr">QR code · same on every item</option>
                <option value="qr-serial">QR code · numbered</option>
                <option value="qr-label">Numbered QR + serial label</option>
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
