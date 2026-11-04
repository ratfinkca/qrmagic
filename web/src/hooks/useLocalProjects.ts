import { useCallback, useEffect, useRef, useState } from "react";
import type { QrMagicProject } from "../types";
import { LocalProjectSession, localProjectRepository, type LocalProject, type RecentProject } from "../lib/localProjects";

export function useLocalProjects(project:QrMagicProject, enabled:boolean) {
  const mounted=useRef(true);
  const [,render]=useState(0);
  const [session]=useState(()=>new LocalProjectSession(localProjectRepository,()=>{if(mounted.current)render(value=>value+1);}));
  const [recent,setRecent]=useState<RecentProject[]>([]),[loading,setLoading]=useState(true),[libraryError,setLibraryError]=useState("");
  // Undoing the first edit returns to the initialProject reference, but still
  // needs saving. Engagement ends only when a different document is activated.
  const engaged=useRef(enabled);
  if(enabled)engaged.current=true;
  const latest=useRef({project,enabled});latest.current={project,enabled:engaged.current};
  const timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh=useCallback(async()=>{
    try { const entries=await localProjectRepository.list();if(mounted.current){setRecent(entries);setLibraryError("");} }
    catch { if(mounted.current)setLibraryError("Local projects are unavailable. You can still design and download project files."); }
    finally { if(mounted.current)setLoading(false); }
  },[]);
  const flush=useCallback(async()=>{
    clearTimeout(timer.current);
    if(latest.current.enabled)session.stage(latest.current.project);
    await session.flush();await refresh();
  },[refresh,session]);
  useEffect(()=>{mounted.current=true;void refresh();return()=>{mounted.current=false;clearTimeout(timer.current);};},[refresh]);
  useEffect(()=>{
    if(!engaged.current)return;
    session.stage(project);
    clearTimeout(timer.current);
    timer.current=setTimeout(()=>{void flush().catch(()=>{});},650);
    return()=>clearTimeout(timer.current);
  },[project,enabled,session,flush]);
  useEffect(()=>{
    const visibility=()=>{if(document.visibilityState==="hidden"&&session.pending)void flush().catch(()=>{});};
    const unload=(event:BeforeUnloadEvent)=>{if(session.pending){event.preventDefault();event.returnValue="";}};
    document.addEventListener("visibilitychange",visibility);window.addEventListener("beforeunload",unload);
    return()=>{document.removeEventListener("visibilitychange",visibility);window.removeEventListener("beforeunload",unload);};
  },[session,flush]);
  function activate(stored?:LocalProject) { clearTimeout(timer.current);session.activate(stored);engaged.current=Boolean(stored); }
  async function read(id:string) {
    const stored=await localProjectRepository.read(id);
    if(!stored)throw new Error("This local project is no longer available. Try opening a downloaded project file.");
    return stored;
  }
  return {recent,loading,libraryError,refresh,flush,activate,read,session,
    status:session.error ? "error" : session.saving ? "saving" : session.pending ? "pending" : session.active ? "saved" : "idle",
    savedAt:session.active?.updatedAt,
  };
}
