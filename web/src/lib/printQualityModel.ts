import type { ImageLayer, ProjectLayer, QrLayer, QrMagicProject, RenderRecord } from "../types";
import type { ProductionIssue } from "./productionPdfModel";
import { dataRecordCount, formatSerial, renderTemplate } from "./serial";

export type QrMetrics={modules:number;sourceSize:number};
export type ImageDimensions={width:number;height:number};
export const PRINT_GUIDANCE={imagePpi:300,moduleMm:0.25,rasterModulePixels:4,contrastRatio:4.5,quietModules:4} as const;
export function qualityIssue(layer:ProjectLayer,code:string,message:string):ProductionIssue {
  return {severity:"warning",category:"quality",code,layerId:layer.id,layerName:layer.name,message:`${layer.name}: ${message}`};
}

/** Bounded endpoints/range transitions, never thousands of copied records. */
export function recordSamples(project:QrMagicProject):RenderRecord[] {
  const count=dataRecordCount(project.data.groups),indices=new Set([0,count-1]);
  for(const group of project.data.groups) {
    if(group.mode!=="serial")continue;
    if(indices.size<32)indices.add(Math.min(count-1,group.serial.quantity-1));
    const zero=-group.serial.start/group.serial.step;
    if(Number.isFinite(zero))for(const index of [Math.floor(zero)-1,Math.floor(zero),Math.ceil(zero)+1])if(index>=0&&index<count&&indices.size<32)indices.add(index);
  }
  return [...indices].sort((a,b)=>a-b).map(index=>{
    const groups=Object.fromEntries(project.data.groups.map(group=>[group.id,{serial:group.mode==="fixed"?group.fixed.value:index<group.serial.quantity?formatSerial(group.serial,index):""}]));
    return {index,serial:groups[project.data.groups[0]?.id]?.serial??"",groups};
  });
}

function luminance(color:string):number|undefined {
  if(!/^#[\da-f]{6}$/i.test(color))return undefined;
  const rgb=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
}
export function qrContrast(foreground:string,background:string) {
  const dark=luminance(foreground),light=luminance(background);
  return dark===undefined||light===undefined?undefined:{ratio:(Math.max(dark,light)+0.05)/(Math.min(dark,light)+0.05),inverted:dark>light};
}
export function qrQualityIssues(project:QrMagicProject,layer:QrLayer,metrics:QrMetrics,raster:boolean):ProductionIssue[] {
  const issues:ProductionIssue[]=[],margin=Math.max(0,Math.round(layer.margin));
  const dots=Math.max(0,Math.floor((metrics.sourceSize-2*margin)/metrics.modules));
  const pitchPixels=dots*Math.min(layer.width,layer.height)/metrics.sourceSize;
  const pitchMm=pitchPixels*25.4/project.document.dpi;
  const widthMm=Math.min(layer.width,layer.height)*25.4/project.document.dpi;
  if(pitchMm<PRINT_GUIDANCE.moduleMm || raster&&pitchPixels<PRINT_GUIDANCE.rasterModulePixels) {
    issues.push(qualityIssue(layer,"qr-small",`small QR detail (${pitchMm.toFixed(2)} mm per QR square/module, ${widthMm.toFixed(1)} mm across). Enlarge the QR or shorten its content.${raster&&pitchPixels<4?` Raster output has about ${pitchPixels.toFixed(1)} pixels per module; aim for at least 4.`:""} A 0.25 mm module is a starting guideline, not a scan guarantee.`));
  }
  const quietPixels=(metrics.sourceSize-dots*metrics.modules)/2;
  if(dots===0 || quietPixels/dots<PRINT_GUIDANCE.quietModules-0.001)issues.push(qualityIssue(layer,"qr-quiet-zone",`leave clear space around the QR. Its configured border is about ${dots?(quietPixels/dots).toFixed(1):"0"} modules; aim for 4 on every side. Increase QR margin and keep nearby artwork clear.`));
  const contrast=qrContrast(layer.foreground,layer.background);
  if(!contrast)issues.push(qualityIssue(layer,"qr-background","the final background/contrast cannot be verified from these colors. Use a solid light QR background, or check the printed code carefully over your artwork."));
  else if(contrast.inverted)issues.push(qualityIssue(layer,"qr-inverted","light code on a dark background may be harder for some readers. Prefer dark QR marks on a light background and test your intended phones."));
  else if(contrast.ratio<PRINT_GUIDANCE.contrastRatio)issues.push(qualityIssue(layer,"qr-contrast",`low color contrast (about ${contrast.ratio.toFixed(1)}:1). Try darker QR marks and a lighter background. This ratio is a screening guide, not a barcode quality grade.`));
  if(layer.opacity<0.999)issues.push(qualityIssue(layer,"qr-opacity","QR opacity is below 100%. Underlying artwork can reduce contrast; try full opacity and scan a physical sample."));
  return issues;
}

export function effectiveImagePpi(layer:ImageLayer,source:ImageDimensions,dpi:number):number|undefined {
  if(![source.width,source.height,layer.width,layer.height,dpi].every(value=>Number.isFinite(value)&&value>0))return undefined;
  if(layer.fit==="original")return dpi;
  const x=layer.width/source.width,y=layer.height/source.height;
  const scale=layer.fit==="contain"?Math.min(x,y):Math.max(x,y);
  return dpi/scale;
}

export function layerBoundary(layer:ProjectLayer) {
  const angle=layer.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const points:{x:number;y:number}[]=[];
  const transform=(x:number,y:number)=>({x:layer.x+x*c-y*s,y:layer.y+x*s+y*c});
  const steps=Math.min(128,Math.max(12,Math.ceil(Math.max(layer.width,layer.height)/8)));
  for(let i=0;i<=steps;i++) {
    const t=i/steps;
    points.push(transform(layer.width*t,0),transform(layer.width*t,layer.height),transform(0,layer.height*t),transform(layer.width,layer.height*t));
  }
  points.push(transform(layer.width/2,layer.height/2));
  return points;
}
export function safeAreaIssue(project:QrMagicProject,layer:ProjectLayer,insideTrim:(x:number,y:number)=>boolean,insideSafe:(x:number,y:number)=>boolean):ProductionIssue|undefined {
  if(!layer.visible||layer.opacity<=0||layer.type!=="qr"&&layer.type!=="text")return;
  if(layer.type==="text"&&(layer.fillOpacity<=0||layer.fill==="transparent")&&!layer.shadowEnabled)return;
  if(layer.type==="text"&&!renderTemplate(layer.textTemplate,recordSamples(project)[0],layer.dataGroupId).trim())return;
  const boundary=layerBoundary(layer);
  if(boundary.some(point=>!insideTrim(point.x,point.y)))return qualityIssue(layer,"outside-cut",`${layer.type==="qr"?"QR":"text box"} appears to cross the finished cut. Move it inside the cut shape, or adjust its size/rotation before printing.`);
  if(project.document.safeAreaMm>0&&boundary.some(point=>!insideSafe(point.x,point.y)))return qualityIssue(layer,"safe-area",`${layer.type==="qr"?"QR":"text box"} appears outside the ${project.document.safeAreaMm} mm safe guide. Move important content inward and check Finished preview. Background artwork may extend into bleed.`);
}

export function printCheckScope(project:QrMagicProject) {
  return {sampleRecordNumbers:recordSamples(project).map(record=>record.index+1),guidance:PRINT_GUIDANCE,
    notes:["QR density checks sample records; copies are not separate content checks.","Cut checks sample QR/text box boundaries against the cut and safe guide.","Color contrast is a screening heuristic, not an ISO barcode quality grade.","Thresholds are guidance, not printer certification. Scan and physically proof artwork at actual size."]};
}
