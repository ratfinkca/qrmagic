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
import { QrContentEditor } from "./QrContentEditor";
import { HelpTip } from "./HelpTip";
import { productionCount } from "../lib/production";
import { productionPreflight } from "../lib/productionPdfModel";
import { ColorControl } from "./ColorControl";
import { guideSnapRect } from "../lib/project";
import { presetShapeGeometry, SHAPE_OPTIONS } from "../lib/shapeGeometry";
import type {
  DataGroup,
  GuideSnapTarget,
  ProjectLayer,
  QrMagicProject,
  ShapeFillMode,
} from "../types";

type Alignment = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";
type AlignTarget = GuideSnapTarget | "selection";
type ExportSetFormat = "png" | "jpg" | "pdf" | "production-pdf";

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
  onChangeQrMode: (layerId: string, mode: DataGroup["mode"]) => void;
  onChangeFixed: (id: string, patch: { value?: string }) => void;
  onMakeQrIndependent: (layerId: string) => void;
  onUseColor: (color: string) => void;
  onSaveColor: (color: string) => void;
  onRemoveColor: (color: string) => void;
  onExportPng: () => void;
  onExportBatch: () => void;
  onPrintLayout: () => void;
  onUpdateExport: (patch: Partial<QrMagicProject["export"]>) => void;
  exportStatus: "template" | "set" | null;
  exportSetFormat: ExportSetFormat;
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
  onChangeQrMode,
  onChangeFixed,
  onMakeQrIndependent,
  onUseColor,
  onSaveColor,
  onRemoveColor,
  onExportPng,
  onExportBatch,
  onPrintLayout,
  onUpdateExport,
  exportStatus,
  exportSetFormat,
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
  const isExporting = exportStatus !== null;
  const productionIssues = exportSetFormat === "production-pdf" ? productionPreflight(project) : [];
  const productionErrors = productionIssues.filter(issue => issue.severity === "error");
  const pixelsPerUnit = project.document.unit === "px" ? 1
    : project.document.unit === "mm" ? project.document.dpi / 25.4 : project.document.dpi;
  const displayLength = (pixels: number) => Number((pixels / pixelsPerUnit).toFixed(3));
  const readLength = (value: string) => Number(value) * pixelsPerUnit;


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

  function layerColorControl(
    label: string,
    value: string,
    patchForColor: (color: string) => Partial<ProjectLayer>,
  ) {
    if (!selectedLayer) return null;

    return (
      <ColorControl
        label={label}
        value={value === "transparent" ? "#ffffff" : value}
        recentColors={project.colors.recent}
        paletteColors={project.colors.palette}
        onChange={(color) =>
          transientLayerUpdate(selectedLayer.id, patchForColor(color) as Partial<ProjectLayer>)
        }
        onChangeEnd={onUseColor}
        onSaveColor={onSaveColor}
        onRemoveColor={onRemoveColor}
      />
    );
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
      <section className="panel inspector-panel">
        <div className="panel-title">
          <SlidersHorizontal size={16} />
          <span>Inspector</span>
        </div>
        {selectedLayer ? (
          <>
            {selectedLayer.type === "qr" ? <QrContentEditor layer={selectedLayer} project={project}
              onUpdateLayer={onUpdateLayer} onChangeMode={onChangeQrMode} onChangeFixed={onChangeFixed}
              onMakeIndependent={onMakeQrIndependent} /> : null}
            <h3>Appearance</h3>
            {selectedLayer.type === "qr" ? (
              <>
                <div className="field-grid">
                  {layerColorControl("Foreground", selectedLayer.foreground, (color) => ({
                    foreground: color,
                  }))}
                  {layerColorControl("Background", selectedLayer.background, (color) => ({
                    background: color,
                  }))}
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
                          max="0.8"
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
                <details className="editor-disclosure"><summary>Advanced QR settings</summary>
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
                </details>
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
                  {layerColorControl("Color", selectedLayer.fill, (color) => ({ fill: color }))}
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
                        ...presetShapeGeometry(event.target.value as typeof selectedLayer.shape),
                      } as Partial<ProjectLayer>)
                    }
                  >
                    {SHAPE_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="appearance-group">
                  <div className="appearance-group-title">Fill</div>
                  <div className="field-grid">
                    <label>
                      Mode
                      <select
                        value={selectedLayer.fillMode}
                        onChange={(event) =>
                          onUpdateLayer(selectedLayer.id, {
                            fillMode: event.target.value as ShapeFillMode,
                          } as Partial<ProjectLayer>)
                        }
                      >
                        <option value="solid">Solid</option>
                        <option value="linear-gradient">Linear gradient</option>
                        <option value="radial-gradient">Radial gradient</option>
                      </select>
                    </label>
                    {layerColorControl(
                      selectedLayer.fillMode === "solid" ? "Color" : "From",
                      selectedLayer.fillMode === "solid"
                        ? selectedLayer.fill
                        : selectedLayer.fillGradientFrom,
                      (color) =>
                        selectedLayer.fillMode === "solid"
                          ? { fill: color }
                          : { fillGradientFrom: color },
                    )}
                  </div>
                  {selectedLayer.fillMode !== "solid" ? (
                    <div className="field-grid">
                      {layerColorControl("To", selectedLayer.fillGradientTo, (color) => ({
                        fillGradientTo: color,
                      }))}
                      {selectedLayer.fillMode === "linear-gradient" ? (
                        <label>
                          Angle
                          <input
                            type="number"
                            value={selectedLayer.fillGradientAngle}
                            onChange={(event) =>
                              onUpdateLayer(selectedLayer.id, {
                                fillGradientAngle: Number(event.target.value),
                              } as Partial<ProjectLayer>)
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                  <label>
                    Opacity
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
                </div>
                <div className="appearance-group">
                  <div className="appearance-group-title">Stroke</div>
                  <div className="field-grid">
                    {layerColorControl("Color", selectedLayer.stroke, (color) => ({
                      stroke: color,
                    }))}
                    <label>
                      Width
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
                  </div>
                  <label>
                    Opacity
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
                {!["rectangle", "ellipse", "pill"].includes(selectedLayer.shape) ? <details className="shape-customize">
                  <summary>Customize outline</summary>
                  <div className="field-grid">
                    {selectedLayer.shape !== "diamond" ? <label>
                      Points
                      <input
                        type="number"
                        min="3"
                        max="12"
                        value={selectedLayer.vertices}
                        onChange={(event) =>
                          onUpdateLayer(selectedLayer.id, {
                            vertices: Math.max(3, Math.min(12, Number(event.target.value))),
                          } as Partial<ProjectLayer>)
                        }
                      />
                    </label> : null}
                    <label>
                      Inner radius ({Math.round(selectedLayer.vertexInset * 100)}%)
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={selectedLayer.vertexInset}
                        {...deferredInputHandlers()}
                        onChange={(event) =>
                          transientLayerUpdate(selectedLayer.id, {
                            vertexInset: Number(event.target.value),
                          } as Partial<ProjectLayer>)
                        }
                      />
                    </label>
                  </div>
                  <div className="field-grid">
                    <label>
                      Corner rounding ({Math.round(selectedLayer.vertexRadius * 100)}%)
                      <input
                        type="range"
                        min="0"
                        max="0.45"
                        step="0.01"
                        value={selectedLayer.vertexRadius}
                        {...deferredInputHandlers()}
                        onChange={(event) =>
                          transientLayerUpdate(selectedLayer.id, {
                            vertexRadius: Number(event.target.value),
                          } as Partial<ProjectLayer>)
                        }
                      />
                    </label>
                    <label>
                      Side curve ({selectedLayer.sideDeflection.toFixed(2)})
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.05"
                        value={selectedLayer.sideDeflection}
                        {...deferredInputHandlers()}
                        onChange={(event) =>
                          transientLayerUpdate(selectedLayer.id, {
                            sideDeflection: Number(event.target.value),
                          } as Partial<ProjectLayer>)
                        }
                      />
                    </label>
                  </div>
                </details> : null}
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
            <details className="editor-disclosure" key={`position-${selectedLayer.id}`}>
              <summary>Position and size ({project.document.unit})</summary>
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
                  step="any"
                  value={displayLength(selectedLayer.x)}
                  onChange={(event) =>
                    onUpdateLayer(selectedLayer.id, { x: readLength(event.target.value) })
                  }
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  step="any"
                  value={displayLength(selectedLayer.y)}
                  onChange={(event) =>
                    onUpdateLayer(selectedLayer.id, { y: readLength(event.target.value) })
                  }
                />
              </label>
            </div>
            <div className="field-grid">
              <label>
                Width
                <input
                  type="number"
                  step="any"
                  value={displayLength(selectedLayer.width)}
                  onChange={(event) =>
                    onUpdateLayer(selectedLayer.id, { width: readLength(event.target.value) })
                  }
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  step="any"
                  value={displayLength(selectedLayer.height)}
                  onChange={(event) =>
                    onUpdateLayer(selectedLayer.id, { height: readLength(event.target.value) })
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
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={selectedLayer.shadowEnabled}
                onChange={(event) =>
                  onUpdateLayer(selectedLayer.id, {
                    shadowEnabled: event.target.checked,
                  } as Partial<ProjectLayer>)
                }
              />
              Shadow
            </label>
            {selectedLayer.shadowEnabled ? (
              <>
                <div className="field-grid">
                  {layerColorControl("Shadow color", selectedLayer.shadowColor, (color) => ({
                    shadowColor: color,
                  }))}
                  <label>
                    Shadow opacity
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedLayer.shadowOpacity}
                      {...deferredInputHandlers()}
                      onChange={(event) =>
                        transientLayerUpdate(selectedLayer.id, {
                          shadowOpacity: Number(event.target.value),
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                </div>
                <div className="field-grid">
                  <label>
                    Blur
                    <input
                      type="number"
                      min="0"
                      value={selectedLayer.shadowBlur}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          shadowBlur: Math.max(0, Number(event.target.value)),
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                  <label>
                    Offset X
                    <input
                      type="number"
                      value={selectedLayer.shadowOffsetX}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayer.id, {
                          shadowOffsetX: Number(event.target.value),
                        } as Partial<ProjectLayer>)
                      }
                    />
                  </label>
                </div>
                <label>
                  Offset Y
                  <input
                    type="number"
                    value={selectedLayer.shadowOffsetY}
                    onChange={(event) =>
                      onUpdateLayer(selectedLayer.id, {
                        shadowOffsetY: Number(event.target.value),
                      } as Partial<ProjectLayer>)
                    }
                  />
                </label>
              </>
            ) : null}
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
            </details>
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
                  step="any"
                  value={displayLength(selectedGroupBounds.x)}
                  onChange={(event) =>
                    onUpdateSelectionBounds({ x: readLength(event.target.value) })
                  }
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  step="any"
                  value={displayLength(selectedGroupBounds.y)}
                  onChange={(event) =>
                    onUpdateSelectionBounds({ y: readLength(event.target.value) })
                  }
                />
              </label>
            </div>
            <div className="field-grid">
              <label>
                Width
                <input
                  type="number"
                  step="any"
                  value={displayLength(selectedGroupBounds.width)}
                  onChange={(event) =>
                    onUpdateSelectionBounds({ width: Math.max(1, readLength(event.target.value)) })
                  }
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  step="any"
                  value={displayLength(selectedGroupBounds.height)}
                  onChange={(event) =>
                    onUpdateSelectionBounds({ height: Math.max(1, readLength(event.target.value)) })
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
      <section className="panel" data-guide="export">
        <div className="panel-title">
          <Download size={16} />
          <span>Export</span>
          <HelpTip topic="exports"/>
        </div>
        <div className="export-summary">
          <strong>{productionCount(project).total.toLocaleString()} items</strong>
          <span>{exportSetFormat === "production-pdf" ? "PRODUCTION PDF" : exportSetFormat.toUpperCase()}</span>
        </div>
        <label>
          Set format
          <select
            aria-label="Set format"
            value={exportSetFormat}
            disabled={isExporting}
            onChange={(event) =>
              onUpdateExport({
                formats: [event.target.value as ExportSetFormat],
              })
            }
          >
            <option value="png">PNG zip</option>
            <option value="jpg">JPG zip</option>
            <option value="pdf">Image PDF</option>
            <option value="production-pdf">Production PDF package</option>
          </select>
        </label>
        {exportSetFormat !== "production-pdf" ? <label className="checkbox-row">
          <input
            type="checkbox"
            checked={project.export.includeGuides}
            disabled={isExporting}
            onChange={(event) => onUpdateExport({ includeGuides: event.target.checked })}
          />
          Print guides on artwork (proofing only)
        </label> : <div className="production-preflight" aria-live="polite">
          <strong>Print handoff</strong>
          <p>Actual-size PDF with bleed, vector artwork where supported, a cut-outline reference and job report. One item per page, including every copy.</p>
          <p>RGB artwork. Your print shop sets color and media in its RIP. Machine cut setup, registration marks and roll layout are still handled there.</p>
          {productionIssues.length ? <details open={productionErrors.length > 0}>
            <summary>{productionErrors.length ? `${productionErrors.length} issue(s) to fix` : `${productionIssues.length} note(s) to review`}</summary>
            <ul>{productionIssues.map((issue, index) => <li key={`${issue.code}-${issue.layerId}-${index}`}>
              <strong>{issue.severity === "error" ? "Fix: " : "Note: "}</strong>{issue.message}
            </li>)}</ul>
          </details> : <p>Ready to export. A final rendering report is included in the ZIP.</p>}
        </div>}
        <p className="chooser-hint">The job includes every copy. The proof package contains one item and separate guide overlays.</p>
        <button className="secondary-action" disabled={isExporting} onClick={onPrintLayout}>Print layout</button>
        <button className="primary-action" onClick={onExportPng} disabled={isExporting}>
          <Download size={16} />
          {exportStatus === "template" ? "Exporting template..." : "Download proof package"}
        </button>
        <button
          className="secondary-action"
          onClick={onExportBatch}
          disabled={isExporting || productionErrors.length > 0}
        >
          <Download size={16} />
          {exportStatus === "set"
            ? "Exporting set..."
            : exportSetFormat === "production-pdf"
              ? "Download production package"
            : exportSetFormat === "pdf"
              ? "Download job PDF"
              : `Download job ${exportSetFormat.toUpperCase()} ZIP`}
        </button>
      </section>

    </aside>
  );
}
