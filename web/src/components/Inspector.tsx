import { useEffect, useRef, useState } from "react";
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
import { guideSnapRect } from "../lib/project";
import type { DataGroup, GuideSnapTarget, ProjectLayer, QrMagicProject } from "../types";

type Alignment = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";
type AlignTarget = GuideSnapTarget | "selection";

type InspectorProps = {
  selectedLayer: ProjectLayer | undefined;
  selectedLayers: ProjectLayer[];
  selectedLayerCount: number;
  project: QrMagicProject;
  dataGroups: DataGroup[];
  onUpdateLayer: (
    layerId: string,
    patch: Partial<ProjectLayer>,
    options?: { recordHistory?: boolean },
  ) => void;
  onExportPng: () => void;
  onExportBatch: () => void;
  onUpdateExport: (patch: Partial<QrMagicProject["export"]>) => void;
  isExportingBatch: boolean;
  onSnapToTarget: (target: GuideSnapTarget) => void;
  onAlignSelection: (alignment: Alignment, target: AlignTarget) => void;
  onUpdateSelectionBounds: (
    patch: Partial<Pick<ProjectLayer, "x" | "y" | "width" | "height">>,
  ) => void;
  onUpdateSelectedLayers: (
    patch: Partial<Pick<ProjectLayer, "opacity">>,
    options?: { recordHistory?: boolean },
  ) => void;
  onBeginProjectChange: () => void;
  onCommitProjectChange: () => void;
};

export function Inspector({
  selectedLayer,
  selectedLayers,
  selectedLayerCount,
  project,
  dataGroups,
  onUpdateLayer,
  onExportPng,
  onExportBatch,
  onUpdateExport,
  isExportingBatch,
  onSnapToTarget,
  onAlignSelection,
  onUpdateSelectionBounds,
  onUpdateSelectedLayers,
  onBeginProjectChange,
  onCommitProjectChange,
}: InspectorProps) {
  const [snapTarget, setSnapTarget] = useState<GuideSnapTarget>("page");
  const [alignTarget, setAlignTarget] = useState<AlignTarget>("selection");
  const deferredCommitTimerRef = useRef<number | null>(null);
  const qrLogoInputRef = useRef<HTMLInputElement | null>(null);
  const effectiveAlignTarget: AlignTarget =
    selectedLayerCount > 1 || alignTarget !== "selection" ? alignTarget : "page";

  useEffect(() => {
    return () => {
      if (deferredCommitTimerRef.current) {
        window.clearTimeout(deferredCommitTimerRef.current);
      }
    };
  }, []);

  function selectionBounds(layers: ProjectLayer[]) {
    if (!layers.length) return { x: 0, y: 0, width: 0, height: 0 };
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

  const selectedGroupBounds = selectionBounds(selectedLayers);

  function transientLayerUpdate(layerId: string, patch: Partial<ProjectLayer>) {
    onBeginProjectChange();
    onUpdateLayer(layerId, patch, { recordHistory: false });
    scheduleDeferredCommit();
  }

  function transientSelectionUpdate(patch: Partial<Pick<ProjectLayer, "opacity">>) {
    onBeginProjectChange();
    onUpdateSelectedLayers(patch, { recordHistory: false });
    scheduleDeferredCommit();
  }

  function scheduleDeferredCommit() {
    if (deferredCommitTimerRef.current) {
      window.clearTimeout(deferredCommitTimerRef.current);
    }
    deferredCommitTimerRef.current = window.setTimeout(() => {
      deferredCommitTimerRef.current = null;
      onCommitProjectChange();
    }, 450);
  }

  function commitDeferredChange() {
    if (deferredCommitTimerRef.current) {
      window.clearTimeout(deferredCommitTimerRef.current);
      deferredCommitTimerRef.current = null;
    }
    onCommitProjectChange();
  }

  function deferredInputHandlers() {
    return {
      onPointerDown: onBeginProjectChange,
      onKeyDown: onBeginProjectChange,
      onPointerUp: commitDeferredChange,
      onKeyUp: commitDeferredChange,
      onBlur: commitDeferredChange,
    };
  }

  function updateQrLogo(file: File, layerId: string) {
    const reader = new FileReader();
    reader.onload = () => {
      onUpdateLayer(layerId, {
        logoSrc: String(reader.result),
        logoEnabled: true,
      } as Partial<ProjectLayer>);
    };
    reader.readAsDataURL(file);
  }

  function isAligned(alignment: Alignment) {
    if (!selectedLayers.length) return false;
    const tolerance = 0.5;
    const targetRect =
      effectiveAlignTarget === "selection"
        ? selectedGroupBounds
        : guideSnapRect(project, effectiveAlignTarget);

    if (selectedLayerCount > 1 && effectiveAlignTarget !== "selection") {
      if (alignment === "left") {
        return Math.abs(selectedGroupBounds.x - targetRect.x) <= tolerance;
      }
      if (alignment === "center-x") {
        return (
          Math.abs(
            selectedGroupBounds.x +
              selectedGroupBounds.width / 2 -
              (targetRect.x + targetRect.width / 2),
          ) <= tolerance
        );
      }
      if (alignment === "right") {
        return (
          Math.abs(
            selectedGroupBounds.x +
              selectedGroupBounds.width -
              (targetRect.x + targetRect.width),
          ) <= tolerance
        );
      }
      if (alignment === "top") {
        return Math.abs(selectedGroupBounds.y - targetRect.y) <= tolerance;
      }
      if (alignment === "center-y") {
        return (
          Math.abs(
            selectedGroupBounds.y +
              selectedGroupBounds.height / 2 -
              (targetRect.y + targetRect.height / 2),
          ) <= tolerance
        );
      }
      return (
        Math.abs(
          selectedGroupBounds.y +
            selectedGroupBounds.height -
            (targetRect.y + targetRect.height),
        ) <= tolerance
      );
    }

    return selectedLayers.every((layer) => {
      if (alignment === "left") return Math.abs(layer.x - targetRect.x) <= tolerance;
      if (alignment === "center-x") {
        return (
          Math.abs(layer.x - (targetRect.x + (targetRect.width - layer.width) / 2)) <= tolerance
        );
      }
      if (alignment === "right") {
        return Math.abs(layer.x - (targetRect.x + targetRect.width - layer.width)) <= tolerance;
      }
      if (alignment === "top") return Math.abs(layer.y - targetRect.y) <= tolerance;
      if (alignment === "center-y") {
        return (
          Math.abs(layer.y - (targetRect.y + (targetRect.height - layer.height) / 2)) <= tolerance
        );
      }
      return Math.abs(layer.y - (targetRect.y + targetRect.height - layer.height)) <= tolerance;
    });
  }

  function alignTargetSelect() {
    return (
      <select
        value={effectiveAlignTarget}
        onChange={(event) => setAlignTarget(event.target.value as AlignTarget)}
      >
        {selectedLayerCount > 1 ? <option value="selection">Selection</option> : null}
        <option value="page">Page bounds</option>
        <option value="trim">Trim line</option>
        <option value="bleed">Bleed guide</option>
        <option value="safeArea">Safe area</option>
      </select>
    );
  }

  function alignmentButton(alignment: Alignment, title: string, icon: ReactNode) {
    if (!selectedLayers.length) return null;
    return (
      <button
        className={`tool-button ${isAligned(alignment) ? "selected" : ""}`}
        title={title}
        onClick={() => onAlignSelection(alignment, effectiveAlignTarget)}
      >
        {icon}
      </button>
    );
  }

  function alignmentControls() {
    if (!selectedLayers.length) return null;

    return (
      <label>
        Align to
        <div className="align-target-row">
          {alignTargetSelect()}
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
        </div>
      </label>
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
                {...deferredInputHandlers()}
                onChange={(event) =>
                  transientLayerUpdate(selectedLayer.id, { opacity: Number(event.target.value) })
                }
              />
            </label>
            {alignmentControls()}
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
                      {...deferredInputHandlers()}
                      onChange={(event) =>
                        transientLayerUpdate(selectedLayer.id, {
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
                      {...deferredInputHandlers()}
                      onChange={(event) =>
                        transientLayerUpdate(selectedLayer.id, {
                          background: event.target.value,
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                </div>
                <div className="field-grid">
                  <label>
                    Error correction
                    <select
                      value={selectedLayer.errorCorrectionLevel}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          errorCorrectionLevel: event.target.value as typeof selectedLayer.errorCorrectionLevel,
                        } as Partial<ProjectLayer>)
                      }
                    >
                      <option value="L">L</option>
                      <option value="M">M</option>
                      <option value="Q">Q</option>
                      <option value="H">H</option>
                    </select>
                  </label>
                  <label>
                    Quiet zone
                    <input
                      type="number"
                      min="0"
                      value={selectedLayer.margin}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          margin: Math.max(0, Number(event.target.value)),
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                </div>
                <div className="field-grid">
                  <label>
                    Dots
                    <select
                      value={selectedLayer.dotStyle}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          dotStyle: event.target.value as typeof selectedLayer.dotStyle,
                        } as Partial<ProjectLayer>)
                      }
                    >
                      <option value="square">Square</option>
                      <option value="rounded">Rounded</option>
                      <option value="dots">Dots</option>
                      <option value="classy">Classy</option>
                      <option value="classy-rounded">Classy rounded</option>
                      <option value="extra-rounded">Extra rounded</option>
                    </select>
                  </label>
                  <label>
                    Corners
                    <select
                      value={selectedLayer.cornerSquareStyle}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          cornerSquareStyle: event.target.value as typeof selectedLayer.cornerSquareStyle,
                        } as Partial<ProjectLayer>)
                      }
                    >
                      <option value="square">Square</option>
                      <option value="rounded">Rounded</option>
                      <option value="dot">Dot</option>
                      <option value="extra-rounded">Extra rounded</option>
                    </select>
                  </label>
                </div>
                <label>
                  Corner dots
                  <select
                    value={selectedLayer.cornerDotStyle}
                    onChange={(event) =>
                      onUpdateLayer(selectedLayer.id, {
                        cornerDotStyle: event.target.value as typeof selectedLayer.cornerDotStyle,
                      } as Partial<ProjectLayer>)
                    }
                  >
                    <option value="square">Square</option>
                    <option value="dot">Dot</option>
                    <option value="rounded">Rounded</option>
                    <option value="dots">Dots</option>
                  </select>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedLayer.logoEnabled}
                    onChange={(event) =>
                      onUpdateLayer(selectedLayer.id, {
                        logoEnabled: event.target.checked,
                      } as Partial<ProjectLayer>)
                    }
                  />
                  Logo
                </label>
                <input
                  ref={qrLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="visually-hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) updateQrLogo(file, selectedLayer.id);
                    event.target.value = "";
                  }}
                />
                <button
                  className="secondary-action"
                  onClick={() => qrLogoInputRef.current?.click()}
                >
                  Choose logo
                </button>
                {selectedLayer.logoEnabled ? (
                  <>
                    <div className="field-grid">
                      <label>
                        Logo size
                        <input
                          type="range"
                          min="0.05"
                          max="0.5"
                          step="0.01"
                          value={selectedLayer.logoSize}
                          {...deferredInputHandlers()}
                          onChange={(event) =>
                            transientLayerUpdate(selectedLayer.id, {
                              logoSize: Number(event.target.value),
                            } as Partial<ProjectLayer>)
                          }
                        />
                      </label>
                      <label>
                        Logo margin
                        <input
                          type="number"
                          min="0"
                          value={selectedLayer.logoMargin}
                          onChange={(event) =>
                            onUpdateLayer(selectedLayer.id, {
                              logoMargin: Math.max(0, Number(event.target.value)),
                            } as Partial<ProjectLayer>)
                          }
                        />
                      </label>
                    </div>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedLayer.logoHideBackgroundDots}
                        onChange={(event) =>
                          onUpdateLayer(selectedLayer.id, {
                            logoHideBackgroundDots: event.target.checked,
                          } as Partial<ProjectLayer>)
                        }
                      />
                      Clear dots behind logo
                    </label>
                  </>
                ) : null}
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
                      {...deferredInputHandlers()}
                      onChange={(event) =>
                        transientLayerUpdate(selectedLayer.id, {
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
                  {...deferredInputHandlers()}
                  onChange={(event) =>
                    transientLayerUpdate(selectedLayer.id, {
                      fillOpacity: Number(event.target.value),
                    } as Partial<ProjectLayer>)
                  }
                  />
                </label>
              </>
            ) : null}
            {selectedLayer.type === "shape" ? (
              <>
                <label>
                  Shape
                  <select
                    value={selectedLayer.shape}
                    onChange={(event) =>
                      onUpdateLayer(selectedLayer.id, {
                        shape: event.target.value as typeof selectedLayer.shape,
                      } as Partial<ProjectLayer>)
                    }
                  >
                    <option value="rectangle">Rectangle</option>
                    <option value="ellipse">Circle / oval</option>
                    <option value="star">Star</option>
                  </select>
                </label>
                <div className="field-grid">
                  <label>
                    Fill
                    <input
                      type="color"
                      value={
                        selectedLayer.fill === "transparent" ? "#ffffff" : selectedLayer.fill
                      }
                      {...deferredInputHandlers()}
                      onChange={(event) =>
                        transientLayerUpdate(selectedLayer.id, {
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
                      {...deferredInputHandlers()}
                      onChange={(event) =>
                        transientLayerUpdate(selectedLayer.id, {
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
                      {...deferredInputHandlers()}
                      onChange={(event) =>
                        transientLayerUpdate(selectedLayer.id, {
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
                      {...deferredInputHandlers()}
                      onChange={(event) =>
                        transientLayerUpdate(selectedLayer.id, {
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
                  {selectedLayer.shape === "rectangle" ? (
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
                  ) : null}
                </div>
                {selectedLayer.shape === "star" ? (
                  <div className="field-grid">
                    <label>
                      Star points
                      <input
                        type="number"
                        min="3"
                        max="12"
                        value={selectedLayer.starPoints}
                        onChange={(event) =>
                          onUpdateLayer(selectedLayer.id, {
                            starPoints: Math.max(3, Number(event.target.value)),
                          } as Partial<ProjectLayer>)
                        }
                      />
                    </label>
                    <label>
                      Arm length
                      <input
                        type="range"
                        min="0.1"
                        max="0.9"
                        step="0.05"
                        value={selectedLayer.starInnerRadiusRatio}
                        {...deferredInputHandlers()}
                        onChange={(event) =>
                          transientLayerUpdate(selectedLayer.id, {
                            starInnerRadiusRatio: Number(event.target.value),
                          } as Partial<ProjectLayer>)
                        }
                      />
                    </label>
                  </div>
                ) : null}
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
        ) : selectedLayerCount > 1 ? (
          <>
            <label>
              Selection name
              <input value={`${selectedLayerCount} selected layers`} disabled />
            </label>
            <div className="field-grid">
              <label>
                X
                <input
                  type="number"
                  value={Math.round(selectedGroupBounds.x)}
                  onChange={(event) =>
                    onUpdateSelectionBounds({ x: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  value={Math.round(selectedGroupBounds.y)}
                  onChange={(event) =>
                    onUpdateSelectionBounds({ y: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <div className="field-grid">
              <label>
                Width
                <input
                  type="number"
                  value={Math.round(selectedGroupBounds.width)}
                  onChange={(event) =>
                    onUpdateSelectionBounds({ width: Math.max(1, Number(event.target.value)) })
                  }
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  value={Math.round(selectedGroupBounds.height)}
                  onChange={(event) =>
                    onUpdateSelectionBounds({ height: Math.max(1, Number(event.target.value)) })
                  }
                />
              </label>
            </div>
            <label>
              Layer opacity
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={
                  selectedLayers.every(
                    (layer) => Math.abs(layer.opacity - selectedLayers[0].opacity) < 0.01,
                  )
                    ? selectedLayers[0].opacity
                    : 1
                }
                {...deferredInputHandlers()}
                onChange={(event) =>
                  transientSelectionUpdate({ opacity: Number(event.target.value) })
                }
              />
            </label>
            {alignmentControls()}
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
