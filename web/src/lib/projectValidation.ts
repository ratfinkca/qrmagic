import type { QrMagicProject } from "../types";
import { normalizeProject } from "./project";
import { productionCount, productionGeometry } from "./production";

/** Validate render-consumed structure before activating data from disk/browser storage. */
export function projectForEditor(value:QrMagicProject):QrMagicProject {
  const project=normalizeProject(value),doc=project.document,output=project.export;
  const fail=()=>{throw new Error("This project contains missing or invalid settings. Open a valid project file to continue.");};
  if (!doc || typeof doc.name!=="string" || !["in","mm","px"].includes(doc.unit) || typeof doc.backgroundColor!=="string") fail();
  if (!doc.guides || ["enabled","showTrim","showBleed","showSafeArea"].some(key=>typeof doc.guides[key as keyof typeof doc.guides]!=="boolean")) fail();
  if (!output || !Array.isArray(output.formats) || typeof output.filenameTemplate!=="string" || typeof output.includeGuides!=="boolean" || !["flattened","layered"].includes(output.renderMode)) fail();
  if (output.formats.some(format=>!["png","jpg","pdf","production-pdf","svg","eps","bmp"].includes(format))) fail();
  const ids=new Set<string>(),sources=new Set<string>();
  for (const group of project.data.groups) {
    if (typeof group.id!=="string" || typeof group.name!=="string" || sources.has(group.id)) fail();
    sources.add(group.id);
    if (group.mode==="fixed") { if(typeof group.fixed.value!=="string")fail(); }
    else if (group.mode!=="serial" || typeof group.serial.prefix!=="string" || typeof group.serial.suffix!=="string" || ![group.serial.start,group.serial.step,group.serial.padding].every(Number.isFinite)) fail();
  }
  for (const layer of project.layers) {
    if (typeof layer.id!=="string" || typeof layer.name!=="string" || ids.has(layer.id) || typeof layer.visible!=="boolean" || typeof layer.locked!=="boolean") fail();
    ids.add(layer.id);
    if (![layer.x,layer.y,layer.width,layer.height,layer.rotation,layer.opacity].every(Number.isFinite)) fail();
    if (layer.type==="qr") {
      if(typeof layer.payloadTemplate!=="string"||typeof layer.foreground!=="string"||typeof layer.background!=="string")fail();
    } else if(layer.type==="text") {
      if(typeof layer.textTemplate!=="string"||typeof layer.fontFamily!=="string"||typeof layer.fill!=="string"||!Number.isFinite(layer.fontSize))fail();
    } else if(layer.type==="image") { if(typeof layer.src!=="string")fail(); }
    else if(layer.type==="shape") { if(typeof layer.fill!=="string"||typeof layer.stroke!=="string"||!Array.isArray(layer.dash))fail(); }
    else fail();
  }
  productionCount(project);productionGeometry(project);
  return project;
}
