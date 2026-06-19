import { useEffect, useRef, useState } from "react";
import { Pipette, Plus, X } from "lucide-react";
import { HexColorInput, HexColorPicker } from "react-colorful";

type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

type ColorControlProps = {
  label: string;
  value: string;
  disabled?: boolean;
  recentColors: string[];
  paletteColors: string[];
  onChange: (color: string) => void;
  onChangeEnd?: (color: string) => void;
  onSaveColor: (color: string) => void;
  onRemoveColor: (color: string) => void;
};

function normalizeHex(color: string) {
  const normalized = color.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : "#000000";
}

function swatchButton(
  color: string,
  title: string,
  onClick: () => void,
  extraClass = "",
  disabled = false,
) {
  return (
    <button
      type="button"
      className={`color-swatch ${extraClass}`}
      title={title}
      style={{ background: color }}
      onClick={onClick}
      disabled={disabled}
    />
  );
}

export function ColorControl({
  label,
  value,
  disabled = false,
  recentColors,
  paletteColors,
  onChange,
  onChangeEnd,
  onSaveColor,
  onRemoveColor,
}: ColorControlProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"down" | "up">("down");
  const [alignment, setAlignment] = useState<"left" | "right">("left");
  const [eyeDropperSupported, setEyeDropperSupported] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const color = normalizeHex(value);
  const isSaved = paletteColors.includes(color);

  useEffect(() => {
    setEyeDropperSupported(typeof window !== "undefined" && "EyeDropper" in window);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!controlRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function applyColor(nextColor: string, commit = false) {
    const normalized = normalizeHex(nextColor);
    onChange(normalized);
    if (commit) {
      onChangeEnd?.(normalized);
    }
  }

  async function pickFromScreen() {
    const EyeDropperApi = (window as unknown as { EyeDropper?: EyeDropperConstructor })
      .EyeDropper;
    if (!EyeDropperApi) return;

    try {
      const result = await new EyeDropperApi().open();
      applyColor(result.sRGBHex, true);
    } catch {
      // The user can cancel the eyedropper; no state change is needed.
    }
  }

  function togglePopover() {
    const rect = controlRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const spaceRight = window.innerWidth - rect.left;
      setPlacement(spaceBelow < 460 && spaceAbove > spaceBelow ? "up" : "down");
      setAlignment(spaceRight < 268 ? "right" : "left");
    }
    setOpen((current) => !current);
  }

  return (
    <div className="color-control" ref={controlRef}>
      <span className="color-control-label">{label}</span>
      <button
        type="button"
        className="color-trigger"
        aria-label={`${label} ${color}`}
        title={color}
        onClick={togglePopover}
        disabled={disabled}
      >
        <span className="color-trigger-value">{color}</span>
        <span className="color-preview" style={{ background: color }} />
      </button>
      {open ? (
        <div
          className={`color-popover ${placement === "up" ? "open-up" : ""} ${
            alignment === "right" ? "align-right" : ""
          }`}
        >
          <HexColorPicker color={color} onChange={onChange} onChangeEnd={onChangeEnd} />
          <label>
            Hex
            <HexColorInput
              color={color}
              onChange={(nextColor) => applyColor(nextColor, true)}
              prefixed
            />
          </label>
          <div className="color-actions">
            <button
              type="button"
              className="secondary-action compact-action"
              onClick={pickFromScreen}
              disabled={!eyeDropperSupported}
              title={
                eyeDropperSupported
                  ? "Pick color from screen"
                  : "Eyedropper is not available in this browser"
              }
            >
              <Pipette size={15} />
              Pick
            </button>
            <button
              type="button"
              className="secondary-action compact-action"
              onClick={() => onSaveColor(color)}
              disabled={isSaved}
            >
              <Plus size={15} />
              Save
            </button>
          </div>
          {recentColors.length ? (
            <div className="color-section">
              <div className="color-section-title">Recent</div>
              <div className="color-swatch-grid">
                {recentColors.map((recentColor) => (
                  <span className="recent-color" key={recentColor}>
                    {swatchButton(recentColor, `Use ${recentColor}`, () =>
                      applyColor(recentColor, true),
                    )}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="color-section">
            <div className="color-section-title">Saved</div>
            <div className="color-swatch-grid">
              {paletteColors.map((paletteColor) => (
                <div className="saved-color" key={paletteColor}>
                  {swatchButton(paletteColor, `Use ${paletteColor}`, () =>
                    applyColor(paletteColor, true),
                  )}
                  <button
                    type="button"
                    className="remove-swatch"
                    title={`Remove ${paletteColor}`}
                    onClick={() => onRemoveColor(paletteColor)}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
