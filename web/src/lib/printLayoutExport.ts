import JSZip from "jszip";
import { PDFDocument, degrees } from "pdf-lib";
import type { PrintLayoutSettings, QrMagicProject, RenderRecord } from "../types";
import { calculateLayout, layoutPanel, csvCell, type LayoutPlan, type LayoutPanel } from "./printLayout";
import { productionCount } from "./production";
import { createDataRecords } from "./serial";
import { outlinePath } from "./productionPdfModel";
import { renderProductionPdf } from "./productionPdf";
import { exportYield, type ExportControl } from "./exportControl";

const points=(mm:number)=>mm/25.4*72;
const round=(value:number)=>Number(value.toFixed(6));

export function layoutCutSvg(project:QrMagicProject,plan:LayoutPlan,panel:LayoutPanel) {
  const shape={...project.document.shape,cornerRadius:project.document.shape.cornerRadius*25.4/project.document.dpi};
  const contour=outlinePath(plan.trimWidthMm,plan.trimHeightMm,shape);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${round(panel.widthMm)}mm" height="${round(panel.heightMm)}mm" viewBox="0 0 ${round(panel.widthMm)} ${round(panel.heightMm)}" fill="none" stroke="#ff00ff" stroke-width="0.1"><title>Panel ${panel.index+1} finished cut reference geometry</title><defs><path id="cut" d="${contour}"/></defs>${panel.placements.map(p=>
    `<g data-item="${p.itemIndex+1}" transform="translate(${round(p.xMm+(plan.rotation?plan.itemHeightMm:0))} ${round(p.yMm)})${plan.rotation?' rotate(90)':''}"><use href="#cut" transform="translate(${round(plan.bleedMm)} ${round(plan.bleedMm)})"/></g>`).join("")}</svg>`;
}

const csvHeaders=["panel","finished_item","record","copy","primary_serial","envelope_x_mm","envelope_y_mm","trim_width_mm","trim_height_mm","bleed_mm","rotation_clockwise_deg"];
function panelCsv(plan:LayoutPlan,panel:LayoutPanel,records:RenderRecord[]) {
  return panel.placements.map(p=>[panel.index+1,p.itemIndex+1,p.recordIndex+1,p.copyIndex+1,records[p.recordIndex].serial,
    round(p.xMm),round(p.yMm),round(plan.rotation?plan.trimHeightMm:plan.trimWidthMm),round(plan.rotation?plan.trimWidthMm:plan.trimHeightMm),plan.bleedMm,plan.rotation].map(csvCell).join(",")).join("\r\n");
}

export async function exportLayoutPackage(project:QrMagicProject,settings:PrintLayoutSettings,control:ExportControl={}) {
  control.signal?.throwIfAborted();
  const plan=calculateLayout(project,settings),records=createDataRecords(project.data.groups);
  const source=await renderProductionPdf(project,records,control);
  await exportYield(control.signal);
  const sourceDoc=await PDFDocument.load(await source.blob.arrayBuffer());
  const doc=await PDFDocument.create(); doc.setTitle(`${project.document.name} · Print layout`);
  const embedded=await doc.embedPages(sourceDoc.getPages());
  const zip=new JSZip(),csv=[csvHeaders.join(",")],pageSizes=[];
  for(let index=0;index<plan.panelCount;index++) {
    control.onProgress?.({stage:"panels",completed:index,total:plan.panelCount});
    await exportYield(control.signal);
    const panel=layoutPanel(plan,index),page=doc.addPage([points(panel.widthMm),points(panel.heightMm)]);
    page.setTrimBox(0,0,page.getWidth(),page.getHeight()); page.setBleedBox(0,0,page.getWidth(),page.getHeight());
    for(let i=0;i<panel.placements.length;i++) {
      if(i%64===0) await exportYield(control.signal);
      const placement=panel.placements[i];
      // PDF Form XObject BBox clips each source to its complete bleed envelope.
      page.drawPage(embedded[placement.recordIndex],{x:points(placement.xMm),
        y:points(panel.heightMm-placement.yMm-(plan.rotation?0:plan.itemHeightMm)),
        width:points(plan.itemWidthMm),height:points(plan.itemHeightMm),rotate:degrees(-plan.rotation)});
    }
    zip.file(`cut-reference/panel-${String(index+1).padStart(4,"0")}.svg`,layoutCutSvg(project,plan,panel));
    csv.push(panelCsv(plan,panel,records));
    pageSizes.push({panel:index+1,widthMm:panel.widthMm,heightMm:panel.heightMm,firstItem:panel.firstItem+1,itemCount:panel.itemCount});
  }
  control.onProgress?.({stage:"panels",completed:plan.panelCount,total:plan.panelCount});
  await exportYield(control.signal);
  const bytes=await doc.save();
  zip.file("artwork.pdf",bytes); zip.file("placements.csv",csv.join("\r\n")+"\r\n");
  zip.file("job.json",JSON.stringify({format:"qrmagic.print-layout",version:1,name:project.document.name,
    settings,quantity:productionCount(project),orientationClockwise:plan.rotation,panelCount:plan.panelCount,
    totalLengthMm:plan.totalLengthMm,totalAreaMm2:plan.totalAreaMm2,order:"Left to right, top to bottom; all copies of each record stay consecutive.",pages:pageSizes,records},null,2));
  zip.file("preflight.json",JSON.stringify({colorSpace:"RGB",machineProfile:null,pdfX:false,issues:source.issues,
    stats:{...source.stats,pages:plan.panelCount,finishedItems:plan.total},limits:["No ICC conversion or PDF/X output intent","Reference cut geometry only; configure machine cuts and registration in the RIP"]},null,2));
  zip.file("README.txt",[
    `QR Magic print layout: ${project.document.name}`,
    `${plan.total} finished items on ${plan.panelCount} ${settings.media==="roll"?"roll panels":"sheets"}. Print artwork.pdf at 100% / actual size. Disable fit-to-page and RIP duplication. All requested copies are already placed.`,
    "Each page has its exact media dimensions. Its MediaBox, TrimBox and BleedBox describe the media page. Individual cuts are in cut-reference/panel-NNNN.svg and placements.csv. Import references at actual size on their matching page; do not auto-fit or rotate them.",
    "Spacing is clear space between the full bleed envelopes. Artwork is clipped to each envelope. Finished designs are never resized. Copies retain the same content and serial. Order is left-to-right/top-to-bottom, all copies of record 1 then record 2, etc.",
    "Estimated media use includes configured margins for every panel/sheet. It excludes extra machine feed, registration space, test prints and waste not explicitly entered in margins. A new roll panel is a separate page; confirm how your RIP advances/cuts between pages.",
    "RGB with live transparency and embedded fonts; supported artwork remains vector, effects use documented raster fallback at design DPI. Read preflight.json. This is not PDF/X and has no ICC conversion. Let the shop configure color/media in its RIP.",
    "Cut SVGs are vector reference geometry, not machine-ready cut files, CutContour spot separations, registration marks or cutter commands. This generic layout has not been validated with a specific Mimaki/RIP profile.",
    "placements.csv contains physical mm coordinates measured from the top-left media edge, zero reference rotation at the design orientation, clockwise rotation in degrees, oriented trim dimensions, and the primary serial. Spreadsheet formula-leading serials are prefixed with an apostrophe. Source record values in job.json retain original content; primary serial is not a complete list of every independently bound QR on an item.",
    "Vector/raster counts describe unique rendered records, not copies. Proof and scan a physical sample at finished size before producing the batch.",
  ].join("\n\n"));
  control.onProgress?.({stage:"package",completed:0,total:100});
  await exportYield(control.signal);
  const blob=await zip.generateAsync({type:"blob"},metadata=>{
    control.signal?.throwIfAborted(); control.onProgress?.({stage:"package",completed:Math.round(metadata.percent),total:100});
  });
  control.signal?.throwIfAborted(); return blob;
}
