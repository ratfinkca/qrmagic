import { useEffect, useRef, useState } from "react";
import { FileText, FolderOpen, X } from "lucide-react";
import {
  cachedDriveToken, downloadDriveProject, driveProjectUrl, getDriveToken,
  googleDriveConfigured, listDriveProjects, pickDriveItem, prepareDriveSignIn, shareDriveProject,
  type DriveFolder, type DriveProject,
} from "../lib/googleDrive";
import { projectFilename } from "../lib/projectFilename";
import "./google-drive.css";

type Props = {
  online: boolean;
  openOnly: boolean;
  file?: DriveProject;
  defaultFilename: string;
  onSave: (token: string, filename: string, folder?: DriveFolder) => Promise<DriveProject>;
  onOpen: (content: string, file: DriveProject) => Promise<boolean>;
  onClose: () => void;
};

export function GoogleDriveDialog({ online, openOnly, file, defaultFilename, onSave, onOpen, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"projects" | "save">("projects");
  const [projects, setProjects] = useState<DriveProject[]>();
  const [query, setQuery] = useState("");
  const [filename, setFilename] = useState(defaultFilename);
  const [folder, setFolder] = useState<DriveFolder>();
  const matches = projects?.filter(project => project.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);

  useEffect(() => {
    if (!online || !googleDriveConfigured) return;
    let active = true;
    async function prepare() {
      setError("");
      try {
        await prepareDriveSignIn();
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : "Could not load Google Drive.");
        return;
      }
      try {
        const token = cachedDriveToken();
        if (token && active) {
          const items = await listDriveProjects(token);
          if (active) setProjects(items);
        }
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : "Could not load Drive projects.");
      } finally {
        if (active) setReady(true);
      }
    }
    void prepare();
    return () => { active = false; };
  }, [loadAttempt, online]);

  async function run(action: (token: string) => Promise<void>) {
    if (!navigator.onLine || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const token = await getDriveToken();
      if (navigator.onLine) await action(token);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Google Drive could not complete the request.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function choose(token: string, kind: "project" | "folder") {
    const modal = dialog.current;
    // Google renders its picker outside this dialog. Closing it removes the
    // browser's modal focus trap while Google owns the interaction.
    try {
      return await pickDriveItem(token, kind, () => modal?.close());
    } finally {
      if (modal?.isConnected && !modal.open) modal.showModal();
    }
  }

  async function open(token: string, selected: DriveProject) {
    const content = await downloadDriveProject(token, selected);
    if (await onOpen(content, selected)) onClose();
  }

  async function save(token: string) {
    const name = filename.trim();
    if (!name) throw new Error("Enter a filename for the Drive copy.");
    const fullName = projectFilename(name);
    const saved = await onSave(token, fullName, folder);
    setFilename(fullName);
    setProjects(items => items && [saved, ...items.filter(item => item.id !== saved.id)]);
    setStatus(folder ? `Project copy saved in ${folder.name}.` : "Project copy saved to My Drive.");
  }

  function show(view: "projects" | "save") {
    setView(view);
    if (ready) setError("");
    setStatus("");
  }

  return <dialog ref={dialog} className="drive-dialog" aria-labelledby="drive-title" onCancel={event => {
    event.preventDefault();
    if (!online || !busyRef.current) onClose();
  }}>
    <header className="help-header">
      <div><span className="help-eyebrow">PROJECT FILES</span><h1 id="drive-title">Google Drive</h1>
        <p>{openOnly ? "Choose an editable project from Drive." : "Open a project from Drive or save a copy of this design. Local autosave continues on this device."}</p></div>
      <button type="button" className="help-icon-button" aria-label="Close Google Drive" onClick={onClose} disabled={online && busy}><X size={22}/></button>
    </header>
    <div className="drive-dialog-body">
      {!online ? <div role="status"><p>Google Drive needs an internet connection.</p><p>You can still open local projects, save and export offline.</p></div>
      : !googleDriveConfigured ? <p role="status">Google Drive setup is required for this version of QR Mystic. You can still save and open project files on this device.</p> : <>
        {!openOnly && <div className="project-views drive-views" role="group" aria-label="Google Drive action">
          <button type="button" aria-pressed={view === "projects"} disabled={busy} onClick={() => show("projects")}>Drive Projects</button>
          <button type="button" aria-pressed={view === "save"} disabled={busy} onClick={() => show("save")}>Save to Drive</button>
        </div>}
        {!ready && !error && <p role="status">Connecting to Google Drive…</p>}
        {!ready && error && <button type="button" className="secondary-action" onClick={() => {
          setError("");
          setLoadAttempt(count => count + 1);
        }}>Retry Google Drive</button>}
        {view === "projects" ? <section className="drive-projects" aria-label="Drive Projects">
          <p>See projects saved to Drive or previously opened with this app.</p>
          <div className="drive-actions">
            <button type="button" className="secondary-action" disabled={!ready || busy} onClick={() => void run(async token => {
              setProjects(await listDriveProjects(token));
            })}>{projects ? "Refresh list" : "Show Drive projects"}</button>
            <button type="button" className="secondary-action" disabled={!ready || busy} onClick={() => void run(async token => {
              const selected = await choose(token, "project");
              if (selected) await open(token, selected);
            })}><FolderOpen size={16}/> Browse Drive</button>
          </div>
          {matches && <>
            <label>Search Drive projects<input type="search" placeholder="Find by filename" value={query} onChange={event => setQuery(event.target.value)}/></label>
            {matches.length ? <ul className="drive-project-list">{matches.map(project => <li key={project.id}>
              <button type="button" disabled={busy} onClick={() => void run(token => open(token, project))}>
                <FileText size={17} aria-hidden="true"/>
                <span>{project.name}</span>
                {project.modifiedTime && <time dateTime={project.modifiedTime}>{new Date(project.modifiedTime).toLocaleDateString()}</time>}
              </button>
            </li>)}</ul> : <p role="status">{query.trim() ? "No matching Drive projects." : "No projects yet. Use Browse Drive to open one."}</p>}
          </>}
        </section> : <form className="drive-save" onSubmit={event => {
          event.preventDefault();
          if (ready && filename.trim()) void run(save);
        }}>
          <label>Filename<input value={filename} disabled={busy} required onChange={event => setFilename(event.target.value)}/></label>
          <div className="drive-folder">
            <p><strong>Save in</strong> {folder?.name ?? "My Drive"}</p>
            <div className="drive-actions">
              <button type="button" className="secondary-action" disabled={!ready || busy} onClick={() => void run(async token => {
                const selected = await choose(token, "folder");
                if (selected) setFolder(selected);
              })}><FolderOpen size={16}/> Choose folder</button>
              {folder && <button type="button" className="secondary-action" disabled={busy} onClick={() => setFolder(undefined)}>Use My Drive</button>}
            </div>
          </div>
          <button type="submit" className="primary-action" disabled={!ready || busy || !filename.trim()}>Save a copy</button>
        </form>}
        {busy && <p role="status">Working with Google Drive…</p>}
        {status && <p role="status">{status}</p>}
        {file && !openOnly && <section className="drive-file" aria-label="Drive project file">
          <strong>{file.name}</strong>
          <div className="drive-actions">
            <button type="button" className="secondary-action" disabled={!ready || busy} onClick={() => void run(async token => {
              try {
                await shareDriveProject(token, file, () => dialog.current?.close());
                onClose();
              } catch (failure) {
                if (dialog.current?.isConnected && !dialog.current.open) dialog.current.showModal();
                throw failure;
              }
            })}>Share Drive file</button>
            <a href={driveProjectUrl(file)} target="_blank" rel="noopener noreferrer">Open file in Drive</a>
          </div>
          <p>If the sharing window is blocked, open the file in Drive and share it there.</p>
        </section>}
      </>}
      {online && error && <p className="drive-error" role="alert">{error}</p>}
    </div>
  </dialog>;
}
