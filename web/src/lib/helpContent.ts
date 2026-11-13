export const helpArticles = [
  {
    id:"getting-started",title:"Make your first QR design",summary:"From a blank idea to a saved project and a useful download.",keywords:["start","beginner","wizard","walkthrough","poster","sticker","decal"],
    sections:[
      {title:"1. Choose what you are making",paragraphs:["Choose Poster or sign for one QR destination, Repeated stickers for many copies of the same design, or Numbered decals for a different serial on each item. Blank canvas starts with no artwork. Open project file brings back a design you saved earlier."]},
      {title:"2. Set the finished size",paragraphs:["Enter the size you want after cutting, then create the project. You can change the size in Document. Print setup holds bleed, safe-area guides and DPI; your print shop can tell you which settings it needs."]},
      {title:"3. Give the QR its content",paragraphs:["Select the QR in the canvas or Layers list. In the Inspector, paste a website address or enter text. Use https:// for a website. The first-item preview shows exactly what the QR will contain."]},
      {title:"4. Make it yours and save",paragraphs:["Add text, images and shapes from Add layer. Select a layer to change its appearance and position. Edits save automatically on this device; wait for Saved on this device. Use Save project to download a separate editable .qrmagic.json backup or sharing copy."]},
      {title:"5. Check and download",paragraphs:["Review the quantity in Job. Use a proof package to check one item, or Print layout to arrange the whole job on sheets or a roll. Scan a sample on your phone and check a physical print at the finished size before printing the batch."]},
    ],
  },
  {
    id:"offline",title:"Install QR Magic and work offline",summary:"Keep the editor and print tools available without a connection.",keywords:["install","offline","PWA","home screen","connection","app","cache"],
    sections:[
      {title:"Get ready while connected",paragraphs:["Open QR Magic online and wait for Ready to use offline in the project chooser or editor. Choose Install QR Magic if it appears, or use your browser’s install option. In Safari on iPhone or iPad, use Share, then Add to Home Screen. Turn on Open as Web App if offered, then launch it once while connected. You can also return to the same address in the same browser profile without installing."]},
      {title:"Design and export offline",paragraphs:["Create and edit designs, import local artwork or CSV files, and open or download project files. Recent projects and local autosave still work. Proofs, image batches, PDFs and Print Layout exports are created on your device.","Google Drive and opening external websites need a connection. If you’re bringing a Drive project with you, open it before going offline and wait for Saved on this device, or download a project file."]},
      {title:"Keep your projects and get updates",paragraphs:["Keep separate copies of important project files. Clearing QR Magic’s site data can remove recent projects and offline access. To pick up a new app version, reconnect and close all QR Magic windows and tabs before reopening. Save your work first."]},
    ],
  },
  {
    id:"qr-content",title:"QR content & destinations",summary:"Choose a website, plain text or a different serial for each item.",keywords:["QR","code","payload","link","URL","facebook","redirect","disable","invalidate","analytics","tracking","static","fixed"],
    sections:[
      {title:"Same on every item",paragraphs:["Use Same on every item for a poster, sign or repeated sticker. Enter a full website address such as https://example.com, or plain text such as PARK-0001. A serial or other plain text does not automatically open a website."]},
      {title:"A different serial on each item",paragraphs:["Choose A different serial on each item and set the count and numbering in Job. Copies of an item keep the same serial. You can also put a numbered QR and an independent fixed QR on the same design."]},
      {title:"What happens after printing?",paragraphs:["Current QR links go directly to the address you enter. QR Magic does not provide managed redirects or scan tracking. Changing a project later does not change an already printed code. Use a redirect URL you control if you need to change or disable its destination later.","Test destination opens the resolved website in a new tab. It is a useful link check; also scan the actual printed QR with your phone."]},
      {title:"Advanced content",paragraphs:["A content source supplies a value to one or more layers. The template {{serial}} uses the selected source; {{index}} uses the variation number, starting at 1. Copies keep both values. Literal text can appear beside the template, for example https://example.com/pass/{{serial}}."]},
    ],
  },
  {
    id:"quantities",title:"Quantity, serials & copies",summary:"Understand how many different items you have and how many to print.",keywords:["quantity","batch","records","unique","numbering","serial","copies","fixed","same"],
    sections:[
      {title:"One design, many copies",paragraphs:["For a fixed QR job, Quantity is the total number of identical items. One record with 5,000 copies gives 5,000 matching stickers, all with the same QR content."]},
      {title:"Different serials, repeated copies",paragraphs:["Number of serials controls how many numbered records are created. Copies of each controls how many times each one is printed. For example, 200 serials with 3 copies each makes 600 finished items.","Copies stay together: 0001, 0001, 0001, then 0002, 0002, 0002. Copying an item does not create a new serial or increase {{index}}."]},
      {title:"More than one content source",paragraphs:["Advanced content sources supports several values in one design. Fixed content stays present on every item; serial sources can have their own numbering. Check the resolved content and export preflight if sources have different record counts."]},
    ],
  },
  {
    id:"csv-batches",title:"Make a batch from a CSV",summary:"Use spreadsheet columns to fill QR codes and text across a batch.",keywords:["CSV","spreadsheet","columns","mapping","duplicates","missing","import","rows","batch"],
    sections:[
      {title:"Prepare and map the file",paragraphs:["Put unique column names in the first row, then add one row per design. Save as CSV UTF-8. In the editor, open Job and choose Set up CSV batch. Import the file and choose a column for each QR or text layer you want it to fill.","Unmapped layers keep their existing content. Numbered sources advance once per row. Copies per CSV row repeats each design before moving to the next row."]},
      {title:"Review the data before printing",paragraphs:["Select a row number to preview its artwork on the canvas. Missing QR values block batch export. Missing text prints blank. Repeated QR values are flagged within each mapped QR layer. If repeats are deliberate, mark Repeated QR values are intentional.","The imported data travels with your saved project. Replace CSV keeps mappings for matching column names. Remove CSV returns the mapped layers to their previous content sources."]},
    ],
  },
  {
    id:"artwork",title:"Artwork, layers & shared sources",summary:"Build your design without losing the more powerful controls.",keywords:["image","text","shape","inspector","layers","background","shared","independent","template","payload","undo","redo"],
    sections:[
      {title:"Work with layers",paragraphs:["Add layer creates text, shapes, an imported image or a QR. Choose a layer on the canvas or in the Layers list to edit it in the Inspector. Higher layers cover the artwork below them; drag the layer handles to reorder them. The eye control hides a layer from both preview and export.","Use Undo and Redo to step through design changes. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z redoes. Position and size, alignment and other precise controls remain available in the Inspector."]},
      {title:"Keep shared values intentional",paragraphs:["Two layers can use the same content source, such as a QR and its visible serial label. Editing that source updates both. Make independent gives a QR its own source when you want to change its content separately. Advanced QR content holds source selection and custom templates."]},
      {title:"Check the finished result",paragraphs:["Finished preview shows the intended cut shape without editing guides. Exported artwork still includes the bleed envelope for production. Keep important text and the whole QR comfortably inside the cut edge."]},
    ],
  },
  {
    id:"print-setup",title:"Finished size, bleed & safe area",summary:"A few print terms, explained in ordinary language.",keywords:["trim","cut","size","width","height","bleed","edges","DPI","resolution","safe","inset","margin","opacity"],
    sections:[
      {title:"Finished size and cut shape",paragraphs:["Finished width and height describe the item after cutting. The cut shape fits within those dimensions. It describes the intended outline; an artwork shape layer is a separate part of your design."]},
      {title:"Bleed prevents white edges",paragraphs:["Bleed is extra artwork beyond the cut edge. It gives the cutter a little room to vary without exposing an unprinted edge. Use your shop’s required amount, or 0 when bleed is not needed.","Extend backgrounds and edge-to-edge images into the bleed area. Increasing the bleed allowance adds space; it does not stretch an imported image or invent missing artwork."]},
      {title:"The safe area protects important content",paragraphs:["The safe inset is a guide inside the cut edge. Keep QR codes and important text inside it. On a curved cut, the guide is a composition aid; also check the actual contour in Finished preview."]},
      {title:"DPI, units and opacity",paragraphs:["DPI describes raster image resolution at the physical size. A higher number can preserve more image detail but uses more memory. New projects start at 300 DPI. PDF page dimensions carry the physical sizing contract; print them at 100% / actual size.","Page opacity controls the background color, while each layer has its own opacity. PNG and PDF can preserve transparency. JPG places the artwork on white."]},
    ],
  },
  {
    id:"exporting",title:"Choose the right export",summary:"Proof one item, download images, or prepare a production handoff.",keywords:["export","download","PDF","PNG","JPG","proof","vector","raster","guides","font","shadow","gradient"],
    sections:[
      {title:"Check one item first",paragraphs:["Download proof package contains the currently selected item, artwork/guide previews and a layered proof PDF. Use it to check appearance and placement. It is not the whole printed batch."]},
      {title:"Images and one-item PDF pages",paragraphs:["PNG ZIP and JPG ZIP contain the whole job, including copies. PNG preserves transparency; JPG uses white behind transparent areas. Image PDF contains one finished item per page, with artwork flattened to an image.","Production PDF package also has one item per page. It keeps supported QR codes, text and solid shapes as vectors, embeds supported fonts, and includes a cut-outline reference and reports. Images and effects such as gradients or shadows use a documented raster fallback. Read the included preflight notes."]},
      {title:"Arrange several items on a page",paragraphs:["Choose Print layout for a sheet or roll job with multiple items per page. Its layout package already includes every requested copy, so do not add the quantity again in the print shop’s RIP.","Preview guides help you design. Print guides on artwork is for proofing; keep it off for clean artwork. Print Layout never includes its preview guide overlays in artwork.pdf."]},
      {title:"Handing files to the shop",paragraphs:["These production packages are generic RGB handoffs with vector cut references. They do not add machine-specific cutting commands, registration marks, ICC conversion or PDF/X certification. The print shop sets color, media and cutting in its RIP. Ask the shop to validate a small sample on its own equipment first."]},
    ],
  },
  {
    id:"print-layout",title:"Arrange a roll or sheet job",summary:"Fit copies at their real size, with margins and clear space around bleed.",keywords:["layout","roll","sheet","panel","spacing","gap","rotation","best fit","material","Mimaki","Roland","RIP"],
    sections:[
      {title:"Choose the media",paragraphs:["In Print layout, choose Roll or Sheet and enter the media dimensions. Sheet presets are starting points, not printer profiles. A roll’s Maximum panel length splits a long job into manageable PDF pages. Each roll panel uses only the length needed for its occupied rows and margins."]},
      {title:"Margins and spacing",paragraphs:["Margins leave space at the edges of every panel or sheet. Use Set each edge separately if your shop needs a larger leading or trailing margin. Horizontal and vertical gaps are measured between full bleed areas. With 3 mm bleed on both items and a 3 mm gap, their finished cut edges are 9 mm apart."]},
      {title:"Fit without resizing",paragraphs:["Best fit compares the original orientation with one uniform 90-degree rotation and chooses lower material use. It never shrinks the finished design. If the job does not fit, adjust media size, margins or orientation. Use Fit, zoom and panel navigation to inspect the result.","Estimated material use includes the entered margins on each panel. Add any extra feed, registration space and testing allowance your shop needs; those are not automatically included."]},
      {title:"What the package contains",paragraphs:["The layout ZIP includes an actual-size artwork PDF, a matching cut-reference SVG for every page, a placement CSV, job metadata and preflight notes. Cuts and artwork use the same placement and rotation. The final panel contains only the remaining items; unused positions stay empty. Print at 100% / actual size, with fit-to-page and extra RIP copies disabled."]},
    ],
  },
  {
    id:"saving",title:"Save, open & share projects",summary:"Pick up your work again and keep a portable backup.",keywords:["save","open","file","project","share","cloud","autosave","backup","browser","local","privacy","recovery","recover","recent","duplicate","Google Drive","folder","sign in","tester"],
    sections:[
      {title:"Autosave on this device",paragraphs:["After an edit, QR Magic saves the project in this browser after a short pause. Saved on this device confirms the local write completed. While changes are waiting or saving, keep the tab open. If a local save fails, use Retry local save or Download backup; you can keep designing.","When you return, choose a project from Recent projects. The app does not open one automatically. Projects in the toolbar opens the same list, and New project opens the templates. Search by name, or use Duplicate to create an independent design. Print Layout settings and embedded artwork are included."]},
      {title:"Keep a separate backup",paragraphs:["Save project downloads a .qrmagic.json file containing the design, artwork, content sources, quantities and layout settings. Local identity stays in the browser and is not added to that file. An exported PDF or image does not replace the editable project file.","Local saves are specific to this browser and site. They are not cloud backups and may be lost if site data is cleared or the browser removes stored data. Private browsing may clear them when the private session ends. Download project files for long-term storage or use on another device."]},
      {title:"Open or share a file",paragraphs:["Use Open project in the toolbar or Open project file in the chooser. An imported file becomes a new local project. Before switching projects, the app tries to finish saving your current changes. If that fails and there are unsaved changes, it asks before replacing them.","Share the editable project file with a print shop so it can open the design and choose layout settings. Project files include artwork, QR content and any imported CSV rows. Check who should have access before sharing."]},
      {title:"Open, save or share with Google Drive",paragraphs:["Choose Open from Google Drive in Projects, or use the Google Drive button in the editor. Select Show Drive projects to search files QR Magic can already access. Use Browse Drive to select another project. Drive sign-in on the live site is available to approved testers.","Under Save to Drive, enter a filename, choose a folder or use My Drive, then select Save a copy. Each save creates a separate Drive file. Edits still autosave in this browser. To put later edits in Drive, save another copy.","Select Share Drive file for the project you opened or saved to use Google’s sharing controls. If the dialog is blocked, select Open file in Drive and share it there."]},
      {title:"Editing in two tabs",paragraphs:["If another tab saves a newer version of the same local project, your edits are saved as a separate local copy. A message explains this, and both versions appear in Recent projects. A local save does not update a downloaded file or a project already open in another tab."]},
    ],
  },
  {
    id:"print-checks",title:"Check print quality",summary:"Understand helpful print suggestions before committing to a whole batch.",keywords:["preflight","quality","resolution","PPI","DPI","contrast","QR size","module","quiet zone","safe","cut","warnings","print checks"],
    sections:[
      {title:"Suggestions, not a certificate",paragraphs:["Print checks appears with every editor export format and in Print Layout. Expand its suggestions to see the affected layer and a practical next step. Select layer takes you to that layer in the Inspector. Suggestions do not change your design or block exports; existing invalid-document or empty-QR errors still need attention for production export.","Wait for Checking print details to finish. No issues found in these checks means the available checks found nothing to flag; it does not guarantee print quality or successful scanning. Scan an exported sample and a physical print at actual size before producing the batch."]},
      {title:"QR size and clear space",paragraphs:["A module is one tiny square in a QR pattern. Longer content and stronger error correction can produce more squares. The check uses actual QR density and printed dimensions, with 0.25 mm per square as an advisory starting point. Raster exports also check for about four output pixels per square. Your printer, material, scanner and viewing distance may require a larger code.","The border check looks for four modules of clear space on every side. Increase QR margin when needed, then recheck size: more border inside the same frame leaves less room for the code. Density is checked on sampled record values, including endpoints/range transitions, rather than every batch item or every copy."]},
      {title:"QR colors and opacity",paragraphs:["Prefer dark marks on a solid light background. Low contrast, light-on-dark colors, transparency or reduced opacity can make reading less reliable. A nominal luminance ratio below 4.5:1 prompts a suggestion; that threshold is an app heuristic, not an ISO barcode quality grade. The app does not inspect every overlaid image, pattern or nearby mark around your QR."]},
      {title:"Image detail at the printed size",paragraphs:["PPI is source pixels per printed inch, measured at the size and fit used in your design. Enlarging a small image reduces its effective detail. The app suggests 300 PPI for close viewing and also reports when document DPI caps raster output. Large posters viewed farther away can be acceptable at lower resolution; ask your shop.","Contain, cover, stretch and original fit are accounted for. SVG artwork has no useful intrinsic photo PPI, so it gets a note about rasterization at document DPI and unverified embedded raster content. If an image cannot be read, its resolution is marked unverified instead of being treated as good."]},
      {title:"Keep important content away from the cut",paragraphs:["QR and text-box boundaries are checked against the finished cut shape and the configured safe guide, including layer rotation. A crossing-cut suggestion is different from being inside trim but outside the safe guide. Shape and image backgrounds are allowed to extend into bleed.","These are sampled boundary checks, not exact glyph tracing or full overlap detection. Large text boxes can trigger a suggestion even if their visible letters look safe. Review the box, guides and Finished preview. Turning off guide overlays does not turn off the print checks. Production and layout packages include suggestions and sampling/threshold notes in preflight.json."]},
    ],
  },
  {
    id:"scanning",title:"My QR will not scan",summary:"Start with clear space, strong contrast and a real-size sample.",keywords:["scan","phone","camera","quiet zone","margin","contrast","logo","small","test","troubleshooting"],
    sections:[
      {title:"Give the code breathing room",paragraphs:["Keep a clear, plain border around the QR. Nearby artwork, a cut edge or an oversized logo can make it difficult to read. Start with a simple square QR, a light background and dark foreground, then test styling changes one at a time."]},
      {title:"Check size and content",paragraphs:["A code that looks fine while zoomed in may be too small after printing. Scan a physical sample at its finished size using more than one phone when possible. Long payloads make denser patterns, so give them more room.","Check First item contains for the intended website or serial. A successfully scanned serial is plain text; it will not open a website unless the content is a web address. For a website, also test the destination itself."]},
    ],
  },
] as const;

export function searchHelpArticles(query:string) {
  const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return helpArticles.filter(article=>{
    const text=[article.title,article.summary,...article.keywords,...article.sections.flatMap(section=>[section.title,...section.paragraphs])].join(" ").toLocaleLowerCase();
    return words.every(word=>text.includes(word));
  });
}

export const helpTips={
  printChecks:{label:"print checks",text:"Suggestions use physical QR size/colors, placed image detail and sampled QR/text cut boundaries. They do not change artwork or certify scanning. Select a layer to adjust it, then check a real-size print."},
  finished:{label:"finished size",text:"The width and height after cutting. Bleed adds artwork space outside this size; it does not make the finished item bigger."},
  bleed:{label:"bleed",text:"Bleed is extra artwork beyond the cut edge to help prevent white edges after trimming. Extend backgrounds into it and use your print shop’s required amount."},
  safe:{label:"safe area",text:"A guide inside the cut edge. Keep important text and the whole QR inside it, and check the real outline for curved cuts."},
  dpi:{label:"DPI",text:"Raster image detail at the printed size. New projects use 300 DPI. More detail uses more memory; PDF dimensions keep the physical size explicit."},
  quantities:{label:"quantity and copies",text:"Quantity is the total for a fixed QR job. A numbered or CSV job multiplies the number of records by the copies per record. Copies keep the same content."},
  qr:{label:"QR content",text:"Choose the same website or text for every item, or a different serial for each record. A plain serial is text, not a website link."},
  sources:{label:"shared sources",text:"Layers sharing a source use the same value. A QR and its serial label can stay linked. Make independent gives a QR its own source."},
  exports:{label:"export formats",text:"Proof checks one item. Image/PDF job exports include all copies, one item at a time. Print layout arranges the job on sheets or roll panels."},
  spacing:{label:"print spacing",text:"Gaps are clear space between full bleed areas. With 3 mm bleed on both items and a 3 mm gap, finished cut edges are 9 mm apart."},
  orientation:{label:"best fit",text:"Compares two uniform orientations for the actual quantity and chooses lower material use. Your artwork stays at 100% of its finished size."},
} as const;
export type HelpTipTopic=keyof typeof helpTips;

export const tourSteps=[
  {target:"document",title:"Start with the finished size",body:"Document sets the size after cutting. Choose a cut shape here, and find bleed, safe area and DPI in Print setup.",tip:"New to bleed? It is just extra background beyond the cut edge."},
  {target:"qr",title:"Tell the QR what to contain",body:"Select a QR and use the Inspector to enter a full website address or plain text. The first-item preview shows the result.",tip:"One QR destination works well for posters and repeated stickers."},
  {target:"job",title:"Choose how many to make",body:"Job holds quantity and numbering. Different serials create different records; copies repeat each record’s content.",tip:"200 serials × 3 copies each makes 600 finished items."},
  {target:"layers",title:"Build your design with layers",body:"Add text, images, shapes and more QR codes. Select a layer to edit it in the Inspector. Advanced controls are there when you need them.",tip:"Use the eye control to hide a layer, or drag its handle to change the stacking order."},
  {target:"save",title:"Keep an editable copy",body:"Save project downloads a .qrmagic.json file you can open again or share with your print shop. Save after important changes and before closing the tab.",tip:"A PDF or PNG is an output file. Keep the project file for future edits."},
  {target:"export",title:"Proof it, then print it",body:"The proof package checks one selected item. Print layout arranges the whole job on a roll or sheet. Its export includes every requested copy.",tip:"Scan a phone test and check a physical sample at 100% / actual size before printing the batch."},
] as const;
export type TourTarget=typeof tourSteps[number]["target"];
export const TOUR_STORAGE_KEY="qrmagic.tour.v1";
type PreferenceStorage=Pick<Storage,"getItem"|"setItem">;
export function readTourCompleted(storage?:PreferenceStorage) {
  try{return (storage??globalThis.localStorage)?.getItem(TOUR_STORAGE_KEY)==="complete";}catch{return false;}
}
export function markTourCompleted(storage?:PreferenceStorage) {
  try{const target=storage??globalThis.localStorage;if(!target)return false;target.setItem(TOUR_STORAGE_KEY,"complete");return true;}catch{return false;}
}
export function helpMarkdown() {
  return ["# QR Magic user guide","Create a design, give its QR useful content, save an editable project, and prepare a print handoff. Open Help in the app for search and an optional quick tour.",
    ...helpArticles.map(article=>[`## ${article.title}`,article.summary,...article.sections.map(section=>[`### ${section.title}`,...section.paragraphs].join("\n\n"))].join("\n\n"))].join("\n\n")+"\n";
}
