import { useEffect, useRef, useState } from "react";
import { Cloud, Copy, FilePlus2, FolderOpen, QrCode, Ticket, X } from "lucide-react";
import type { RecentProject } from "../lib/localProjects";
import "./local-projects.css";
import type { QrMagicProject } from "../types";
import { createStarterProject, type StarterKind } from "../lib/templates";

const starters = [
  { kind: "decals", title: "Numbered decals", description: "A different serial on every item", icon: Ticket },
  { kind: "poster", title: "Poster or sign", description: "One QR destination, ready to design", icon: QrCode },
  { kind: "stickers", title: "Repeated stickers", description: "One design, as many copies as you need", icon: QrCode },
  { kind: "blank", title: "Blank canvas", description: "Choose a finished size and start fresh", icon: FilePlus2 },
] as const;

export function ProjectChooser({ onCreate, onOpen, onOpenDrive, suspended, onClose, onHelp, recent, loading, storageError, initialView, busy, onRecent, onRetry }: {
  onCreate: (project: QrMagicProject) => void; onOpen: () => void; onClose: () => void; onHelp: () => void;
  onOpenDrive: () => void; suspended: boolean;
  recent:RecentProject[];loading:boolean;storageError:string;initialView:"new"|"auto"|"recent";busy:boolean;
  onRecent:(id:string,duplicate:boolean)=>void;onRetry:()=>void;
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
  const [view,setView]=useState(initialView);
  const [query,setQuery]=useState("");
  const activeView=view==="auto"?(loading||recent.length>0?"recent":"new"):view;
  const matching=recent.filter(item=>item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(() => {
    const opener=document.activeElement as HTMLElement|null,modal=dialog.current;
    return()=>{modal?.close();if(opener?.isConnected)opener.focus();};
  }, []);
  useEffect(() => {
    if (suspended) dialog.current?.close();
    else dialog.current?.showModal();
  }, [suspended]);

  function selectStarter(next: StarterKind) {
    setKind(next);
    setWidth(next === "poster" ? 210 : next === "stickers" ? 50.8 : 101.6);
    setHeight(next === "poster" ? 297 : next === "stickers" ? 50.8 : 76.2);
    setCopies(1);
    setError("");
  }

  return (
    <dialog className="project-chooser" ref={dialog} onCancel={event=>{event.preventDefault();if(!busy)onClose();}} aria-labelledby="chooser-title" aria-busy={busy}>
      <div className="chooser-heading">
        <div><span className="chooser-eyebrow">QR MAGIC · YOUR WORKSPACE</span><h1 id="chooser-title">What are you making?</h1></div>
        <button className="tool-button" aria-label="Close new project" disabled={busy} onClick={onClose}><X size={20} /></button>
      </div>
      <div className="project-views" role="group" aria-label="Project chooser view"><button type="button" disabled={busy} aria-pressed={activeView==="recent"} onClick={()=>setView("recent")}>Recent projects {recent.length?<span>{recent.length}</span>:null}</button><button type="button" disabled={busy} aria-pressed={activeView==="new"} onClick={()=>setView("new")}>New project</button></div>
      {storageError?<div className="local-library-error" role="status"><p>{storageError}</p><button type="button" onClick={onRetry}>Retry project storage</button></div>:null}
      {activeView==="recent"?<section className="recent-projects" aria-label="Recent projects">
        <div className="recent-heading"><h2>Pick up where you left off</h2><p>Saved automatically in this browser, on this device.</p></div>
        {loading?<p role="status">Loading local projects…</p>:recent.length?<>
          <label className="recent-search">Search recent projects<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a design by name…"/></label>
          <div className="recent-list">{matching.map(item=><article className="recent-card" key={item.id}>
            <div className="recent-artwork" aria-hidden="true"><QrCode size={25}/></div><div className="recent-description"><h3>{item.name||"Untitled design"}</h3><p id={`local-card-${item.id}`}>{item.width} × {item.height} {item.unit}<span> · </span><time dateTime={new Date(item.updatedAt).toISOString()}>Saved {new Date(item.updatedAt).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</time>{item.forkedFrom?<small className="recent-forked">Separate tab copy</small>:null}</p></div>
            <div className="recent-actions"><button type="button" className="primary-action" disabled={busy} aria-label={`Open ${item.name}`} aria-describedby={`local-card-${item.id}`} onClick={()=>onRecent(item.id,false)}>Open</button><button type="button" className="recent-duplicate" disabled={busy} aria-label={`Duplicate ${item.name}`} aria-describedby={`local-card-${item.id}`} onClick={()=>onRecent(item.id,true)}><Copy size={14}/> Duplicate</button></div>
          </article>)}</div>{!matching.length?<p role="status">No projects match that name.</p>:null}
        </>:<div className="recent-empty"><FolderOpen size={34}/><h3>Your next design starts here</h3><p>Create a project or open a project file. Edits will be saved here automatically when local storage is available.</p><button type="button" className="primary-action" onClick={()=>setView("new")}>Start a new project</button></div>}
        <p className="local-storage-note">Local saves are not cloud backups. Download a project file to keep a separate copy or share it. Clearing this site’s browser data removes local projects.</p>
        <div className="drive-actions">
          <button type="button" className="secondary-action" disabled={busy} onClick={onOpen}><FolderOpen size={17}/> Open project file</button>
          <button type="button" className="secondary-action" disabled={busy} onClick={onOpenDrive}><Cloud size={17}/> Open from Google Drive</button>
        </div>
      </section>:<>
      <div className="starter-grid" role="group" aria-label="Project templates">
        {starters.map(({ kind: option, title, description, icon: Icon }) => (
          <button key={option} className={`starter-card ${kind === option ? "active" : ""}`}
            disabled={busy} aria-pressed={kind === option} onClick={() => selectStarter(option)}>
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
        <fieldset className="chooser-form-fields" disabled={busy}>
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
          <div className="drive-actions">
            <button type="button" className="secondary-action" onClick={onOpen}><FolderOpen size={17} /> Open project file</button>
            <button type="button" className="secondary-action" onClick={onOpenDrive}><Cloud size={17}/> Open from Google Drive</button>
          </div>
          <button className="primary-action" type="submit">Create project</button>
        </div>
        </fieldset>
      </form>
      </>}
      {busy?<p role="status">Saving your current work and opening the project…</p>:null}
      <button type="button" className="chooser-help" disabled={busy} onClick={onHelp}>Help &amp; getting started</button>
    </dialog>
  );
}
