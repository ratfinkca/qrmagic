import { describe, expect, it } from "vitest";
import { createStarterProject } from "./templates";
import { effectiveImagePpi, qrQualityIssues, qrContrast, recordSamples, layerBoundary, safeAreaIssue } from "./printQualityModel";
import type { ImageLayer, QrLayer } from "../types";

const project=()=>createStarterProject("stickers",{width:50.8,height:50.8,payload:"https://example.com"});
const qr=(p=project())=>p.layers.find(layer=>layer.type==="qr") as QrLayer;
describe("friendly print quality calculations",()=>{
  it("uses physical size and real module pitch, rather than the document DPI alone",()=>{
    const p=project(),code={...qr(p),width:70,height:70,margin:12};
    expect(qrQualityIssues(p,code,{modules:29,sourceSize:72},true).map(issue=>issue.code)).toContain("qr-small");
    expect(qrQualityIssues(p,{...code,width:700,height:700,margin:100},{modules:29,sourceSize:700},false).map(issue=>issue.code)).not.toContain("qr-small");
  });
  it("measures quiet space in modules, allowing the renderer's centering remainder",()=>{
    const p=project(),code={...qr(p),width:290,height:290,margin:0};
    expect(qrQualityIssues(p,code,{modules:29,sourceSize:290},false).map(issue=>issue.code)).toContain("qr-quiet-zone");
    expect(qrQualityIssues(p,{...code,margin:45},{modules:29,sourceSize:290},false).map(issue=>issue.code)).not.toContain("qr-quiet-zone");
  });
  it("separates contrast, inverted colors and unverified translucent backgrounds",()=>{
    expect(qrContrast("#000000","#ffffff")?.ratio).toBeCloseTo(21);
    const p=project(),code=qr(p),metrics={modules:21,sourceSize:code.width};
    expect(qrQualityIssues(p,{...code,foreground:"#dddddd"},metrics,false).map(i=>i.code)).toContain("qr-contrast");
    expect(qrQualityIssues(p,{...code,foreground:"#ffffff",background:"#000000"},metrics,false).map(i=>i.code)).toContain("qr-inverted");
    expect(qrQualityIssues(p,{...code,background:"transparent"},metrics,false).map(i=>i.code)).toContain("qr-background");
    expect(qrQualityIssues(p,{...code,opacity:0.4},metrics,false).map(i=>i.code)).toContain("qr-opacity");
  });
  it("calculates placed PPI for stretch, contain, cover and original fit",()=>{
    const image={width:600,height:600,fit:"stretch"} as ImageLayer;
    const source={width:1200,height:600};
    expect(effectiveImagePpi(image,source,300)).toBe(300);
    expect(effectiveImagePpi({...image,fit:"contain"},source,300)).toBe(600);
    expect(effectiveImagePpi({...image,fit:"cover"},source,300)).toBe(300);
    expect(effectiveImagePpi({...image,fit:"original"},source,300)).toBe(300);
  });
  it("samples serial endpoints and short ranges without expanding copies",()=>{
    const p=createStarterProject("decals",{records:10000,copies:3});
    const samples=recordSamples(p);
    expect(samples[0].index).toBe(0);expect(samples.some(r=>r.index===9999)).toBe(true);expect(samples.length).toBeLessThan(20);
    const fixed=project();fixed.production.copiesPerRecord=5000;
    expect(recordSamples(fixed).length).toBe(1);
  });
  it("rotates boundaries about the same top-left origin as artwork",()=>{
    const points=layerBoundary({...qr(),x:100,y:100,width:20,height:40,rotation:90});
    expect(Math.min(...points.map(p=>p.x))).toBeCloseTo(60);
    expect(Math.max(...points.map(p=>p.y))).toBeCloseTo(120);
  });
  it("checks important content, distinguishes clipping, and ignores hidden/empty/background artwork",()=>{
    const p=project(),code={...qr(p),x:0,y:0,width:20,height:20};
    const insideTrim=(x:number,y:number)=>x>=0&&y>=0&&x<=600&&y<=600;
    const insideSafe=(x:number,y:number)=>x>=30&&y>=30&&x<=570&&y<=570;
    expect(safeAreaIssue(p,code,insideTrim,insideSafe)?.code).toBe("safe-area");
    expect(safeAreaIssue(p,{...code,x:-10},insideTrim,insideSafe)?.code).toBe("outside-cut");
    expect(safeAreaIssue(p,{...code,visible:false},insideTrim,insideSafe)).toBeUndefined();
    expect(safeAreaIssue(p,{...code,type:"image",src:"",assetId:"test",fit:"stretch"},insideTrim,insideSafe)).toBeUndefined();
  });
  it("ignores fully transparent text unless it can paint a shadow",()=>{
    const p=project(),text=p.layers.find(layer=>layer.type==="text")!;
    if(text.type!=="text")throw new Error("Missing fixture text");
    const invisible={...text,x:-20,fill:"transparent",shadowEnabled:false};
    expect(safeAreaIssue(p,invisible,()=>false,()=>false)).toBeUndefined();
    expect(safeAreaIssue(p,{...invisible,shadowEnabled:true},()=>false,()=>false)?.code).toBe("outside-cut");
  });
});
