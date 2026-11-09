import type { ImageLayer, QrMagicProject } from "../types";
import { productionGeometry } from "./production";
import { productionPreflight, rasterReason, type ProductionIssue } from "./productionPdfModel";
import { outlinePath } from "./cutGeometry";
import { effectiveImagePpi, PRINT_GUIDANCE, qrQualityIssues, qualityIssue, recordSamples, safeAreaIssue, type ImageDimensions } from "./printQualityModel";
import { qrMetricsForPayload } from "./qrMetrics";
import { renderLayerValue } from "./serial";

const imageCache=new Map<string,Promise<ImageDimensions>>();
function imageDimensions(src:string):Promise<ImageDimensions> {
  const cached=imageCache.get(src);if(cached)return cached;
  const pending=new Promise<ImageDimensions>((resolve,reject)=>{
    const image=new Image();
    const cleanup=()=>{clearTimeout(timer);image.onload=null;image.onerror=null;image.src="";};
    const timer=setTimeout(()=>{cleanup();reject(new Error("Image check timed out."));},5000);
    image.onload=()=>{const dimensions={width:image.naturalWidth,height:image.naturalHeight};cleanup();dimensions.width&&dimensions.height?resolve(dimensions):reject(new Error("Image has no size."));};
    image.onerror=()=>{cleanup();reject(new Error("Image could not be read."));};
    image.src=src;
  });
  if(imageCache.size>=32)imageCache.delete(imageCache.keys().next().value!);
  imageCache.set(src,pending);
  void pending.catch(()=>{if(imageCache.get(src)===pending)imageCache.delete(src);});
  return pending;
}
function svgSource(src:string) { return /^data:image\/svg\+xml[;,]/i.test(src)||/\.svg(?:[?#]|$)/i.test(src); }
function cutContainment(project:QrMagicProject,inset:number) {
  const {trim}=productionGeometry(project),width=trim.width-2*inset,height=trim.height-2*inset;
  if(width<=0||height<=0)return ()=>false;
  const context=document.createElement("canvas").getContext("2d");
  if(!context)throw new Error("Cut check unavailable.");
  const path=new Path2D();path.addPath(new Path2D(outlinePath(width,height,project.document.shape)),new DOMMatrix().translate(inset,inset));
  return (x:number,y:number)=>context.isPointInPath(path,x,y);
}
export async function analyzePrintProject(project:QrMagicProject,options:{signal?:AbortSignal;format?:string}={}):Promise<ProductionIssue[]> {
  const {signal}=options,format=options.format??project.export.formats[0];
  signal?.throwIfAborted();
  const issues=productionPreflight(project).filter(issue=>issue.code!=="quiet-zone");
  if(issues.some(issue=>issue.code==="document-size"))return issues;
  const layers=project.layers.filter(layer=>layer.visible&&layer.opacity>0),samples=recordSamples(project);
  let insideTrim:ReturnType<typeof cutContainment>|undefined,insideSafe:ReturnType<typeof cutContainment>|undefined;
  try { insideTrim=cutContainment(project,0);insideSafe=cutContainment(project,Math.round(project.document.safeAreaMm*project.document.dpi/25.4)); }
  catch { issues.push({severity:"warning",category:"quality",code:"safe-unverified",message:"The cut-shape check could not run. Use the trim/safe guides and check a physical sample."}); }
  for(const layer of layers) {
    signal?.throwIfAborted();
    if(insideTrim&&insideSafe) { const issue=safeAreaIssue(project,layer,insideTrim,insideSafe);if(issue)issues.push(issue); }
    if(layer.type!=="qr")continue;
    const candidates=new Map<string,ProductionIssue>();
    const measured:ReturnType<typeof qrMetricsForPayload>[]=[];
    for(const payload of new Set(samples.map(record=>renderLayerValue(layer,record)))) {
      if(!payload.trim())continue;
      try {
        const metrics=qrMetricsForPayload(layer,payload);
        measured.push(metrics);
      } catch { candidates.set("qr-unverified",qualityIssue(layer,"qr-unverified","this QR content could not be measured. Shorten the content if needed and scan an exported sample before printing.")); }
    }
    // Smaller symbols can need more quiet space per module even when denser
    // symbols need more physical size. Check both, keeping one note per code.
    for(const metrics of measured.sort((a,b)=>b.modules-a.modules))for(const issue of qrQualityIssues(project,layer,metrics,format!=="production-pdf"||Boolean(rasterReason(layer))))if(!candidates.has(issue.code))candidates.set(issue.code,issue);
    issues.push(...candidates.values());
  }
  const images=layers.filter((layer):layer is ImageLayer=>layer.type==="image"),imageIssues=new Map<string,ProductionIssue>();
  let next=0;
  await Promise.all(Array.from({length:Math.min(4,images.length)},async()=>{
    while(next<images.length) {
      signal?.throwIfAborted();const layer=images[next++];
      if(svgSource(layer.src)) {
        imageIssues.set(layer.id,qualityIssue(layer,"image-vector",`SVG source: intrinsic photo resolution cannot be verified, including embedded raster images. This image layer is rasterized at ${project.document.dpi} DPI; check a printed sample.`));continue;
      }
      try {
        const dimensions=await imageDimensions(layer.src);signal?.throwIfAborted();
        const ppi=effectiveImagePpi(layer,dimensions,project.document.dpi);
        if(ppi!==undefined&&Math.min(ppi,project.document.dpi)<PRINT_GUIDANCE.imagePpi-0.5) {
          const description=ppi<project.document.dpi?`about ${Math.round(ppi)} PPI at this placed size (${dimensions.width} × ${dimensions.height} source pixels).`:`raster output is capped at ${project.document.dpi} DPI (source about ${Math.round(ppi)} PPI at this size).`;
          imageIssues.set(layer.id,qualityIssue(layer,"image-resolution",`${description} Aim for 300 PPI for close viewing: ${ppi<300?"use a larger source or print it smaller":"increase document DPI if the shop needs more detail"}. Large posters viewed farther away may need less.`));
        }
      } catch(error) { signal?.throwIfAborted();imageIssues.set(layer.id,qualityIssue(layer,"image-unverified","image resolution could not be checked. Reimport the original image or check its pixel dimensions before printing.")); }
    }
  }));
  for(const layer of images) { const issue=imageIssues.get(layer.id);if(issue)issues.push(issue); }
  signal?.throwIfAborted();return issues;
}
