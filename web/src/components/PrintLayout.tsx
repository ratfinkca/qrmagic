import { useEffect, useMemo, useRef, useState } from "react";
import type { PrintLayoutSettings, QrMagicProject } from "../types";
import { calculateLayout, defaultLayoutSettings, layoutPanel } from "../lib/printLayout";
import { productionCount } from "../lib/production";
import { productionPreflight } from "../lib/productionPdfModel";
import type { ExportProgress } from "../lib/exportControl";
import { PrintLayoutPreview } from "./PrintLayoutPreview";
import "./print-layout.css";

type Props={project:QrMagicProject;onChange:(settings:PrintLayoutSettings)=>void;onBack:()=>void;onSave:()=>void};
const presets:Record<string,[number,number]>={letter:[215.9,279.4],a4:[210,297],a3:[297,420]};
type NumericSetting="widthMm"|"heightMm"|"marginTop"|"marginRight"|"marginBottom"|"marginLeft"|"gapX"|"gapY";

export function PrintLayout({project,onChange,onBack,onSave}:Props) {
  const settings=useMemo(()=>project.production.layout??defaultLayoutSettings(),[project.production.layout]);
  const [panelIndex,setPanelIndex]=useState(0),[progress,setProgress]=useState<ExportProgress|null>(null),[message,setMessage]=useState("");
  const controller=useRef<AbortController|null>(null);
  const busy=progress!==null;
  useEffect(()=>()=>controller.current?.abort(),[]);
  const calculation=useMemo(()=>{try{return {plan:calculateLayout(project,settings),error:""};}catch(e){return {plan:undefined,error:e instanceof Error?e.message:"Invalid layout settings."};}},[project,settings]);
  const plan=calculation.plan;
  const safeIndex=plan?Math.min(panelIndex,plan.panelCount-1):0;
  const panel=plan?layoutPanel(plan,safeIndex):undefined;
  const issues=useMemo(()=>productionPreflight(project),[project]);
  const errors=issues.filter(i=>i.severity==="error");
  const count=productionCount(project),unit=settings.units==="in"?25.4:1;
  const patch=(value:Partial<PrintLayoutSettings>)=>{setPanelIndex(0);onChange({...settings,...value});};
  function numeric(key:NumericSetting,label:string) {
    const value=settings[key];
    return <label className="layout-field">{label}<div className="layout-number"><input aria-label={label} type="number" step="any" value={Number.isFinite(value)?Number((value/unit).toFixed(6)):""}
      onChange={e=>patch({[key]:e.target.value===""?NaN:Number(e.target.value)*unit})}/><span>{settings.units}</span></div></label>;
  }
  async function download() {
    if(controller.current||!plan||errors.length)return;
    const abort=new AbortController();controller.current=abort;setMessage("");setProgress({stage:"artwork",completed:0,total:count.records});
    try {
      const {exportLayoutPackage}=await import("../lib/printLayoutExport");
      const blob=await exportLayoutPackage(project,settings,{signal:abort.signal,onProgress:setProgress});
      abort.signal.throwIfAborted();
      const link=document.createElement("a"),url=URL.createObjectURL(blob);link.href=url;
      link.download=`${project.document.name.replace(/[^a-z0-9_-]/gi,"-")||"qrmagic"}-print-layout.zip`;
      link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("Layout package downloaded.");
    }catch(e){setMessage(e instanceof DOMException&&e.name==="AbortError"?"Export cancelled. Your layout settings are kept.":e instanceof Error?e.message:"Could not export layout.");}
    finally{controller.current=null;setProgress(null);}
  }
  const uniform=[settings.marginTop,settings.marginRight,settings.marginBottom].every(v=>v===settings.marginLeft);
  return <main className="print-layout-workspace">
    <header className="layout-header"><strong>▦ QR Magic</strong><span>Design <b>› Print layout</b> › Download</span><button disabled={busy} onClick={onSave}>Save project</button></header>
    <div className="layout-content"><div className="layout-heading"><div><button aria-label="Back to design" className="layout-back" disabled={busy} onClick={onBack}>← Back to design</button><h1>Print layout</h1><p>Arrange your artwork at its finished size.</p></div>
      <div className="layout-job"><strong>{project.document.name}</strong><span>{count.records.toLocaleString()} {count.records===1?"record":"records"} × {count.copiesPerRecord.toLocaleString()} copies · {count.total.toLocaleString()} items</span></div></div>
    <div className="layout-columns">
      <fieldset disabled={busy} className="layout-card layout-settings"><legend>Media & arrangement</legend>
        <div className="layout-media-toggle"><button type="button" aria-pressed={settings.media==="roll"} onClick={()=>patch({media:"roll"})}>Roll</button><button type="button" aria-pressed={settings.media==="sheet"} onClick={()=>patch({media:"sheet"})}>Sheet</button></div>
        <label className="layout-field">Units<select aria-label="Layout units" value={settings.units} onChange={e=>patch({units:e.target.value as "mm"|"in"})}><option value="mm">mm</option><option value="in">in</option></select></label>
        {settings.media==="sheet"?<label className="layout-field">Sheet preset<select aria-label="Sheet preset" value={Object.keys(presets).find(key=>presets[key][0]===settings.widthMm&&presets[key][1]===settings.heightMm)??"custom"}
          onChange={e=>{const size=presets[e.target.value];if(size)patch({widthMm:size[0],heightMm:size[1]});}}><option value="custom">Custom</option><option value="letter">US Letter</option><option value="a4">A4</option><option value="a3">A3</option></select></label>:null}
        {numeric("widthMm",settings.media==="roll"?"Roll width":"Sheet width")}
        {numeric("heightMm",settings.media==="roll"?"Maximum panel length":"Sheet height")}
        <p className="layout-help">{settings.media==="roll"?"Panels use only the length needed, up to this maximum.":"Every PDF page keeps this sheet size."}</p>
        <hr/><h2>Clearance</h2>
        <label className="layout-field">Margins · all edges<div className="layout-number"><input aria-label="All margins" type="number" step="any" value={uniform&&Number.isFinite(settings.marginLeft)?Number((settings.marginLeft/unit).toFixed(6)):""} placeholder={uniform?"":"Mixed"}
          onChange={e=>{const v=e.target.value===""?NaN:Number(e.target.value)*unit;patch({marginTop:v,marginRight:v,marginBottom:v,marginLeft:v});}}/><span>{settings.units}</span></div></label>
        <details className="layout-details"><summary>Set each edge separately</summary>{numeric("marginTop","Top margin")}{numeric("marginRight","Right margin")}{numeric("marginBottom","Bottom margin")}{numeric("marginLeft","Left margin")}</details>
        <div className="layout-field-pair">{numeric("gapX","Horizontal gap")}{numeric("gapY","Vertical gap")}</div>
        <p className="layout-help">Gaps are clear space between bleed areas. Every item already includes its bleed.</p>
        <hr/><label className="layout-field">Orientation<select aria-label="Layout orientation" value={settings.orientation} onChange={e=>patch({orientation:e.target.value as PrintLayoutSettings["orientation"]})}>
          <option value="best">Best fit</option><option value="original">As designed</option><option value="rotated">Rotate 90° clockwise</option></select></label>
        <p className="layout-help">Best fit minimizes material use. Artwork stays at 100% size.</p>
        <button className="layout-reset" onClick={()=>{setPanelIndex(0);onChange(defaultLayoutSettings());}}>Reset layout</button>
      </fieldset>
      <div className="layout-preview-column">{calculation.error?<div className="layout-card layout-error" role="alert"><h2>Check the layout</h2><p>{calculation.error}</p></div>:plan?<PrintLayoutPreview project={project} plan={plan} panelIndex={safeIndex} onPanelChange={setPanelIndex}/>:null}</div>
      <aside className="layout-card layout-summary"><div className="layout-summary-scroll"><h2>Job summary</h2>{plan&&panel?<>
        <div className="layout-stats"><div><strong>{plan.total.toLocaleString()}</strong><small>finished items</small></div><div><strong>{plan.panelCount.toLocaleString()}</strong><small>{settings.media==="roll"?"PDF panels":"sheets"}</small></div><div><strong>{plan.columns} × {plan.rows}</strong><small>full-panel grid</small></div><div><strong>{Math.min(plan.capacity,plan.total).toLocaleString()}</strong><small>items on a full panel</small></div></div>
        <div className="layout-material"><small>{settings.media==="roll"?"Estimated roll length":"Total sheet area"}</small><strong>{settings.media==="roll"?`${(plan.totalLengthMm/1000).toFixed(3)} m`:`${(plan.totalAreaMm2/1e6).toFixed(3)} m²`}</strong><small>Includes margins on every {settings.media==="roll"?"panel":"sheet"}.</small></div>
        <p className="layout-help">Add your shop’s extra feed, testing and registration allowance to the margins.</p>
        <dl><div><dt>Finished size</dt><dd>{plan.trimWidthMm.toFixed(2)} × {plan.trimHeightMm.toFixed(2)} mm</dd></div><div><dt>Bleed per item</dt><dd>{plan.bleedMm} mm</dd></div><div><dt>Rotation</dt><dd>{plan.rotation}° clockwise</dd></div><div><dt>Current panel</dt><dd>{panel.widthMm.toFixed(2)} × {panel.heightMm.toFixed(2)} mm</dd></div><div><dt>Artwork scale</dt><dd>100% · unchanged</dd></div></dl>
      </>:<p className="layout-help">Correct the settings to calculate a layout.</p>}
        <hr/><h2>Production package</h2><p className="layout-help">Actual-size layout PDF<br/>Cut-reference SVG per panel<br/>Placement CSV + job report</p>
        <p className="layout-help">Generic RGB handoff. Machine cuts and registration stay in the RIP until your shop profile is validated.</p>
        {issues.length?<details className="layout-details" open={errors.length>0}><summary>{errors.length?`${errors.length} issue(s) to fix`:`${issues.length} preflight note(s)`}</summary><ul>{issues.map((issue,i)=><li key={i}>{issue.message}</li>)}</ul></details>:null}
        </div><div className="layout-export-actions"><button className="layout-download" disabled={busy||!plan||errors.length>0} onClick={download}>Download layout package</button>
        {progress?<div className="layout-export-progress" role="status"><p>{progress.stage==="artwork"?"Rendering records":progress.stage==="panels"?"Arranging panels":"Preparing ZIP"}: {progress.completed} / {progress.total}</p><progress value={progress.completed} max={progress.total}/><button onClick={()=>controller.current?.abort()}>Cancel export</button></div>:null}
        {message?<p className="layout-feedback" role="status">{message}</p>:null}</div>
      </aside>
    </div></div>
  </main>;
}
