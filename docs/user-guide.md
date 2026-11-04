# QR Magic user guide

Create a design, give its QR useful content, save an editable project, and prepare a print handoff. Open Help in the app for search and an optional quick tour.

## Make your first QR design

From a blank idea to a saved project and a useful download.

### 1. Choose what you are making

Choose Poster or sign for one QR destination, Repeated stickers for many copies of the same design, or Numbered decals for a different serial on each item. Blank canvas starts with no artwork. Open project file brings back a design you saved earlier.

### 2. Set the finished size

Enter the size you want after cutting, then create the project. You can change the size in Document. Print setup holds bleed, safe-area guides and DPI; your print shop can tell you which settings it needs.

### 3. Give the QR its content

Select the QR in the canvas or Layers list. In the Inspector, paste a website address or enter text. Use https:// for a website. The first-item preview shows exactly what the QR will contain.

### 4. Make it yours and save

Add text, images and shapes from Add layer. Select a layer to change its appearance and position. Edits save automatically on this device; wait for Saved on this device. Use Save project to download a separate editable .qrmagic.json backup or sharing copy.

### 5. Check and download

Review the quantity in Job. Use a proof package to check one item, or Print layout to arrange the whole job on sheets or a roll. Scan a sample on your phone and check a physical print at the finished size before printing the batch.

## QR content & destinations

Choose a website, plain text or a different serial for each item.

### Same on every item

Use Same on every item for a poster, sign or repeated sticker. Enter a full website address such as https://example.com, or plain text such as PARK-0001. A serial or other plain text does not automatically open a website.

### A different serial on each item

Choose A different serial on each item and set the count and numbering in Job. Copies of an item keep the same serial. You can also put a numbered QR and an independent fixed QR on the same design.

### What happens after printing?

Current QR links go directly to the address you enter. QR Magic does not provide managed redirects or scan tracking. Changing a project later does not change an already printed code. Use a redirect URL you control if you need to change or disable its destination later.

Test destination opens the resolved website in a new tab. It is a useful link check; also scan the actual printed QR with your phone.

### Advanced content

A content source supplies a value to one or more layers. The template {{serial}} uses the selected source; {{index}} uses the variation number, starting at 1. Copies keep both values. Literal text can appear beside the template, for example https://example.com/pass/{{serial}}.

## Quantity, serials & copies

Understand how many different items you have and how many to print.

### One design, many copies

For a fixed QR job, Quantity is the total number of identical items. One record with 5,000 copies gives 5,000 matching stickers, all with the same QR content.

### Different serials, repeated copies

Number of serials controls how many numbered records are created. Copies of each controls how many times each one is printed. For example, 200 serials with 3 copies each makes 600 finished items.

Copies stay together: 0001, 0001, 0001, then 0002, 0002, 0002. Copying an item does not create a new serial or increase {{index}}.

### More than one content source

Advanced content sources supports several values in one design. Fixed content stays present on every item; serial sources can have their own numbering. Check the resolved content and export preflight if sources have different record counts.

## Artwork, layers & shared sources

Build your design without losing the more powerful controls.

### Work with layers

Add layer creates text, shapes, an imported image or a QR. Choose a layer on the canvas or in the Layers list to edit it in the Inspector. Higher layers cover the artwork below them; drag the layer handles to reorder them. The eye control hides a layer from both preview and export.

Use Undo and Redo to step through design changes. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z redoes. Position and size, alignment and other precise controls remain available in the Inspector.

### Keep shared values intentional

Two layers can use the same content source, such as a QR and its visible serial label. Editing that source updates both. Make independent gives a QR its own source when you want to change its content separately. Advanced QR content holds source selection and custom templates.

### Check the finished result

Finished preview shows the intended cut shape without editing guides. Exported artwork still includes the bleed envelope for production. Keep important text and the whole QR comfortably inside the cut edge.

## Finished size, bleed & safe area

A few print terms, explained in ordinary language.

### Finished size and cut shape

Finished width and height describe the item after cutting. The cut shape fits within those dimensions. It describes the intended outline; an artwork shape layer is a separate part of your design.

### Bleed prevents white edges

Bleed is extra artwork beyond the cut edge. It gives the cutter a little room to vary without exposing an unprinted edge. Use your shop’s required amount, or 0 when bleed is not needed.

Extend backgrounds and edge-to-edge images into the bleed area. Increasing the bleed allowance adds space; it does not stretch an imported image or invent missing artwork.

### The safe area protects important content

The safe inset is a guide inside the cut edge. Keep QR codes and important text inside it. On a curved cut, the guide is a composition aid; also check the actual contour in Finished preview.

### DPI, units and opacity

DPI describes raster image resolution at the physical size. A higher number can preserve more image detail but uses more memory. New projects start at 300 DPI. PDF page dimensions carry the physical sizing contract; print them at 100% / actual size.

Page opacity controls the background color, while each layer has its own opacity. PNG and PDF can preserve transparency. JPG places the artwork on white.

## Choose the right export

Proof one item, download images, or prepare a production handoff.

### Check one item first

Download proof package contains the currently selected item, artwork/guide previews and a layered proof PDF. Use it to check appearance and placement. It is not the whole printed batch.

### Images and one-item PDF pages

PNG ZIP and JPG ZIP contain the whole job, including copies. PNG preserves transparency; JPG uses white behind transparent areas. Image PDF contains one finished item per page, with artwork flattened to an image.

Production PDF package also has one item per page. It keeps supported QR codes, text and solid shapes as vectors, embeds supported fonts, and includes a cut-outline reference and reports. Images and effects such as gradients or shadows use a documented raster fallback. Read the included preflight notes.

### Arrange several items on a page

Choose Print layout for a sheet or roll job with multiple items per page. Its layout package already includes every requested copy, so do not add the quantity again in the print shop’s RIP.

Preview guides help you design. Print guides on artwork is for proofing; keep it off for clean artwork. Print Layout never includes its preview guide overlays in artwork.pdf.

### Handing files to the shop

These production packages are generic RGB handoffs with vector cut references. They do not add machine-specific cutting commands, registration marks, ICC conversion or PDF/X certification. The print shop sets color, media and cutting in its RIP. Ask the shop to validate a small sample on its own equipment first.

## Arrange a roll or sheet job

Fit copies at their real size, with margins and clear space around bleed.

### Choose the media

In Print layout, choose Roll or Sheet and enter the media dimensions. Sheet presets are starting points, not printer profiles. A roll’s Maximum panel length splits a long job into manageable PDF pages. Each roll panel uses only the length needed for its occupied rows and margins.

### Margins and spacing

Margins leave space at the edges of every panel or sheet. Use Set each edge separately if your shop needs a larger leading or trailing margin. Horizontal and vertical gaps are measured between full bleed areas. With 3 mm bleed on both items and a 3 mm gap, their finished cut edges are 9 mm apart.

### Fit without resizing

Best fit compares the original orientation with one uniform 90-degree rotation and chooses lower material use. It never shrinks the finished design. If the job does not fit, adjust media size, margins or orientation. Use Fit, zoom and panel navigation to inspect the result.

Estimated material use includes the entered margins on each panel. Add any extra feed, registration space and testing allowance your shop needs; those are not automatically included.

### What the package contains

The layout ZIP includes an actual-size artwork PDF, a matching cut-reference SVG for every page, a placement CSV, job metadata and preflight notes. Cuts and artwork use the same placement and rotation. The final panel contains only the remaining items; unused positions stay empty. Print at 100% / actual size, with fit-to-page and extra RIP copies disabled.

## Save, open & share projects

Pick up your work again and keep a portable backup.

### Autosave on this device

After an edit, QR Magic saves the project in this browser after a short pause. Saved on this device confirms the local write completed. While changes are waiting or saving, keep the tab open. If a local save fails, use Retry local save or Download backup; you can keep designing.

When you return, choose a project from Recent projects. The app does not open one automatically. Projects in the toolbar opens the same list, and New project opens the templates. Search by name, or use Duplicate to create an independent design. Print Layout settings and embedded artwork are included.

### Keep a separate backup

Save project downloads a .qrmagic.json file containing the design, artwork, content sources, quantities and layout settings. Local identity stays in the browser and is not added to that file. An exported PDF or image does not replace the editable project file.

Local saves are specific to this browser and site. They are not cloud backups and may be lost if site data is cleared or the browser removes stored data. Private browsing may clear them when the private session ends. Download project files for long-term storage or use on another device.

### Open or share a file

Use Open project in the toolbar or Open project file in the chooser. An imported file becomes a new local project. Before switching projects, the app finishes saving current changes. If that fails, it asks before replacing them. Share a project file with a print shop so it can open the design and choose layout settings.

Project files include artwork and QR content, so share them with the people who need that information. There is no cloud project library or automatic cloud backup.

### Editing in two tabs

If another tab saves a newer version of the same local project, your edits are saved as a separate local copy. A message explains this, and both versions appear in Recent projects. A local save does not update a downloaded file or a project already open in another tab.

## My QR will not scan

Start with clear space, strong contrast and a real-size sample.

### Give the code breathing room

Keep a clear, plain border around the QR. Nearby artwork, a cut edge or an oversized logo can make it difficult to read. Start with a simple square QR, a light background and dark foreground, then test styling changes one at a time.

### Check size and content

A code that looks fine while zoomed in may be too small after printing. Scan a physical sample at its finished size using more than one phone when possible. Long payloads make denser patterns, so give them more room.

Check First item contains for the intended website or serial. A successfully scanned serial is plain text; it will not open a website unless the content is a web address. For a website, also test the destination itself.
