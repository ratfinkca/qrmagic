import type { PrintLayoutSettings, QrMagicProject } from "../types";
import { productionCount, productionGeometry } from "./production";

export function defaultLayoutSettings(): PrintLayoutSettings {
  return { media:"roll", units:"mm", widthMm:609.6, heightMm:1000,
    marginTop:10, marginRight:10, marginBottom:10, marginLeft:10, gapX:3, gapY:3, orientation:"best" };
}

// Imported invalid values remain visible/recoverable in layout, never fatal to the editor.
export function normalizeLayoutSettings(value: unknown): PrintLayoutSettings | undefined {
  if (value === undefined) return undefined;
  const defaults = defaultLayoutSettings();
  if (!value || typeof value !== "object" || Array.isArray(value)) return {...defaults,widthMm:NaN};
  const raw = value as Record<string,unknown>;
  const result = {...defaults} as Record<string,unknown>;
  for (const key of Object.keys(defaults)) {
    if (!(key in raw)) continue;
    result[key] = typeof defaults[key as keyof PrintLayoutSettings] === "number"
      ? typeof raw[key] === "number" ? raw[key] : NaN : typeof raw[key] === "string" ? raw[key] : "";
  }
  return result as PrintLayoutSettings;
}

export type LayoutPlan = {
  settings: PrintLayoutSettings; total:number; copiesPerRecord:number;
  itemWidthMm:number; itemHeightMm:number; trimWidthMm:number; trimHeightMm:number; bleedMm:number;
  rotation:0|90; envelopeWidthMm:number; envelopeHeightMm:number;
  columns:number; rows:number; capacity:number; panelCount:number; totalLengthMm:number; totalAreaMm2:number;
};
export type LayoutPlacement = { itemIndex:number; recordIndex:number; copyIndex:number; xMm:number; yMm:number };
export type LayoutPanel = { index:number; widthMm:number; heightMm:number; rows:number; firstItem:number; itemCount:number; placements:LayoutPlacement[] };

export function placementIdentity(itemIndex:number,copies:number) {
  return { recordIndex:Math.floor(itemIndex/copies), copyIndex:itemIndex%copies };
}

export function calculateLayout(project:QrMagicProject,settings:PrintLayoutSettings):LayoutPlan {
  if (!settings || !["roll","sheet"].includes(settings.media) || !["mm","in"].includes(settings.units) || !["best","original","rotated"].includes(settings.orientation)) throw new Error("Invalid layout settings. Reset layout to restore the defaults.");
  if (![settings.widthMm,settings.heightMm].every(v=>Number.isFinite(v)&&v>0&&v<=5000)) throw new Error("Media dimensions must be greater than zero and at most 5,000 mm.");
  if (![settings.marginTop,settings.marginRight,settings.marginBottom,settings.marginLeft].every(v=>Number.isFinite(v)&&v>=0)) throw new Error("Margins must be finite and nonnegative.");
  if (![settings.gapX,settings.gapY].every(v=>Number.isFinite(v)&&v>=0)) throw new Error("Spacing gaps must be finite and nonnegative.");
  const geometry=productionGeometry(project), count=productionCount(project);
  const itemWidthMm=geometry.points.width*25.4/72, itemHeightMm=geometry.points.height*25.4/72;
  const base={settings:{...settings},total:count.total,copiesPerRecord:count.copiesPerRecord,itemWidthMm,itemHeightMm,
    trimWidthMm:geometry.trimPoints.width*25.4/72,trimHeightMm:geometry.trimPoints.height*25.4/72,bleedMm:project.document.bleedMm};
  const usableWidth=settings.widthMm-settings.marginLeft-settings.marginRight;
  const usableHeight=settings.heightMm-settings.marginTop-settings.marginBottom;
  const candidates:LayoutPlan[]=[];
  for(const rotation of [0,90] as const) {
    if(settings.orientation==="original"&&rotation!==0 || settings.orientation==="rotated"&&rotation!==90) continue;
    const w=rotation===0?itemWidthMm:itemHeightMm,h=rotation===0?itemHeightMm:itemWidthMm;
    const columns=Math.floor((usableWidth+settings.gapX+1e-8)/(w+settings.gapX));
    const rows=Math.floor((usableHeight+settings.gapY+1e-8)/(h+settings.gapY));
    if(columns<1||rows<1) continue;
    const capacity=columns*rows,panelCount=Math.ceil(count.total/capacity);
    const fullLength=settings.marginTop+settings.marginBottom+rows*h+(rows-1)*settings.gapY;
    const lastCount=count.total-(panelCount-1)*capacity,lastRows=Math.ceil(lastCount/columns);
    const lastLength=settings.marginTop+settings.marginBottom+lastRows*h+(lastRows-1)*settings.gapY;
    const totalLengthMm=settings.media==="sheet"?panelCount*settings.heightMm:(panelCount-1)*fullLength+lastLength;
    candidates.push({...base,rotation,envelopeWidthMm:w,envelopeHeightMm:h,columns,rows,capacity,panelCount,totalLengthMm,totalAreaMm2:settings.widthMm*totalLengthMm});
  }
  if(!candidates.length) throw new Error("The artwork and bleed do not fit inside these margins. Increase media size, reduce margins or change orientation. Artwork is never scaled to fit.");
  return candidates.sort((a,b)=>Math.abs(a.totalAreaMm2-b.totalAreaMm2)>1e-6?a.totalAreaMm2-b.totalAreaMm2:a.panelCount-b.panelCount||a.rotation-b.rotation)[0];
}

export function layoutPanel(plan:LayoutPlan,index:number):LayoutPanel {
  if(!Number.isInteger(index)||index<0||index>=plan.panelCount) throw new Error("Invalid panel number.");
  const s=plan.settings,firstItem=index*plan.capacity,itemCount=Math.min(plan.capacity,plan.total-firstItem),rows=Math.ceil(itemCount/plan.columns);
  const heightMm=s.media==="sheet"?s.heightMm:s.marginTop+s.marginBottom+rows*plan.envelopeHeightMm+(rows-1)*s.gapY;
  return {index,widthMm:s.widthMm,heightMm,rows,firstItem,itemCount,
    placements:Array.from({length:itemCount},(_,slot)=>({itemIndex:firstItem+slot,...placementIdentity(firstItem+slot,plan.copiesPerRecord),
      xMm:s.marginLeft+(slot%plan.columns)*(plan.envelopeWidthMm+s.gapX),
      yMm:s.marginTop+Math.floor(slot/plan.columns)*(plan.envelopeHeightMm+s.gapY)}))};
}

export function csvCell(value:string|number) {
  let text=String(value);
  if(typeof value==="string"&&/^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(text)) text="'"+text;
  return `"${text.replaceAll('"','""')}"`;
}
