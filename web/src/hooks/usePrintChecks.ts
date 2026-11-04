import { useEffect, useMemo, useState } from "react";
import type { QrMagicProject } from "../types";
import { productionPreflight, type ProductionIssue } from "../lib/productionPdfModel";

export type PrintCheckState={issues:ProductionIssue[];checking:boolean;unavailable:boolean};
export function usePrintChecks(project:QrMagicProject,format:string):PrintCheckState {
  const basic=useMemo(()=>productionPreflight(project),[project]);
  const [result,setResult]=useState<{project:QrMagicProject;format:string;issues:ProductionIssue[];unavailable:boolean}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      void import("../lib/printQuality").then(module=>module.analyzePrintProject(project,{format,signal:controller.signal}))
        .then(issues=>{if(!controller.signal.aborted)setResult({project,format,issues,unavailable:false});})
        .catch(()=>{if(!controller.signal.aborted)setResult({project,format,issues:basic,unavailable:true});});
    },300);
    return()=>{clearTimeout(timer);controller.abort();};
  },[project,format,basic]);
  // Never display old-document measurements or a stale "no issues" result.
  const current=result?.project===project&&result.format===format;
  return current?{issues:result.issues,checking:false,unavailable:result.unavailable}:{issues:basic,checking:true,unavailable:false};
}
