import qrcode from "qrcode-generator";
import type { QrLayer } from "../types";
import type { QrMetrics } from "./printQualityModel";

const moduleCache=new Map<string,number>();
export function qrMetricsForPayload(layer:QrLayer,payload:string):QrMetrics {
  const key=JSON.stringify([layer.errorCorrectionLevel,payload]);
  let modules=moduleCache.get(key);
  if(modules===undefined) {
    // Match qr-code-styling's automatic mode and the encoder's default byte
    // conversion. Do not override encoding or access its private matrix fields.
    const mode=/^[0-9]*$/.test(payload)?"Numeric":/^[0-9A-Z $%*+\-./:]*$/.test(payload)?"Alphanumeric":"Byte";
    const code=qrcode(0,layer.errorCorrectionLevel);code.addData(payload,mode);code.make();modules=code.getModuleCount();
    if(moduleCache.size>=128)moduleCache.delete(moduleCache.keys().next().value!);
    moduleCache.set(key,modules);
  }
  return {modules,sourceSize:Math.max(72,Math.round(Math.max(layer.width,layer.height)))};
}
