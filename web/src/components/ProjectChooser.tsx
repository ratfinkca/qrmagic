import { useEffect, useRef, useState } from "react";
import { FilePlus2, FolderOpen, QrCode, Ticket, X } from "lucide-react";
import type { QrMagicProject } from "../types";
import { createStarterProject, type StarterKind } from "../lib/templates";

const starters = [
  { kind: "decals", title: "Numbered decals", description: "A different serial on every item", icon: Ticket },
  { kind: "poster", title: "Poster or sign", description: "One QR destination, ready to design", icon: QrCode },
  { kind: "stickers", title: "Repeated stickers", description: "One design, as many copies as you need", icon: QrCode },
  { kind: "blank", title: "Blank canvas", description: "Choose a finished size and start fresh", icon: FilePlus2 },
] as const;

export function ProjectChooser({ onCreate, onOpen, onClose, onHelp }: {
  onCreate: (project: QrMagicProject) => void; onOpen: () => void; onClose: () => void; onHelp: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<StarterKind>("decals");
  const [name, setName] = useState("");
  const [width, setWidth] = useState(101.6);
  const [height, setHeight] = useState(76.2);
  const [bleedMm, setBleed] = useState(3);
  const [records, setRecords] = useState(100);
  const [copies, setCopies] = useState(1);
  const [payload, setPayload] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);

  function selectStarter(next: StarterKind) {
    setKind(next);
    setWidth(next === "poster" ? 210 : next === "stickers" ? 50.8 : 101.6);
    setHeight(next === "poster" ? 297 : next === "stickers" ? 50.8 : 76.2);
    setCopies(1);
    setError("");
  }

  return (
    <dialog className="project-chooser" ref={dialog} onCancel={onClose} aria-labelledby="chooser-title">
      <div className="chooser-heading">
        <div><span className="chooser-eyebrow">QR MAGIC · NEW PROJECT</span><h1 id="chooser-title">What are you making?</h1></div>
        <button className="tool-button" aria-label="Close new project" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="starter-grid" role="group" aria-label="Project templates">
        {starters.map(({ kind: option, title, description, icon: Icon }) => (
          <button key={option} className={`starter-card ${kind === option ? "active" : ""}`}
            aria-pressed={kind === option} onClick={() => selectStarter(option)}>
            <Icon size={26} /><strong>{title}</strong><span>{description}</span>
          </button>
        ))}
      </div>
      <form onSubmit={event => {
        event.preventDefault();
        try {
          onCreate(createStarterProject(kind, { name, width, height, bleedMm, records, copies, payload }));
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create project."); }
      }}>
        <label>Project name<input value={name} placeholder={starters.find(starter => starter.kind === kind)?.title}
          onChange={event => setName(event.target.value)} /></label>
        <div className="chooser-fields chooser-size-fields">
          <label>Finished width (mm)<input type="number" required min="1" max="2000" step="0.1" value={width} onChange={event => setWidth(Number(event.target.value))} /></label>
          <label>Finished height (mm)<input type="number" required min="1" max="2000" step="0.1" value={height} onChange={event => setHeight(Number(event.target.value))} /></label>
        </div>
        {kind !== "blank" && kind !== "decals" ? <label>QR content<input required value={payload} placeholder="https://your-destination.com"
          onChange={event => setPayload(event.target.value)} /></label> : null}
        <div className="chooser-fields">
          {kind === "decals" ? <label>Number of serials<input type="number" required min="1" max="100000" step="1" value={records} onChange={event => setRecords(Number(event.target.value))} /></label> : null}
          <label>{kind === "decals" ? "Copies of each" : "Quantity"}<input type="number" required min="1" max="100000" step="1" value={copies} onChange={event => setCopies(Number(event.target.value))} /></label>
          <p className="chooser-count" aria-live="polite">{((kind === "decals" ? records : 1) * copies).toLocaleString()} finished items<br /><small>300 DPI · editable cut shape</small></p>
        </div>
        <details className="chooser-print-setup">
          <summary>Print setup <span>{bleedMm} mm bleed</span></summary>
          <p className="chooser-hint" id="chooser-bleed-tip">Bleed is extra artwork beyond the cut edge. Extend backgrounds into it to prevent white edges when trimming. Use your print shop’s required amount, or 0 for no bleed. You can change this later in Document settings.</p>
          <label>Bleed outside cut (mm)<input type="number" required min="0" max="25" step="0.1" value={bleedMm}
            aria-describedby="chooser-bleed-tip" onChange={event => setBleed(Number(event.target.value))} /></label>
        </details>
        {error ? <p role="alert">{error}</p> : null}
        <div className="chooser-actions">
          <button type="button" className="secondary-action" onClick={onOpen}><FolderOpen size={17} /> Open project file</button>
          <button className="primary-action" type="submit">Create project</button>
        </div>
      </form>
      <button type="button" className="chooser-help" onClick={onHelp}>Help &amp; getting started</button>
    </dialog>
  );
}
