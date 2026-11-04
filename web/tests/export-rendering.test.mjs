import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { createServer } from "vite";

// Executable browser regressions exercise the actual editor and exported pixels
// locally and in CI. PLAYWRIGHT_CHANNEL=msedge uses an installed Edge browser.
let server;
let browser;
let page;
let initialProject;
let fixtureIndex = 0;
const pageErrors = [];

test("local autosave reopens artwork and layout settings after refresh, and duplicates stay independent",async()=>{
  const context=await browser.newContext({viewport:{width:1600,height:1000}}),tab=await context.newPage();
  tab.on("dialog",dialog=>dialog.accept());tab.on("pageerror",error=>pageErrors.push(error.message));
  try {
    await tab.goto(page.url());await tab.getByRole("button",{name:"Close new project",exact:true}).click();
    const fixture=structuredClone(initialProject);fixture.document.name="Recovery artwork";
    fixture.production.layout={media:"sheet",units:"mm",widthMm:210,heightMm:297,marginTop:8,marginRight:8,marginBottom:8,marginLeft:8,gapX:5,gapY:6,orientation:"rotated"};
    fixture.layers.push({...fixture.layers[0],type:"image",id:"saved-image",name:"Embedded artwork",src:"data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"><rect width="5" height="5" fill="red"/></svg>'),assetId:"local-image",fit:"stretch"});
    await tab.locator('input[accept=".qrmagic.json,application/json"]').setInputFiles({name:"recovery.qrmagic.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({format:"qrmagic.project",project:fixture}))});
    await tab.getByText("Saved on this device",{exact:true}).waitFor();
    const save=async()=>{const download=tab.waitForEvent("download");await tab.getByTitle("Save project",{exact:true}).click();return JSON.parse(await readFile(await(await download).path(),"utf8")).project;};
    const before=await save();await tab.reload();
    await tab.getByRole("button",{name:"Open Recovery artwork",exact:true}).click();
    await tab.getByRole("dialog").waitFor({state:"hidden"});
    await tab.getByLabel("Name",{exact:true}).waitFor();assert.deepEqual(await save(),before);
    await tab.getByRole("button",{name:"Projects",exact:true}).click();
    await tab.getByRole("button",{name:"Duplicate Recovery artwork",exact:true}).click();
    await tab.getByRole("dialog").waitFor({state:"hidden"});
    await tab.getByLabel("Name",{exact:true}).fill("Independent copy");await tab.getByText("Saved on this device",{exact:true}).waitFor();
    await tab.getByRole("button",{name:"Projects",exact:true}).click();
    await tab.getByRole("button",{name:"Open Recovery artwork",exact:true}).click();await tab.getByRole("dialog").waitFor({state:"hidden"});assert.deepEqual(await save(),before);
    await tab.getByRole("button",{name:"Projects",exact:true}).click();await tab.getByLabel("Search recent projects",{exact:true}).fill("Independent");
    assert.equal(await tab.getByRole("button",{name:"Open Recovery artwork",exact:true}).count(),0);
    await tab.getByRole("button",{name:"Open Independent copy",exact:true}).waitFor();
    await tab.setViewportSize({width:390,height:844});
    assert.equal(await tab.getByRole("dialog").evaluate(el=>el.getBoundingClientRect().right<=innerWidth&&el.scrollWidth<=el.clientWidth+1),true);
  }finally {await context.close();}
});

test("failed local transactions keep the last snapshot and Retry saves newer edits",async()=>{
  const context=await browser.newContext({viewport:{width:1600,height:1000}}),tab=await context.newPage();
  tab.on("dialog",dialog=>dialog.accept());tab.on("pageerror",error=>pageErrors.push(error.message));
  try {
    await tab.goto(page.url());await tab.getByRole("button",{name:"Close new project",exact:true}).click();
    await tab.getByLabel("Name",{exact:true}).fill("Last good save");await tab.getByText("Saved on this device",{exact:true}).waitFor();
    await tab.evaluate(()=>{window.originalProjectPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){const result=window.originalProjectPut.apply(this,args);if(this.name==="recent")this.transaction.abort();return result;};});
    await tab.getByLabel("Name",{exact:true}).fill("Latest unsaved edit");await tab.getByText("Local save failed",{exact:true}).waitFor();
    const stored=await tab.evaluate(async()=>{const {localProjectRepository}=await import("/qrmagic/src/lib/localProjects.ts");const entries=await localProjectRepository.list();return(await localProjectRepository.read(entries[0].id)).project.document.name;});
    assert.equal(stored,"Last good save");
    await tab.evaluate(()=>{IDBObjectStore.prototype.put=window.originalProjectPut;});
    await tab.getByRole("button",{name:"Retry local save",exact:true}).click();await tab.getByText("Saved on this device",{exact:true}).waitFor();
    await tab.reload();await tab.getByRole("button",{name:"Open Latest unsaved edit",exact:true}).click();
    await tab.getByRole("dialog").waitFor({state:"hidden"});
    assert.equal(await tab.getByLabel("Name",{exact:true}).inputValue(),"Latest unsaved edit");
  }finally {await context.close();}
});

test("two tabs preserve conflicting edits and opening the current project flushes queued changes",async()=>{
  const context=await browser.newContext({viewport:{width:1600,height:1000}}),first=await context.newPage(),second=await context.newPage();
  for(const tab of [first,second]){tab.on("dialog",dialog=>dialog.accept());tab.on("pageerror",error=>pageErrors.push(error.message));}
  try {
    await first.goto(page.url());await first.getByRole("button",{name:"Close new project",exact:true}).click();
    await first.getByLabel("Name",{exact:true}).fill("Shared starting point");await first.getByText("Saved on this device",{exact:true}).waitFor();
    await second.goto(page.url());await second.getByRole("button",{name:"Open Shared starting point",exact:true}).click();await second.getByRole("dialog").waitFor({state:"hidden"});
    await first.getByLabel("Name",{exact:true}).fill("First tab version");await first.getByText("Saved on this device",{exact:true}).waitFor();
    await second.getByLabel("Name",{exact:true}).fill("Second tab version");await second.getByText("Saved on this device",{exact:true}).waitFor();
    await second.getByText(/Saved as a separate local copy/).waitFor();await second.getByRole("button",{name:"Projects",exact:true}).click();
    await second.getByRole("button",{name:"Open First tab version",exact:true}).waitFor();await second.getByRole("button",{name:"Open Second tab version",exact:true}).waitFor();
    await first.getByRole("button",{name:"Projects",exact:true}).click();await first.getByRole("button",{name:"Close new project",exact:true}).click();
    await first.getByLabel("Name",{exact:true}).fill("Queued latest change");await first.getByRole("button",{name:"Projects",exact:true}).click();
    // Open the still-listed active identity immediately, before its debounce ends.
    await first.getByRole("button",{name:/^Open (First tab version|Queued latest change)$/}).click();await first.getByRole("dialog").waitFor({state:"hidden"});
    assert.equal(await first.getByLabel("Name",{exact:true}).inputValue(),"Queued latest change");
  }finally {await context.close();}
});

test("unavailable storage still permits designing and downloading an editable backup",async()=>{
  const context=await browser.newContext({viewport:{width:1600,height:1000}});
  await context.addInitScript(()=>Object.defineProperty(window,"indexedDB",{get(){throw new DOMException("Storage blocked","SecurityError");}}));
  const tab=await context.newPage();tab.on("dialog",dialog=>dialog.accept());tab.on("pageerror",error=>pageErrors.push(error.message));
  try {
    await tab.goto(page.url());await tab.getByText(/Local projects are unavailable/).waitFor();
    await tab.getByRole("button",{name:"Close new project",exact:true}).click();await tab.getByLabel("Name",{exact:true}).fill("Download without storage");
    await tab.getByText("Local save failed",{exact:true}).waitFor();const download=tab.waitForEvent("download");
    await tab.getByRole("button",{name:"Download backup",exact:true}).click();
    assert.equal(JSON.parse(await readFile(await(await download).path(),"utf8")).project.document.name,"Download without storage");
  }finally {await context.close();}
});

test("undoing the first edit autosaves the original canvas, including before the debounce",async()=>{
  const context=await browser.newContext({viewport:{width:1600,height:1000}}),tab=await context.newPage();
  tab.on("dialog",dialog=>dialog.accept());tab.on("pageerror",error=>pageErrors.push(error.message));
  try {
    await tab.goto(page.url());await tab.getByRole("button",{name:"Close new project",exact:true}).click();
    await tab.getByLabel("Name",{exact:true}).fill("First edit");await tab.getByText("Saved on this device",{exact:true}).waitFor();
    await tab.getByTitle("Undo",{exact:true}).click();await tab.getByText("Saved on this device",{exact:true}).waitFor();
    await tab.reload();await tab.getByRole("button",{name:"Open Festival Parking Decal",exact:true}).click();await tab.getByRole("dialog").waitFor({state:"hidden"});
    assert.equal(await tab.getByLabel("Name",{exact:true}).inputValue(),initialProject.document.name);
    await tab.getByLabel("Name",{exact:true}).fill("Undo before save");await tab.getByTitle("Undo",{exact:true}).click();
    await tab.getByText("Saved on this device",{exact:true}).waitFor();await tab.reload();await tab.getByRole("button",{name:"Open Festival Parking Decal",exact:true}).waitFor();
  }finally {await context.close();}
});

test("a corrupt local snapshot cannot replace or crash the working editor",async()=>{
  const context=await browser.newContext({viewport:{width:1600,height:1000}}),tab=await context.newPage();
  let alert="";tab.on("dialog",dialog=>{alert=dialog.message();return dialog.accept();});tab.on("pageerror",error=>pageErrors.push(error.message));
  try {
    await tab.goto(page.url());await tab.getByRole("button",{name:"Close new project",exact:true}).click();
    await tab.getByLabel("Name",{exact:true}).fill("Keep this working design");await tab.getByText("Saved on this device",{exact:true}).waitFor();
    await tab.evaluate(async()=>{
      const {LOCAL_PROJECT_DB,localProjectRepository}=await import("/qrmagic/src/lib/localProjects.ts");
      const current=await localProjectRepository.read((await localProjectRepository.list())[0].id);
      const broken={...current,id:"corrupt-fixture",project:{...current.project,document:{...current.project.document,name:"Damaged local copy"}}};delete broken.project.export;
      const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(LOCAL_PROJECT_DB);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      await new Promise((resolve,reject)=>{const tx=db.transaction(["projects","recent"],"readwrite");tx.objectStore("projects").put(broken);tx.objectStore("recent").put({...current,id:broken.id,project:undefined,name:"Damaged local copy",width:4,height:3,unit:"in"});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
    });
    await tab.getByRole("button",{name:"Projects",exact:true}).click();await tab.getByRole("button",{name:"Open Damaged local copy",exact:true}).click();
    await tab.getByRole("button",{name:"Open Damaged local copy",exact:true}).waitFor({state:"visible"});
    await tab.waitForFunction(()=>document.querySelector(".project-chooser")?.getAttribute("aria-busy")==="false");
    assert.match(alert,/local copy could not be read/);await tab.getByRole("button",{name:"Close new project",exact:true}).click();
    assert.equal(await tab.getByLabel("Name",{exact:true}).inputValue(),"Keep this working design");
  }finally {await context.close();}
});

test("help opens from the chooser, searches terms and handles empty results",async()=>{
  await page.getByRole("button",{name:"Help & getting started",exact:true}).click();
  const help=page.getByRole("dialog",{name:"Help & getting started",exact:true});
  await help.getByRole("heading",{name:"Make your first QR design",exact:true}).waitFor();
  await help.getByLabel("Search help",{exact:true}).fill("bleed");
  await help.getByRole("button",{name:"Finished size, bleed & safe area",exact:true}).click();
  await help.getByText(/extra artwork beyond the cut edge/).first().waitFor();
  await help.getByLabel("Search help",{exact:true}).fill("nothing-matches-123");
  await help.getByText("No matching topics",{exact:true}).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("heading",{name:"What are you making?",exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Help & getting started",exact:true}).evaluate(el=>el===document.activeElement),true);
});

test("the optional tour completes, restarts and skips without changing the project",async()=>{
  await page.getByRole("button",{name:"Close new project",exact:true}).click();
  await page.getByLabel("Name",{exact:true}).fill("Tour keeps my edits");
  const save=async()=>{const download=page.waitForEvent("download");await page.getByTitle("Save project",{exact:true}).click();return JSON.parse((await readFile(await(await download).path())).toString()).project;};
  const before=await save();
  await page.getByRole("button",{name:"Help",exact:true}).click();
  await page.getByRole("button",{name:"Close help",exact:true}).focus();
  await page.keyboard.press("Control+z");
  await page.getByRole("button",{name:"Take a quick tour",exact:true}).click();
  const tour=page.getByRole("dialog",{name:"Quick tour",exact:true});
  const expectHighlight=async(target)=>page.waitForFunction(target=>{
    const highlighted=document.querySelector(".tour-shade.has-highlight")?.getBoundingClientRect();
    const control=document.querySelector(`[data-guide="${target}"]`)?.getBoundingClientRect();
    return highlighted&&control&&highlighted.width>0&&highlighted.height>0&&Math.abs(highlighted.left-Math.max(6,control.left-4))<2;
  },target);
  await tour.getByText("Step 1 of 6",{exact:true}).waitFor();
  await expectHighlight("document");
  await page.keyboard.press("Control+z");
  for(let step=1;step<6;step++){
    await tour.getByRole("button",{name:"Next",exact:true}).click();
    await tour.getByText(`Step ${step+1} of 6`,{exact:true}).waitFor();
    await expectHighlight(["document","qr","job","layers","save","export"][step]);
  }
  await tour.getByRole("button",{name:"Finish tour",exact:true}).click();
  assert.equal(await page.getByRole("button",{name:"Help",exact:true}).evaluate(el=>el===document.activeElement),true);
  assert.deepEqual(await save(),before);
  await page.getByRole("button",{name:"Help",exact:true}).click();
  await page.getByRole("button",{name:"Restart quick tour",exact:true}).click();
  await page.keyboard.press("Escape");
  assert.equal(await tour.count(),0);
  assert.deepEqual(await save(),before);
  await page.getByRole("button",{name:"New project",exact:true}).click();
  await page.getByRole("button",{name:/^Blank canvas/}).click();
  await page.getByRole("button",{name:"Create project",exact:true}).click();
  const blank=await save();
  await page.getByTitle("Hide panels",{exact:true}).click();
  await page.getByRole("button",{name:"Help",exact:true}).click();
  await page.getByRole("button",{name:"Restart quick tour",exact:true}).click();
  await tour.getByRole("button",{name:"Next",exact:true}).click();
  await tour.getByText(/This blank canvas has no QR yet/).waitFor();
  await expectHighlight("layers");
  await tour.getByRole("button",{name:"Back",exact:true}).click();
  await tour.getByText("Step 1 of 6",{exact:true}).waitFor();
  await tour.getByRole("button",{name:"Skip tour",exact:true}).click();
  await page.getByTitle("Show panels",{exact:true}).waitFor();
  assert.deepEqual(await save(),blank);
  await page.reload();
});

test("help tips work with keyboard, hover and click, and the guide fits narrow screens",async()=>{
  await page.getByRole("button",{name:"Close new project",exact:true}).click();
  await page.getByRole("button",{name:"Print setup",exact:true}).click();
  const tip=page.getByRole("button",{name:"About bleed",exact:true});
  await tip.focus();await page.getByRole("tooltip").filter({hasText:/extra artwork/}).waitFor();
  await page.keyboard.press("Escape");await page.getByRole("tooltip").waitFor({state:"hidden"});
  await tip.hover();await page.getByRole("tooltip").waitFor();
  await tip.click();await page.mouse.move(10,10);await page.getByRole("tooltip").waitFor();
  await page.keyboard.press("Escape");
  await tip.click();await page.getByLabel("Bleed outside cut (mm)",{exact:true}).click();
  await page.getByRole("tooltip").waitFor({state:"hidden"});
  await page.getByRole("button",{name:"Print layout",exact:true}).click();
  await page.getByRole("button",{name:"Help",exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  const help=page.getByRole("dialog",{name:"Help & getting started",exact:true});
  assert.equal(await help.evaluate(el=>el.getBoundingClientRect().right<=window.innerWidth&&el.scrollWidth<=el.clientWidth+1),true);
  await help.getByLabel("Search help",{exact:true}).fill("redirect");
  await help.getByRole("button",{name:"QR content & destinations",exact:true}).click();
  await help.getByText(/managed redirects or scan tracking/).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button",{name:"Help",exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.getByRole("button",{name:"Help",exact:true}).click();
  await help.getByRole("button",{name:"Back to design & start tour",exact:true}).click();
  const tour=page.getByRole("dialog",{name:"Quick tour",exact:true});
  for(let step=0;step<6;step++){
    await tour.getByText(`Step ${step+1} of 6`,{exact:true}).waitFor();
    await page.waitForFunction(target=>{
      const highlight=document.querySelector(".tour-shade.has-highlight")?.getBoundingClientRect();
      const element=document.querySelector(`[data-guide="${target}"]`)?.getBoundingClientRect();
      return highlight&&element&&highlight.width>0&&highlight.height>0&&element.width>0&&Math.abs(highlight.left-Math.max(6,element.left-4))<2;
    },["document","qr","job","layers","save","export"][step]);
    assert.equal(await tour.evaluate(el=>el.getBoundingClientRect().left>=0&&el.getBoundingClientRect().right<=window.innerWidth),true);
    if(step<5)await tour.getByRole("button",{name:"Next",exact:true}).click();
  }
  await page.keyboard.press("Escape");
  await page.setViewportSize({width:1600,height:1000});
  await page.reload();
});

test("generated QR previews release source images while imported artwork remains reusable",async()=>{
  const result=await page.evaluate(async()=>{
    const {renderProjectPngBlob}=await import("/qrmagic/src/lib/exportRenderer.ts");
    const {createStarterProject}=await import("/qrmagic/src/lib/templates.ts");
    const {createDataRecords}=await import("/qrmagic/src/lib/serial.ts");
    const {defaultLayerShadow}=await import("/qrmagic/src/lib/project.ts");
    const {renderStyledQrDataUrl}=await import("/qrmagic/src/lib/qrStyling.ts");
    const project=createStarterProject("stickers",{width:25.4,height:25.4,payload:`https://example.com/cache/${Date.now()}`});
    project.layers=project.layers.filter(layer=>layer.type==="qr");
    const record=createDataRecords(project.data.groups)[0],Original=window.Image;
    const qrSource=await renderStyledQrDataUrl(project.layers[0],record);
    const canvas=document.createElement("canvas");canvas.width=2;canvas.height=2;canvas.getContext("2d").fillRect(0,0,2,2);
    const asset=canvas.toDataURL();let generated=0,imported=0;
    window.Image=class extends Original{
      set src(value){if(value===qrSource)generated++;if(value===asset)imported++;super.src=value;}
      get src(){return super.src;}
    };
    try{
      await renderProjectPngBlob(project,record,{includeGuides:false});
      await renderProjectPngBlob(project,record,{includeGuides:false});
      project.layers=[{...project.layers[0],...defaultLayerShadow,id:"image-reuse",type:"image",src:asset,assetId:"asset",fit:"stretch"}];
      await renderProjectPngBlob(project,record,{includeGuides:false});
      await renderProjectPngBlob(project,record,{includeGuides:false});
      return {generated,imported};
    }finally{window.Image=Original;}
  });
  assert.equal(result.generated,2,"ephemeral QR images must not be retained in the permanent image cache");
  assert.equal(result.imported,1,"imported artwork keeps its reusable image cache");
});

test("layout PDF panels preserve rotated serial/fixed QR artwork, counts, cut references and cancellation", async () => {
  const result=await page.evaluate(async()=>{
    const { exportLayoutPackage }=await import("/qrmagic/src/lib/printLayoutExport.ts");
    const { defaultLayoutSettings,calculateLayout,layoutPanel }=await import("/qrmagic/src/lib/printLayout.ts");
    const { createStarterProject }=await import("/qrmagic/src/lib/templates.ts");
    const { initialProject }=await import("/qrmagic/src/lib/project.ts");
    const { getDocument,decodeQr,JSZip }=await import("/qrmagic/tests/pdf-fixture.ts");
    const project=createStarterProject("stickers",{width:50.8,height:76.2,copies:2});
    const serial=structuredClone(initialProject.data.groups[0]); serial.serial.quantity=3;
    project.data.groups=[serial,{id:"fixed",name:"Static",mode:"fixed",fixed:{quantity:1,value:"https://example.com/static"}}];
    const qr=project.layers.find(l=>l.type==="qr"); qr.dataGroupId=serial.id;
    project.layers.push({...qr,id:"static-qr",dataGroupId:"fixed",width:200,height:200,x:350,y:650,margin:25});
    const title=project.layers.find(l=>l.type==="text"); title.textTemplate="Item {{serial}}";title.dataGroupId=serial.id; title.fontSize=30;
    const settings={...defaultLayoutSettings(),media:"sheet",widthMm:190,heightMm:140,gapX:4,gapY:4,orientation:"rotated"};
    const progress=[];
    const blob=await exportLayoutPackage(project,settings,{onProgress:p=>progress.push(p)});
    const zip=await JSZip.loadAsync(blob);
    const bytes=await zip.file("artwork.pdf").async("uint8array");
    const loading=getDocument({data:bytes.slice()}),pdf=await loading.promise;
    const plan=calculateLayout(project,settings),pages=[];
    for(let index=0;index<plan.panelCount;index++) {
      const panel=layoutPanel(plan,index),pdfPage=await pdf.getPage(index+1);
      const viewport=pdfPage.getViewport({scale:300/72}),canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      const ctx=canvas.getContext("2d"); await pdfPage.render({canvas,canvasContext:ctx,viewport}).promise;
      const decoded=[];
      for(const placement of panel.placements) {
        // Decode each QR in its own rotated source rectangle to avoid finding just
        // the first symbol when an item deliberately contains two independent QRs.
        const codes=[];
        for(const layer of project.layers.filter(l=>l.type==="qr")) {
          const scale=25.4/project.document.dpi;
          const x=(placement.xMm+plan.itemHeightMm-project.document.bleedMm-(layer.y+layer.height)*scale)*300/25.4;
          const y=(placement.yMm+project.document.bleedMm+layer.x*scale)*300/25.4;
          const image=ctx.getImageData(Math.round(x),Math.round(y),Math.round(layer.height),Math.round(layer.width));
          codes.push(decodeQr(image.data,image.width,image.height)?.data);
        }
        decoded.push(codes);
      }
      pages.push({decoded,text:(await pdfPage.getTextContent()).items.map(i=>i.str).join(" ")});
    }
    await loading.destroy();
    const abort=new AbortController(); let aborted=false;
    try {await exportLayoutPackage(project,settings,{signal:abort.signal,onProgress:p=>{if(p.stage==="panels")abort.abort();}});}catch(e){aborted=e.name==="AbortError";}
    return {bytes:[...bytes],pages,progress,aborted,job:JSON.parse(await zip.file("job.json").async("string")),
      csv:await zip.file("placements.csv").async("string"),svg:await zip.file("cut-reference/panel-0002.svg").async("string"),
      preflight:JSON.parse(await zip.file("preflight.json").async("string"))};
  });
  const pdf=await PDFDocument.load(Uint8Array.from(result.bytes));
  assert.equal(pdf.getPageCount(),2);
  assert.ok(Math.abs(pdf.getPage(0).getWidth()-190/25.4*72)<0.001);
  assert.ok(Math.abs(pdf.getPage(0).getHeight()-140/25.4*72)<0.001);
  assert.deepEqual(result.pages.flatMap(p=>p.decoded),[1,1,2,2,3,3].map(i=>[`PARK-000${i}`,"https://example.com/static"]));
  assert.match(result.pages.at(-1).text,/PARK-0003/);
  assert.equal(result.job.quantity.total,6); assert.equal(result.preflight.stats.uniqueRecords,3);
  assert.equal(result.csv.trim().split(/\r?\n/).length,7);
  assert.equal((result.svg.match(/data-item=/g)||[]).length,2);
  assert.match(result.svg,/rotate\(90\)/); assert.equal(result.aborted,true);
  assert.ok(result.progress.some(p=>p.stage==="panels"&&p.completed===2));
});

test("print layout workspace validates, navigates, saves settings and works on narrow screens",async()=>{
  await page.reload(); await page.getByRole("button",{name:"Close new project",exact:true}).click();
  await page.getByRole("button",{name:"Print layout",exact:true}).click();
  await page.getByRole("heading",{name:"Print layout",exact:true}).waitFor();
  await page.setViewportSize({width:1280,height:720});
  assert.equal(await page.getByRole("button",{name:"Download layout package",exact:true}).evaluate(element=>element.getBoundingClientRect().bottom<=window.innerHeight),true,"download action remains visible on a laptop screen");
  await page.setViewportSize({width:1600,height:1000});
  await page.getByLabel("Roll width",{exact:true}).fill("80");
  await page.getByRole("alert").filter({hasText:/do not fit/}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Download layout package",exact:true}).isDisabled(),true);
  await page.getByRole("button",{name:"Reset layout",exact:true}).click();
  await page.getByLabel("Maximum panel length",{exact:true}).fill("120");
  await page.getByRole("button",{name:"Next panel",exact:true}).click();
  assert.match(await page.getByTestId("layout-page-label").innerText(),/Panel 2/);
  await page.getByRole("button",{name:"Zoom in",exact:true}).click();
  await page.getByRole("button",{name:"Fit layout",exact:true}).click();
  await page.getByLabel("Layout units",{exact:true}).selectOption("in");
  assert.equal(await page.getByLabel("Roll width",{exact:true}).inputValue(),"24");
  await page.getByRole("button",{name:"Download layout package",exact:true}).click();
  await page.getByRole("button",{name:"Cancel export",exact:true}).click();
  await page.getByText("Export cancelled. Your layout settings are kept.",{exact:true}).waitFor();
  assert.equal(await page.getByLabel("Roll width",{exact:true}).isEnabled(),true);
  const layoutDownload=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download layout package",exact:true}).click();
  const layoutZip=await JSZip.loadAsync(await readFile(await(await layoutDownload).path()));
  assert.equal(JSON.parse(await layoutZip.file("job.json").async("string")).quantity.total,10);
  await page.getByRole("button",{name:"Back to design",exact:true}).click();
  const downloading=page.waitForEvent("download"); await page.getByTitle("Save project",{exact:true}).click();
  const saved=JSON.parse((await readFile(await(await downloading).path())).toString());
  assert.equal(saved.project.production.layout.heightMm,120);
  await page.locator('input[type="file"][accept=".qrmagic.json,application/json"]').setInputFiles({name:"saved.qrmagic.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(saved))});
  await page.getByRole("button",{name:"Print layout",exact:true}).click();
  assert.equal(await page.getByLabel("Layout units",{exact:true}).inputValue(),"in");
  await page.setViewportSize({width:790,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await page.getByRole("button",{name:"Back to design",exact:true}).click();
  saved.project.production.layout.widthMm=null;
  await page.locator('input[type="file"][accept=".qrmagic.json,application/json"]').setInputFiles({name:"invalid-layout.qrmagic.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(saved))});
  await page.getByRole("button",{name:"Inspector",exact:true}).click();
  await page.getByRole("button",{name:"Print layout",exact:true}).click();
  await page.getByRole("alert").filter({hasText:/Media dimensions/}).waitFor();
  await page.getByRole("button",{name:"Reset layout",exact:true}).click();
  assert.equal(await page.getByRole("button",{name:"Download layout package",exact:true}).isEnabled(),true);
  await page.getByRole("button",{name:"Back to design",exact:true}).click();
  await page.setViewportSize({width:1600,height:1000}); await page.reload();
});

test("layout clips overflowing vector artwork, preserves fallback effects, and leaves gaps/unused slots empty",async()=>{
  const result=await page.evaluate(async()=>{
    const {exportLayoutPackage}=await import("/qrmagic/src/lib/printLayoutExport.ts");
    const {defaultLayoutSettings}=await import("/qrmagic/src/lib/printLayout.ts");
    const {createStarterProject}=await import("/qrmagic/src/lib/templates.ts");
    const {initialProject}=await import("/qrmagic/src/lib/project.ts");
    const {getDocument,JSZip}=await import("/qrmagic/tests/pdf-fixture.ts");
    const p=createStarterProject("blank",{width:25.4,height:25.4,bleedMm:0,copies:3});
    const base=initialProject.layers.find(l=>l.type==="shape");
    p.document.shape.shape="ellipse";
    p.layers=[{...base,id:"overflow",x:-60,y:-60,width:600,height:600,fill:"#ff0000",opacity:.6,cornerRadius:0},
      {...base,id:"gradient",x:90,y:90,width:120,height:120,fillMode:"linear-gradient",shadowEnabled:true,cornerRadius:0}];
    const settings={...defaultLayoutSettings(),media:"sheet",widthMm:80,heightMm:80,marginTop:5,marginBottom:5,marginLeft:5,marginRight:5,gapX:5,gapY:5};
    const zip=await JSZip.loadAsync(await exportLayoutPackage(p,settings));
    const loading=getDocument({data:await zip.file("artwork.pdf").async("uint8array")}),pdf=await loading.promise,pdfPage=await pdf.getPage(1);
    const canvas=document.createElement("canvas"),viewport=pdfPage.getViewport({scale:150/72});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const ctx=canvas.getContext("2d");
    await pdfPage.render({canvas,canvasContext:ctx,viewport}).promise;
    const sample=(x,y)=>[...ctx.getImageData(Math.round(x*150/25.4),Math.round(y*150/25.4),1,1).data];
    const samples={margin:sample(2,2),gap:sample(33,15),empty:sample(50,50),filled:sample(10,10)};
    await loading.destroy();
    const report=JSON.parse(await zip.file("preflight.json").async("string"));
    const svg=await zip.file("cut-reference/panel-0001.svg").async("string");
    // Exercise the requested 5,000-copy scale with one unique source render.
    const many=createStarterProject("stickers",{width:50.8,height:50.8,copies:5000,payload:"https://example.com/batch"});
    const large=await JSZip.loadAsync(await exportLayoutPackage(many,defaultLayoutSettings()));
    const largeReport=JSON.parse(await large.file("preflight.json").async("string"));
    const job=JSON.parse(await large.file("job.json").async("string"));
    const abortZip=new AbortController();
    const cancelled=exportLayoutPackage(many,defaultLayoutSettings(),{signal:abortZip.signal,onProgress:p=>{if(p.stage==="package"&&p.completed>10)abortZip.abort();}})
      .then(()=>false,e=>e.name==="AbortError");
    const zipAborted=await Promise.race([cancelled,new Promise(resolve=>setTimeout(()=>resolve(false),3000))]);
    return {samples,report,svg,largeReport,job,zipAborted};
  });
  for(const key of ["margin","gap","empty"])assert.deepEqual(result.samples[key],[255,255,255,255],key);
  assert.ok(result.samples.filled[0]>240&&result.samples.filled[1]<150);
  assert.equal(result.report.stats.rasterLayers,1);
  assert.match(result.svg,/A 12\.7 12\.7/);
  assert.equal(result.largeReport.stats.uniqueRecords,1);
  assert.equal(result.job.panelCount,35);
  assert.equal(result.job.pages.at(-1).itemCount,104);
  assert.equal(result.zipAborted,true,"cancellation during ZIP packaging rejects cleanly");
});

test("production PDF preserves vectors, embedded text, exact page boxes, and serialized QR copies", async () => {
  const result = await page.evaluate(async () => {
    const { renderProductionPdf } = await import("/qrmagic/src/lib/productionPdf.ts");
    const { createStarterProject } = await import("/qrmagic/src/lib/templates.ts");
    const { createPrintRecords } = await import("/qrmagic/src/lib/production.ts");
    const { getDocument, OPS, decodeQr } = await import("/qrmagic/tests/pdf-fixture.ts");
    const project = createStarterProject("decals", { records: 2, copies: 2 });
    const result = await renderProductionPdf(project, createPrintRecords(project));
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const loadingTask = getDocument({ data: bytes.slice() });
    const pdf = await loadingTask.promise;
    const pages = [];
    let preview;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const canvas = document.createElement("canvas");
      const viewport = page.getViewport({ scale: 300 / 72 });
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      if (i === 1) preview = canvas.toDataURL();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const operators = await page.getOperatorList();
      pages.push({ qr: decodeQr(pixels.data, canvas.width, canvas.height)?.data,
        text: (await page.getTextContent()).items.map(item => item.str).join(" "),
        images: operators.fnArray.filter(op => op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject).length,
        paths: operators.fnArray.filter(op => op === OPS.constructPath).length });
    }
    await loadingTask.destroy();
    return { pages, preview, bytes: [...bytes], issues: result.issues, stats: result.stats };
  });
  if (process.env.QRMAGIC_REVIEW_DIR) await writeFile(join(process.env.QRMAGIC_REVIEW_DIR, "production-pdf-preview.png"), Buffer.from(result.preview.split(",")[1], "base64"));
  assert.deepEqual(result.issues, []);
  assert.equal(result.stats.rasterLayers, 0);
  assert.equal(result.stats.uniqueRecords, 2);
  const pdf = await PDFDocument.load(Uint8Array.from(result.bytes));
  assert.equal(pdf.getPageCount(), 4);
  assert.ok(Math.abs(pdf.getPage(0).getTrimBox().width - 288) < 0.001);
  assert.ok(Math.abs(pdf.getPage(0).getBleedBox().width - 107.6 / 25.4 * 72) < 0.001);
  assert.ok(pdf.context.enumerateIndirectObjects().some(([, obj]) => obj.toString().includes("/FontFile2")), "font bytes embedded");
  assert.deepEqual(result.pages.map(page => page.qr), ["PARK-0001", "PARK-0001", "PARK-0002", "PARK-0002"]);
  for (const page of result.pages) {
    assert.equal(page.images, 0);
    assert.ok(page.paths > 0);
    assert.match(page.text, /PARK-000[12]/);
  }
});

test("production package download contains artwork, reference cut geometry, job and preflight reports", async () => {
  await page.getByRole("dialog").getByRole("button",{name:"New project",exact:true}).click();
  await page.getByRole("button", { name: /Repeated stickers/ }).click();
  await page.getByLabel("QR content", { exact: true }).fill("https://example.com/print");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByLabel("Set format", { exact: true }).selectOption("production-pdf");
  await page.getByText(/RGB artwork/).waitFor();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download production package", exact: true }).click();
  const downloaded = await downloading;
  const zip = await JSZip.loadAsync(await readFile(await downloaded.path()));
  const pdf = await PDFDocument.load(await zip.file("artwork.pdf").async("uint8array"));
  assert.equal(pdf.getPageCount(), 1);
  assert.match(await zip.file("cut-outline.svg").async("string"), /reference geometry/);
  const job = JSON.parse(await zip.file("job.json").async("string"));
  assert.equal(job.quantity.total, 1);
  const report = JSON.parse(await zip.file("preflight.json").async("string"));
  assert.equal(report.stats.rasterLayers, 0);
  assert.equal(report.colorSpace, "RGB");
  assert.equal(report.machineProfile, null);
  assert.match(await zip.file("README.txt").async("string"), /100%/);
  if (process.env.QRMAGIC_REVIEW_DIR) await page.screenshot({ path: join(process.env.QRMAGIC_REVIEW_DIR, "production-export-editor.png") });
  // Start the next editor flow with a fresh project and selection.
  await page.reload();
});

test("production preflight blocks empty content and reports runtime glyph fallback once per layer", async () => {
  const result = await page.evaluate(async () => {
    const { renderProductionPdf } = await import("/qrmagic/src/lib/productionPdf.ts");
    const { createStarterProject } = await import("/qrmagic/src/lib/templates.ts");
    const { createPrintRecords } = await import("/qrmagic/src/lib/production.ts");
    const project = createStarterProject("stickers", { payload: "https://example.com" });
    project.layers.find(layer => layer.type === "text").textTemplate = "Print 中文";
    project.data.groups[0].fixed.quantity = 2;
    const result = await renderProductionPdf(project, createPrintRecords(project));
    project.data.groups[0].fixed.value = "";
    let error;
    try { await renderProductionPdf(project, createPrintRecords(project)); } catch (cause) { error = cause.message; }
    return { issues: result.issues, stats: result.stats, error };
  });
  assert.equal(result.issues.filter(issue => issue.code === "raster-glyphs").length, 1);
  assert.equal(result.stats.rasterLayers, 2);
  assert.match(result.error, /QR content is empty/);
});

test("production PDF matches rendered artwork across shapes, text, transparency and fallback effects", async () => {
  const results = await page.evaluate(async () => {
    const { renderProductionPdf } = await import("/qrmagic/src/lib/productionPdf.ts");
    const { renderProjectPngBlob } = await import("/qrmagic/src/lib/exportRenderer.ts");
    const { initialProject } = await import("/qrmagic/src/lib/project.ts");
    const { createDataRecords } = await import("/qrmagic/src/lib/serial.ts");
    const { presetShapeGeometry, SHAPE_OPTIONS } = await import("/qrmagic/src/lib/shapeGeometry.ts");
    const { getDocument, fontkit } = await import("/qrmagic/tests/pdf-fixture.ts");
    const { productionFontUrls } = await import("/qrmagic/src/lib/fonts.ts");
    const results = [];
    const shape = initialProject.layers.find(layer => layer.type === "shape");
    const text = initialProject.layers.find(layer => layer.type === "text");
    const qr = initialProject.layers.find(layer => layer.type === "qr");
    const fixtures = SHAPE_OPTIONS.map(({ value }) => ({ ...shape, ...presetShapeGeometry(value),
      x: 70, y: 65, width: 130, height: 90, rotation: 17, strokeWidth: 3,
      fill: "#fc1260", stroke: "#234567" }));
    fixtures.push({ ...shape, x: 30, y: 30, width: 150, height: 100, stroke: "transparent", strokeWidth: 18 });
    fixtures.push(...["left", "center", "right"].map(align => ({ ...text, align, x: 20, y: 30, width: 200, height: 100,
      fontSize: 24, textTemplate: "AV office\nPrint 123", rotation: 7, fillOpacity: 0.6 })));
    fixtures.push({ ...text, x: 10, y: 50, width: 240, height: 100, fontSize: 28, fontWeight: 400,
      textTemplate: "AVAVAVAVAVAV", align: "left" });
    fixtures.push({ ...shape, x: 30, y: 30, width: 150, height: 90, fillMode: "linear-gradient", shadowEnabled: true });
    fixtures.push({ ...text, x: 30, y: 30, width: 150, height: 90, fill: "transparent" });
    fixtures.push({ ...qr, x: 40, y: 30, width: 140, height: 140, margin: 14, opacity: 0.5 });
    for (const layer of fixtures) {
      const project = structuredClone(initialProject);
      project.document = { ...project.document, unit: "px", width: 260, height: 210, bleedMm: 0,
        backgroundColor: "#abcdef", backgroundOpacity: 0.3 };
      project.layers = [layer];
      const records = createDataRecords(project.data.groups).slice(0, 1);
      const result = await renderProductionPdf(project, records);
      const loadingTask = getDocument({ data: new Uint8Array(await result.blob.arrayBuffer()) });
      const pdfPage = await (await loadingTask.promise).getPage(1);
      const canvas = document.createElement("canvas"); canvas.width = 260; canvas.height = 210;
      const context = canvas.getContext("2d");
      await pdfPage.render({ canvasContext: context, canvas, viewport: pdfPage.getViewport({ scale: 300 / 72 }) }).promise;
      const actual = context.getImageData(0, 0, 260, 210).data;
      const image = await createImageBitmap(await renderProjectPngBlob(project, records[0], { includeGuides: false }));
      context.fillStyle = "white"; context.fillRect(0, 0, 260, 210); context.drawImage(image, 0, 0); image.close();
      const expected = context.getImageData(0, 0, 260, 210).data;
      let totalDifference = 0, differentPixels = 0;
      for (let i = 0; i < actual.length; i += 4) {
        const delta = Math.max(...[0, 1, 2].map(channel => Math.abs(actual[i + channel] - expected[i + channel])));
        totalDifference += delta;
        if (delta > 35) differentPixels++;
      }
      let textMetrics;
      if(layer.type==="text") {
        context.font=`${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
        const font=fontkit.create(new Uint8Array(await(await fetch(productionFontUrls[layer.fontWeight])).arrayBuffer()));
        textMetrics={text:layer.textTemplate,fontSize:layer.fontSize,weight:layer.fontWeight,
          canvas:context.measureText(layer.textTemplate).width,
          shaped:font.layout(layer.textTemplate).positions.reduce((width,p)=>width+p.xAdvance,0)*layer.fontSize/font.unitsPerEm};
      }
      results.push({ type: `${layer.type} ${layer.shape || layer.align || ""} ${layer.fillMode || ""} ${layer.fill}`, textMetrics,
        mean: totalDifference / (260 * 210), fraction: differentPixels / (260 * 210), stats: result.stats,
        samples: [[0,0], [50,50], [70,70], [90,90], [110,110]].map(([x,y]) => ({ x,y, actual: [...actual.slice((y*260+x)*4,(y*260+x)*4+3)], expected: [...expected.slice((y*260+x)*4,(y*260+x)*4+3)] })) });
      await loadingTask.destroy();
    }
    return results;
  });
  for (const result of results) {
    assert.ok(result.mean < 3 && result.fraction < 0.025, JSON.stringify(result));
  }
  // PDF/canvas color rounding differs by one channel value on the page background.
  assert.ok(results.at(-1).mean < 1.2, `QR opacity: ${JSON.stringify(results.at(-1))}`);
  for (const sample of results.at(-1).samples) assert.ok(sample.actual.every((value, index) =>
    Math.abs(value - sample.expected[index]) <= 2), JSON.stringify(sample));
  assert.equal(results.at(-3).stats.rasterLayers, 1, "gradient/shadow fallback is reported");
});

test("production QR style variants remain vectors and decode after PDF rendering", async () => {
  const results = await page.evaluate(async () => {
    const { renderProductionPdf } = await import("/qrmagic/src/lib/productionPdf.ts");
    const { createStarterProject } = await import("/qrmagic/src/lib/templates.ts");
    const { createPrintRecords } = await import("/qrmagic/src/lib/production.ts");
    const { getDocument, decodeQr } = await import("/qrmagic/tests/pdf-fixture.ts");
    const styles = ["square", "dots", "rounded", "classy", "classy-rounded", "extra-rounded"];
    const results = [];
    for (const dotStyle of styles) {
      const project = createStarterProject("stickers", { width: 76.2, height: 76.2, payload: "https://example.com/vector" });
      const qr = project.layers.find(layer => layer.type === "qr");
      qr.dotStyle = dotStyle; qr.cornerSquareStyle = "extra-rounded"; qr.cornerDotStyle = "dot";
      qr.x = 150; qr.y = 230; qr.width = qr.height = 500; qr.margin = 50;
      qr.rotation = 7; qr.opacity = 0.9;
      const result = await renderProductionPdf(project, createPrintRecords(project));
      const task = getDocument({ data: new Uint8Array(await result.blob.arrayBuffer()) });
      const pdfPage = await (await task.promise).getPage(1);
      const viewport = pdfPage.getViewport({ scale: 300 / 72 });
      const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      results.push({ dotStyle, payload: decodeQr(pixels.data, canvas.width, canvas.height)?.data, stats: result.stats });
      await task.destroy();
    }
    return results;
  });
  for (const result of results) {
    assert.equal(result.stats.rasterLayers, 0, JSON.stringify(result));
    assert.equal(result.payload, "https://example.com/vector", JSON.stringify(result));
  }
});

before(async () => {
  server = await createServer({
    // A concurrent local editor must not share optimizer files with this server.
    cacheDir: "node_modules/.vite-export-tests",
    server: { host: "127.0.0.1", port: 0 },
    optimizeDeps: { include: ["konva", "@pdf-lib/fontkit", "pdfjs-dist/build/pdf.mjs", "jsqr"] },
  });
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.goto(`${server.resolvedUrls.local[0]}qrmagic/`);
  initialProject = await page.evaluate(async () => {
    const { initialProject } = await import("/qrmagic/src/lib/project.ts");
    return initialProject;
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
  assert.deepEqual(pageErrors, [], "the editor must not produce uncaught browser errors");
});

function projectWith(layers = [], backgroundOpacity = 0) {
  const project = structuredClone(initialProject);
  project.document = {
    ...project.document, unit: "px", width: 240, height: 180,
    backgroundColor: "#2468ac", backgroundOpacity,
    transparentBackground: backgroundOpacity === 0,
    guides: { ...project.document.guides, enabled: false },
  };
  project.layers = layers;
  return project;
}

function shape(patch = {}) {
  return {
    ...initialProject.layers[0], id: "fixture", x: 35, y: 30,
    width: 120, height: 90, cornerRadius: 0,
    fill: "#ff0000", fillOpacity: 1,
    ...patch,
  };
}

async function comparePreviewAndExport(project) {
  project = structuredClone(project);
  project.layers.forEach((layer) => { layer.id = `fixture_${++fixtureIndex}`; });
  await page.locator('input[type="file"][accept=".qrmagic.json,application/json"]').setInputFiles({
    name: "fixture.qrmagic.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.waitForFunction(()=>document.querySelector(".workspace")?.getAttribute("aria-busy")==="false");
  // React Konva commits its canvas tree separately from the editor DOM. Wait
  // for paint before reading/cloning it after an asynchronous project switch.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  // Await React's update and async QR/image loading, not an arbitrary timeout.
  await page.waitForFunction(async (expected) => {
    const { Konva } = await import("/qrmagic/tests/rendering-fixture.ts");
    const content = Konva.stages[0]?.findOne(".document-content");
    if (!content) return false;
    const nodes = content.find(".design-layer");
    if (nodes.length !== expected.layers.length) return false;
    if (content.findOne(".document-background").fill() !==
        `rgba(36, 104, 172, ${expected.document.backgroundOpacity})`) return false;
    return expected.layers.every((layer, i) => {
      const node = nodes[i];
      if (node.id() !== layer.id) return false;
      if (layer.type === "qr") return Boolean(node.findOne("Image")?.image());
      if (layer.type === "image") return Boolean(node.image());
      return true;
    });
  }, project);

  return page.evaluate(async (project) => {
    const { Konva } = await import("/qrmagic/tests/rendering-fixture.ts");
    const { renderProjectPngBlob } = await import("/qrmagic/src/lib/exportRenderer.ts");
    const { createDataRecords } = await import("/qrmagic/src/lib/serial.ts");
    const { productionGeometry } = await import("/qrmagic/src/lib/production.ts");
    await document.fonts.ready;
    for (let attempt = 0; attempt < 100; attempt++) {
      const nodes = Konva.stages[0].find(".design-layer");
      const ready = project.layers.every((layer, i) => layer.type !== "qr" || Boolean(nodes[i]?.findOne("Image")?.image()));
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    Konva.stages[0].find("Transformer").forEach((node) => node.detach());
    const clone = Konva.stages[0].findOne(".document-content").clone({ x: 0, y: 0 });
    // Workspace decorations are deliberately excluded from production output.
    clone.find(".selection-overlay").forEach((node) => node.destroy());
    clone.find("Transformer").forEach((node) => node.destroy());
    clone.findOne(".document-background").shadowEnabled(false);
    const { output: { width, height }, bleedPixels } = productionGeometry(project);
    const preview = clone.toCanvas({ x: -bleedPixels, y: -bleedPixels, width, height, pixelRatio: 1 });
    clone.destroy();
    const blob = await renderProjectPngBlob(project, createDataRecords(project.data.groups)[0], {
      includeGuides: false,
    });
    const image = await createImageBitmap(blob);
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const context = output.getContext("2d");
    context.drawImage(image, 0, 0);
    image.close();
    
    const expected = preview.getContext("2d").getImageData(0, 0, width, height).data;
    const actual = context.getImageData(0, 0, width, height).data;
    let differentPixels = 0;
    const samples = [];
    for (let i = 0; i < expected.length; i += 4) {
      if ([0, 1, 2, 3].some((channel) => Math.abs(expected[i + channel] - actual[i + channel]) > 1)) {
        differentPixels++;
        if (samples.length < 5) samples.push({ x: (i/4)%width, y: Math.floor(i/4/width), expected: [...expected.slice(i,i+4)], actual: [...actual.slice(i,i+4)] });
      }
    }
    return { samples, differentPixels, width: output.width, height: output.height,
      previewIds:Konva.stages[0].find(".design-layer").map(n=>n.id()),expectedIds:project.layers.map(l=>l.id),background:Konva.stages[0].findOne(".document-background").fill(),expectedBackground:project.document.backgroundOpacity,
      opening:document.querySelector(".workspace")?.getAttribute("aria-busy") };
  }, project);
}

async function matchesPreview(project) {
  const result = await comparePreviewAndExport(project);
  assert.equal(result.width, 240);
  assert.equal(result.height, 180);
  assert.equal(result.differentPixels, 0, JSON.stringify(result));
}

test("new project chooser creates, exports, saves, and reopens a repeated sticker job", async () => {
  await page.getByRole("dialog").getByRole("button",{name:"New project",exact:true}).click();
  await page.getByRole("button", { name: /Repeated stickers/ }).click();
  await page.getByLabel("QR content", { exact: true }).fill("https://example.com/event");
  await page.getByLabel("Quantity", { exact: true }).first().fill("3");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByText("3 copies · same design", { exact: true }).first().waitFor();
  await page.getByLabel("Cut shape", { exact: true }).selectOption("ellipse");
  const saved = page.waitForEvent("download");
  await page.getByTitle("Save project", { exact: true }).click();
  const savedFile = await saved;
  const bytes = await readFile(await savedFile.path());
  const project = JSON.parse(bytes.toString()).project;
  assert.equal(project.version, 2);
  assert.equal(project.production.copiesPerRecord, 3);
  assert.equal(project.document.width, 50.8);
  assert.equal(project.document.bleedMm, 3);
  assert.equal(project.document.shape.shape, "ellipse");
  await page.getByLabel("Set format", { exact: true }).selectOption("pdf");
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download job PDF", exact: true }).click();
  const pdfFile = await exported;
  const pdf = await PDFDocument.load(await readFile(await pdfFile.path()));
  assert.equal(pdf.getPageCount(), 3);
  const first = pdf.getPage(0);
  assert.ok(Math.abs(first.getTrimBox().width - 144) < 0.01);
  assert.ok(Math.abs(first.getTrimBox().x - 3 / 25.4 * 72) < 0.01);
  assert.ok(Math.abs(first.getSize().width - 56.8 / 25.4 * 72) < 0.01);
  await page.locator('input[type="file"][accept=".qrmagic.json,application/json"]').setInputFiles({
    name: "saved.qrmagic.json", mimeType: "application/json", buffer: bytes,
  });
  await page.getByText("3 copies · same design", { exact: true }).first().waitFor();
  assert.equal(await page.locator("dialog").count(), 0);
});

test("bleed exports preserve artwork outside trim and align PNG with PDF", async () => {
  const result = await page.evaluate(async () => {
    const { createStarterProject } = await import("/qrmagic/src/lib/templates.ts");
    const { renderProjectPngBlob } = await import("/qrmagic/src/lib/exportRenderer.ts");
    const { createDataRecords } = await import("/qrmagic/src/lib/serial.ts");
    const { initialProject } = await import("/qrmagic/src/lib/project.ts");
    const project = createStarterProject("blank", { width: 50.8, height: 50.8, bleedMm: 3.175 });
    project.layers = [{ ...initialProject.layers[0], x: -38, y: -38, width: 100, height: 100,
      cornerRadius: 0, fill: "#ff0000", fillOpacity: 1 }];
    const blob = await renderProjectPngBlob(project, createDataRecords(project.data.groups)[0], { includeGuides: false });
    const image = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
    const pixel = [...context.getImageData(1, 1, 1, 1).data];
    return { width: image.width, height: image.height, pixel };
  });
  assert.equal(result.width, 676);
  assert.equal(result.height, 676);
  assert.deepEqual(result.pixel, [255, 0, 0, 255]);
});

test("fixed jobs have one quantity and multiple persistent independent QR values", async () => {
  const project = await page.evaluate(async () => {
    const { createStarterProject } = await import("/qrmagic/src/lib/templates.ts");
    const project = createStarterProject("stickers", { copies: 10, payload: "https://example.com/first" });
    project.data.groups[0].fixed.quantity = 4;
    return project;
  });
  await page.locator('input[type="file"][accept=".qrmagic.json,application/json"]').setInputFiles({
    name: "legacy-fixed.qrmagic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.getByText("40 copies · same design", { exact: true }).first().waitFor();
  assert.equal(await page.getByLabel("Quantity", { exact: true }).inputValue(), "40");
  assert.equal(await page.getByLabel("Unique records", { exact: true }).count(), 0);
  await page.getByLabel("Add layer", { exact: true }).selectOption("qr");
  await page.getByLabel("Website or text", { exact: true }).fill("https://example.com/second");
  await page.getByText("40 copies · same design", { exact: true }).first().waitFor();
  await page.locator(".sidebar .layer-main").filter({ hasText: "QR Code" }).last().click();
  assert.equal(await page.getByLabel("Website or text", { exact: true }).inputValue(), "https://example.com/first");
  assert.equal(await page.getByLabel("Content template", { exact: true }).isVisible(), false);
  await page.locator(".sidebar .layer-main").filter({ hasText: "QR Code" }).first().click();
  await page.getByText("Advanced QR content", { exact: true }).click();
  await page.getByLabel("Shared content source", { exact: true }).selectOption(project.data.groups[0].id);
  await page.getByText(/Shared with 1 other layer/).waitFor();
  await page.getByRole("button", { name: "Make independent", exact: true }).click();
  await page.getByLabel("Website or text", { exact: true }).fill("https://example.com/independent");
  await page.locator(".sidebar .layer-main").filter({ hasText: "QR Code" }).last().click();
  assert.equal(await page.getByLabel("Website or text", { exact: true }).inputValue(), "https://example.com/first");
});

test("cut controls are contextual, print setup is separate, and finished preview works", async () => {
  await page.getByLabel("Cut shape", { exact: true }).selectOption("rectangle");
  assert.equal(await page.locator(".sidebar .shape-customize").count(), 0);
  assert.equal(await page.getByLabel("Bleed outside cut (mm)", { exact: true }).isVisible(), false);
  await page.getByLabel("Cut shape", { exact: true }).selectOption("polygon");
  await page.locator(".sidebar .shape-customize summary").click();
  await page.getByLabel("Points", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Print setup", exact: true }).click();
  await page.getByLabel("Show document guides", { exact: true }).uncheck();
  assert.equal(await page.getByLabel("Cut shape", { exact: true }).isVisible(), true);
  await page.getByRole("button", { name: "Finished preview", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Finished preview", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Finished preview", exact: true }).click();
});

test("switching to numbering preserves total quantity and keeps another QR fixed", async () => {
  await page.getByLabel("Content type", { exact: true }).selectOption("serial");
  assert.equal(await page.getByLabel("Number of serials", { exact: true }).inputValue(), "40");
  assert.equal(await page.getByLabel("Copies of each", { exact: true }).inputValue(), "1");
  await page.getByLabel("Number of serials", { exact: true }).fill("3");
  const saved = page.waitForEvent("download");
  await page.getByTitle("Save project", { exact: true }).click();
  const file = await saved;
  const project = JSON.parse((await readFile(await file.path())).toString()).project;
  const values = await page.evaluate(async project => {
    const { createDataRecords } = await import("/qrmagic/src/lib/serial.ts");
    const numbered = project.data.groups.find(group => group.mode === "serial");
    const secondQr = project.layers.find(layer => layer.name === "QR Code 2");
    return createDataRecords(project.data.groups).map(record => ({
      numbered: record.groups[numbered.id].serial,
      fixed: record.groups[secondQr.dataGroupId].serial,
    }));
  }, project);
  assert.deepEqual(values, [
    { numbered: "QR-0001", fixed: "https://example.com/independent" },
    { numbered: "QR-0002", fixed: "https://example.com/independent" },
    { numbered: "QR-0003", fixed: "https://example.com/independent" },
  ]);
});

test("compact editor exposes both panels without horizontal page clipping", async () => {
  await page.setViewportSize({ width: 790, height: 900 });
  try {
    await page.getByRole("button", { name: "Document & job", exact: true }).click();
    assert.equal(await page.getByLabel("Number of serials", { exact: true }).isVisible(), true);
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    assert.equal(await page.getByLabel("Content type", { exact: true }).isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
  } finally {
    await page.setViewportSize({ width: 1600, height: 1000 });
  }
});

test("bleed translation matches the preview for translucent artwork and shadows", async () => {
  const project = projectWith([shape({ opacity: 0.7, fillOpacity: 0.5,
    stroke: "#000000", strokeWidth: 4, shadowEnabled: true })], 0.5);
  project.document.bleedMm = 3.175;
  const result = await comparePreviewAndExport(project);
  assert.equal(result.width, 316);
  assert.equal(result.height, 256);
  assert.equal(result.differentPixels, 0, JSON.stringify(result.samples));
});

for (const opacity of [0, 0.5, 1]) {
  test(`page background opacity ${opacity}`, async () => matchesPreview(projectWith([], opacity)));
}

for (const kind of ["rectangle", "ellipse", "pill", "triangle", "diamond", "pentagon", "hexagon", "roundedHexagon", "octagon", "guitarPick", "shield", "polygon"]) {
  test(`shape geometry: ${kind}`, async () => {
    const geometry = await page.evaluate(async (kind) => {
      const { presetShapeGeometry } = await import("/qrmagic/src/lib/shapeGeometry.ts");
      return presetShapeGeometry(kind);
    }, kind);
    await matchesPreview(projectWith([shape(geometry)]));
  });
}

test("custom rounded star with curved sides and rotation", async () => {
  await matchesPreview(projectWith([shape({
    shape: "polygon", vertices: 7, vertexInset: 0.4, vertexRadius: 0.12,
    sideDeflection: 0.3, rotation: 12,
  })]));
});

for (const fillMode of ["solid", "linear-gradient", "radial-gradient"]) {
  test(`${fillMode} with fill/layer opacity and dashed stroke`, async () => {
    await matchesPreview(projectWith([shape({
      shape: "ellipse", fillMode, fillGradientFrom: "#ff0000", fillGradientTo: "#0000ff",
      fillGradientAngle: 37, fillOpacity: 0.65, opacity: 0.7,
      stroke: "#00ff00", strokeOpacity: 0.6, strokeWidth: 4, dash: [8, 5],
    })], 0.5));
  });
}

const shadow = {
  shadowEnabled: true, shadowColor: "#132435", shadowOpacity: 0.6,
  shadowBlur: 9, shadowOffsetX: 16, shadowOffsetY: -8,
};

test("shape shadow with translucent fill and stroke", async () => {
  await matchesPreview(projectWith([shape({ ...shadow, fillOpacity: 0.5, opacity: 0.7,
    stroke: "#000000", strokeWidth: 4 })]));
});

test("image shadow", async () => {
  const image = {
    ...shape(shadow), type: "image", assetId: "fixture", fit: "stretch",
    src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="9" fill="red"/></svg>'),
  };
  await matchesPreview(projectWith([image]));
});

test("QR background shadow", async () => {
  await matchesPreview(projectWith([{
    ...initialProject.layers.find((layer) => layer.type === "qr"),
    ...shadow, id: "fixture", x: 30, y: 25, width: 110, height: 110,
  }]));
});

test("text shadow and multiline layout", async () => {
  const layer = {
    ...initialProject.layers.find((layer) => layer.type === "text"),
    ...shadow, id: "fixture", x: 30, y: 30, width: 130, height: 110,
    fontSize: 22, textTemplate: "First line\nSecond line", fillOpacity: 0.8,
  };
  await matchesPreview(projectWith([layer]));
  // Shadows must be present in both preview and export, not absent from both.
  const enabled = await page.evaluate(async () => {
    const { Konva } = await import("/qrmagic/tests/rendering-fixture.ts");
    return Konva.stages[0].findOne(".design-layer").shadowEnabled();
  });
  assert.equal(enabled, true);
});
