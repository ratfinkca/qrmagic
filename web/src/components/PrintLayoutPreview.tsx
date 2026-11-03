import { useEffect, useMemo, useRef, useState } from "react";
import type { QrMagicProject } from "../types";
import { layoutPanel, type LayoutPlan } from "../lib/printLayout";
import { createDataRecords } from "../lib/serial";
import { renderProjectPngBlob } from "../lib/exportRenderer";
import { outlinePath } from "../lib/productionPdfModel";
import { exportYield } from "../lib/exportControl";

export function PrintLayoutPreview({project,plan,panelIndex,onPanelChange}:{project:QrMagicProject;plan:LayoutPlan;panelIndex:number;onPanelChange:(index:number)=>void}) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const viewportRef=useRef<HTMLDivElement>(null);
  const [viewport,setViewport]=useState({width:560,height:500});
  const [zoom,setZoom]=useState(1),[cuts,setCuts]=useState(true),[bleed,setBleed]=useState(true);
  const [status,setStatus]=useState("");
  const panel=useMemo(()=>layoutPanel(plan,panelIndex),[plan,panelIndex]);
  // Layout-only edits retain cached record artwork. Never allocate a full-DPI media canvas.
  const source=useMemo(()=>project,[project.layers,project.document,project.data]);
  const records=useMemo(()=>createDataRecords(source.data.groups),[source.data.groups]);
  const thumbnails=useMemo(()=>new Map<number,ImageBitmap>(),[source]);
  useEffect(()=>{
    const observer=new ResizeObserver(entries=>{
      const {width,height}=entries[0].contentRect;
      setViewport(previous=>previous.width===width&&previous.height===height?previous:{width,height});
    });
    observer.observe(viewportRef.current!);return()=>observer.disconnect();
  },[]);
  useEffect(()=>()=>{for(const image of thumbnails.values())image.close();thumbnails.clear();},[thumbnails]);
  useEffect(()=>{
    const controller=new AbortController();
    async function paint() {
      setStatus("Preparing preview…");
      const canvas=canvasRef.current!;
      const scale=1600/Math.max(panel.widthMm,panel.heightMm);
      canvas.width=Math.max(1,Math.ceil(panel.widthMm*scale));canvas.height=Math.max(1,Math.ceil(panel.heightMm*scale));
      const ctx=canvas.getContext("2d")!; ctx.scale(scale,scale);
      ctx.fillStyle="white";ctx.fillRect(0,0,panel.widthMm,panel.heightMm);
      const contour=new Path2D(outlinePath(plan.trimWidthMm,plan.trimHeightMm,{...source.document.shape,cornerRadius:source.document.shape.cornerRadius*25.4/source.document.dpi}));
      for(let i=0;i<panel.placements.length;i++) {
        controller.signal.throwIfAborted();
        const placement=panel.placements[i];
        let image=thumbnails.get(placement.recordIndex);
        if(!image) {
          const blob=await renderProjectPngBlob(source,records[placement.recordIndex],{includeGuides:false});
          controller.signal.throwIfAborted();
          const max=512,ratio=plan.itemWidthMm/plan.itemHeightMm;
          image=await createImageBitmap(blob,{resizeWidth:Math.max(1,Math.round(ratio>=1?max:max*ratio)),resizeHeight:Math.max(1,Math.round(ratio>=1?max/ratio:max))});
          if(controller.signal.aborted){image.close();return;}
          thumbnails.set(placement.recordIndex,image);
          if(thumbnails.size>64){const oldest=thumbnails.keys().next().value!;thumbnails.get(oldest)!.close();thumbnails.delete(oldest);}
        }
        ctx.save();ctx.translate(placement.xMm,placement.yMm);
        if(plan.rotation){ctx.translate(plan.itemHeightMm,0);ctx.rotate(Math.PI/2);}
        ctx.drawImage(image,0,0,plan.itemWidthMm,plan.itemHeightMm);
        if(bleed){ctx.strokeStyle="#c4812c";ctx.lineWidth=1/scale;ctx.setLineDash([3/scale,3/scale]);ctx.strokeRect(0,0,plan.itemWidthMm,plan.itemHeightMm);}
        if(cuts){ctx.translate(plan.bleedMm,plan.bleedMm);ctx.setLineDash([]);ctx.strokeStyle="#276c58";ctx.lineWidth=1/scale;ctx.stroke(contour);}
        ctx.restore();
        if(i%32===0)await exportYield(controller.signal);
      }
      setStatus("");
    }
    paint().catch(error=>{if(error?.name!=="AbortError")setStatus(error instanceof Error?error.message:"Preview unavailable.");});
    return()=>controller.abort();
  },[source,records,thumbnails,plan,panel,cuts,bleed]);
  const paperWidth=Math.max(1,Math.min(viewport.width-48,(viewport.height-72)*panel.widthMm/panel.heightMm))*zoom;
  return <section className="layout-preview layout-card" aria-label="Layout preview">
    <div className="layout-preview-toolbar"><span>{plan.columns} across · {panel.rows} rows</span><div>
      <button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.25,z/1.25))}>−</button>
      <button aria-label="Fit layout" onClick={()=>setZoom(1)}>Fit</button>
      <button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(8,z*1.25))}>+</button>
    </div></div>
    <div className="layout-preview-scroll" ref={viewportRef}><div className="layout-preview-paper-wrap">
      <span className="layout-dimension">{panel.widthMm.toFixed(2)} × {panel.heightMm.toFixed(2)} mm</span>
      <canvas ref={canvasRef} aria-label="Panel artwork preview" style={{width:paperWidth,maxWidth:zoom===1?"100%":undefined,height:"auto"}} />
    </div></div>
    <div className="layout-guide-controls"><label><input type="checkbox" checked={cuts} onChange={e=>setCuts(e.target.checked)}/>Cut outlines</label>
      <label><input type="checkbox" checked={bleed} onChange={e=>setBleed(e.target.checked)}/>Bleed areas</label><small>Preview only</small></div>
    <div className="layout-preview-status" role="status">{status || "Preview ready · artwork exports without guides"}</div>
    <div className="layout-pager"><button aria-label="Previous panel" disabled={panelIndex===0} onClick={()=>onPanelChange(panelIndex-1)}>‹</button>
      <span data-testid="layout-page-label">Panel {panelIndex+1} of {plan.panelCount} · items {panel.firstItem+1}–{panel.firstItem+panel.itemCount}</span>
      <button aria-label="Next panel" disabled={panelIndex>=plan.panelCount-1} onClick={()=>onPanelChange(panelIndex+1)}>›</button></div>
  </section>;
}
