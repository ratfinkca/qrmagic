import type { QrMagicProject } from "../types";
import { projectForEditor } from "./projectValidation";

export const LOCAL_PROJECT_DB = "qrmagic-local-projects";
export type LocalProject = {
  id:string; revision:number; createdAt:number; updatedAt:number; project:QrMagicProject; forkedFrom?:string;
};
export type RecentProject = Omit<LocalProject,"project"> & {
  name:string; width:number; height:number; unit:QrMagicProject["document"]["unit"];
};
export interface ProjectRepository {
  list():Promise<RecentProject[]>;
  read(id:string):Promise<LocalProject | undefined>;
  write(next:LocalProject, expectedRevision:number|null):Promise<LocalProject>;
}
export class RevisionConflict extends Error {
  constructor() { super("This project changed in another tab."); }
}
function metadata({project,...meta}:LocalProject):RecentProject {
  return {...meta,name:project.document.name,width:project.document.width,height:project.document.height,unit:project.document.unit};
}

let connection:Promise<IDBDatabase> | undefined;
function database():Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve,reject) => {
    if (!globalThis.indexedDB) { reject(new Error("Browser storage is unavailable.")); return; }
    const request=indexedDB.open(LOCAL_PROJECT_DB,1);
    let abandoned=false;
    const timer=setTimeout(()=>{abandoned=true;reject(new Error("Browser storage took too long to open."));},5000);
    request.onupgradeneeded=()=>{
      const db=request.result;
      db.createObjectStore("projects",{keyPath:"id"});
      db.createObjectStore("recent",{keyPath:"id"});
    };
    request.onerror=()=>{clearTimeout(timer);reject(request.error);};
    request.onblocked=()=>{clearTimeout(timer);abandoned=true;reject(new Error("Another tab is blocking browser storage. Close that tab and retry."));};
    request.onsuccess=()=>{
      clearTimeout(timer);const db=request.result;
      if (abandoned) { db.close();return; }
      db.onversionchange=()=>{db.close();connection=undefined;};
      db.onclose=()=>{connection=undefined;};
      resolve(db);
    };
  }).catch(error=>{connection=undefined;throw error;});
  return connection;
}

export const localProjectRepository:ProjectRepository = {
  async list() {
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction("recent","readonly"),request=tx.objectStore("recent").getAll();
      tx.oncomplete=()=>resolve((request.result as RecentProject[]).filter(item=>
        item&&typeof item.id==="string"&&typeof item.name==="string"&&
        Number.isFinite(new Date(item.updatedAt).getTime())&&
        Number.isFinite(item.width)&&Number.isFinite(item.height)&&["in","mm","px"].includes(item.unit)
      ).sort((a,b)=>b.updatedAt-a.updatedAt));
      tx.onabort=()=>reject(tx.error??new Error("Could not read recent projects."));
    });
  },
  async read(id) {
    const db=await database();
    const stored=await new Promise<LocalProject|undefined>((resolve,reject)=>{
      const tx=db.transaction("projects","readonly"),request=tx.objectStore("projects").get(id);
      tx.oncomplete=()=>resolve(request.result);
      tx.onabort=()=>reject(tx.error??new Error("Could not open the local project."));
    });
    if (!stored) return undefined;
    try {
      if (stored.id!==id || !Number.isInteger(stored.revision) || stored.revision<1 || ![1,2].includes(stored.project?.version)) throw new Error();
      const project=projectForEditor(stored.project);
      return {...stored,project};
    } catch { throw new Error("This local copy could not be read. Try opening a downloaded project file. Your other local projects are still available."); }
  },
  async write(next,expectedRevision) {
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(["projects","recent"],"readwrite");
      const store=tx.objectStore("projects"),request=store.get(next.id);
      let conflict=false, failure:unknown;
      const saved={...next,revision:(expectedRevision??0)+1};
      request.onsuccess=()=>{
        if ((request.result?.revision??null)!==expectedRevision) { conflict=true;tx.abort();return; }
        try { store.put(saved);tx.objectStore("recent").put(metadata(saved)); }
        catch(error) { failure=error;tx.abort(); }
      };
      // Request success is insufficient: both records must commit atomically.
      tx.oncomplete=()=>resolve(saved);
      tx.onabort=()=>reject(conflict ? new RevisionConflict() : failure??tx.error??new Error("Local save was interrupted."));
    });
  },
};

/** One editing session. Local identity never enters the portable project model. */
export class LocalProjectSession {
  active:Omit<LocalProject,"project"> | undefined;
  forked=false;
  saving=false;
  error="";
  private queued:QrMagicProject | undefined;
  private saved:QrMagicProject | undefined;
  private tail:Promise<void>=Promise.resolve();
  constructor(private repository:ProjectRepository, private changed:()=>void=()=>{}) {}
  get pending() { return this.queued!==undefined || this.saving; }
  activate(stored?:LocalProject) {
    if (this.pending) throw new Error("Flush pending changes before switching projects.");
    if (stored) { const {project:unused,...meta}=stored;this.active=meta; }
    else this.active=undefined;
    this.saved=stored?.project;this.forked=false;this.error="";this.changed();
  }
  stage(project:QrMagicProject) {
    if (project===this.saved && !this.pending) return;
    this.queued=project;this.changed();
  }
  discardPending() { if (this.saving) throw new Error("A save is still in progress.");this.queued=undefined;this.error="";this.changed(); }
  flush():Promise<void> {
    const work=this.tail.catch(()=>{}).then(async()=>{
      while(this.queued) {
        const project=this.queued;this.queued=undefined;
        if (project===this.saved) { this.error="";continue; }
        this.saving=true;this.error="";this.changed();
        const now=Date.now();
        const next:LocalProject={...this.active,id:this.active?.id??crypto.randomUUID(),revision:this.active?.revision??0,createdAt:this.active?.createdAt??now,updatedAt:now,project};
        try {
          let stored:LocalProject;
          try { stored=await this.repository.write(next,this.active?.revision??null); }
          catch(error) {
            if (!(error instanceof RevisionConflict)) throw error;
            stored=await this.repository.write({...next,id:crypto.randomUUID(),createdAt:now,revision:0,forkedFrom:next.id},null);this.forked=true;
          }
          const {project:unused,...meta}=stored;this.active=meta;this.saved=project;
        } catch(error) {
          this.queued??=project;this.error=error instanceof Error?error.message:"Local save failed.";throw error;
        } finally { this.saving=false;this.changed(); }
      }
      this.changed();
    });
    this.tail=work;return work;
  }
}
