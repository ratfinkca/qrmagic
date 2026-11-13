# Production documents and export

The QR Mystic chooser offers numbered decals, posters or signs, repeated stickers and a blank canvas, plus recent projects and file/Drive opening. When switching projects, the editor tries to finish the local save and asks before replacing changes that could not be saved. See the [user guide](user-guide.md) for the editor workflow and the [project model](project-model.md) for file storage and CSV mapping.

## Version 2 project contract

- `document.width`, `height`, and `unit` describe the finished trim dimensions. Layer positions remain relative to the top-left of trim, measured in pixels at document DPI.
- `document.bleedMm` is a uniform physical allowance outside all four trim edges. It enlarges the artwork/export canvas without moving the artwork relative to trim. The bleed envelope is rectangular, including when the cut is curved.
- `document.safeAreaMm` is an inset for composition guides. On nonrectangular cuts the inset bounding-box guide is a visual aid, not a computed constant-distance offset of the contour.
- `document.shape` is the intended cut geometry within the finished bounds, independently of artwork layers. It uses the existing parametric geometry presets and polygon controls. Corner radius is stored in document pixels and edited in millimetres.
- `production.copiesPerRecord` is a positive integer. A CSV batch uses one record per row. Otherwise data-group quantities determine record count. Records can deliberately share the same payload, including when a text layer uses `{{index}}`.

For example, one fixed record with 5,000 copies creates 5,000 identical items. Fixed-only jobs expose a single Quantity control. Identical legacy fixed records collapse into copies while preserving total item count. If artwork or filenames use `{{index}}`, their indexed variations remain available under Advanced content sources. Fixed content stays present on every item, regardless of the quantities of other sources.

Three serial records with two copies create `0001, 0001, 0002, 0002, 0003, 0003`. Copies preserve record indices and template values. Job export includes every copy; the proof package contains the selected record once and separate guide overlays. PDF copies reuse the embedded artwork image. ZIP names remain collision-safe. Switching a repeated job to numbering keeps its total quantity, with one copy per serial.

## Editor workflow

Document contains finished dimensions, background and contextual cut-shape controls. Print setup contains DPI, bleed, safe inset and guide visibility. Job contains quantity or numbering, CSV setup and advanced shared sources. The QR inspector leads with content and its resolved value. Advanced controls include source binding, templates and technical QR settings. Shared sources show layer usage and offer Make independent.

Adding a QR defaults to a new fixed source without changing quantity. Numbered QR and an optional serial-label pair remain available in Add layer. Finished preview masks artwork at the intended cut edge and hides editing guides; it does not change exported artwork. Narrow windows expose Document & job and Inspector drawers.

## Rendering and export

Preview and raster output include the outside bleed envelope. An opaque document background extends into that area. Imported artwork and artwork layers must extend beyond trim when needed; increasing the allowance does not synthesize missing image content. Guides are optional printed proof overlays and should normally be off for artwork sent to a printer.

PDF MediaBox and BleedBox include bleed. TrimBox describes the original finished size and its offset inside the page. Physical PDF dimensions use exact millimetre-to-point conversion; raster dimensions round to whole pixels, with each bleed allowance rounded once. PNG/JPG file dimensions include bleed; their embedded resolution metadata is not a production sizing contract. Use the PDF for physical page sizing.

Image PDF remains a flattened raster export. The optional **Production PDF package** preserves solid shapes, styled QR geometry, and supported text as PDF vectors. Inter regular, bold and extra-bold are bundled for preview and embedded as subsets in the PDF. Other font families/weights, characters absent from the bundled Latin font, gradients, shadows, imported images and QR logos use a transparent raster fallback at document DPI. Preflight notes identify expected fallbacks; the final report also identifies fallbacks discovered while rendering. Fonts are loaded before canvas layout so local installations do not change Inter measurements. This may change text appearance on machines that previously used a system fallback.

Vector text positions use the editor's browser measurements, including kerning and complete ligature clusters, so platform font hinting does not change preview/export spacing. Unsupported shaping is explicitly reported as a raster fallback.

The production ZIP includes `artwork.pdf`, `cut-outline.svg`, `job.json`, `preflight.json`, and a handoff README. Each PDF page contains one item; all copies are included and repeated artwork is reused as a PDF form. The SVG has the same physical page and trim offset, and contains only the finished cut outline. It is reference geometry, not a cutter command file or a PDF cutting separation. Rounded rectangle and pill contours use circular arcs. Job metadata includes source record values and page order, so treat the package with the same care as the original project.

Production artwork is RGB with live transparency where designed. The shop configures RIP color management, media, cutting and registration. The packages omit ICC conversion/output intent, PDF/X certification, machine spot-color separations and registration marks. Use the separate Print Layout export to place multiple items on a roll or sheet. Parametric cut shapes are supported. Imported arbitrary vector paths and true geometric contour offsets are future work. Bundled Inter is licensed under the [SIL Open Font License](../web/public/fonts/inter-OFL.txt).

## Roll and sheet layout

Use **Export > Print layout** to arrange the current job on roll panels or fixed-size sheets. The dedicated workspace keeps finished artwork at 100% size, with configurable media dimensions, display units, per-edge margins, gaps and one uniform orientation. Best fit evaluates both orientations for the actual job quantity and minimizes media area, then panel count. Sheet presets include US Letter, A4 and A3. Settings are portable in the optional version-2 `production.layout` field; old projects retain individual-item exports, and invalid imported settings can be reset inside layout without preventing the design editor from opening.

Gaps are measured between full bleed envelopes, not between finished cuts. All requested copies are already placed in row-major order, with the copies of each unique record consecutive. A roll panel ends after its occupied rows plus its margins; sheets always retain their configured height. The estimated media use includes each panel's margins but excludes machine feed, testing, registration and other allowances not entered by the shop.

The layout package contains a multi-up `artwork.pdf`, a matching `cut-reference/panel-NNNN.svg` for each page, `placements.csv`, `job.json`, `preflight.json` and a README. Panel PDF boxes describe the media page; finished item contours live in the reference geometry. Each item's full bleed envelope clips its artwork, including rotated items. Source record artwork is embedded once and reused for copies. Coordinates in the CSV use millimetres from the top-left media edge, with clockwise rotation; formula-leading serial values receive an apostrophe for spreadsheet safety. Job metadata retains original source values.

Preview uses a bounded-resolution current-panel canvas and a bounded thumbnail cache, not a full-DPI roll canvas. Preview cut/bleed overlays never enter exported artwork. Generation reports record/panel/ZIP progress and allows cancellation. As with individual-item production packages, the output is generic RGB with reference cuts; machine registration/cutting, RIP color/media setup and physical proofing remain the shop's responsibility. Media axes are limited to 5,000 mm; item raster and total quantity limits still apply.

## Migration and limits

Version 1 projects open as version 2 without changing artwork coordinates, finished dimensions, record order, or quantities. The old percentage-based inward “bleed” guide was not real external bleed. Migrated projects receive zero external bleed to preserve exported size; set a physical allowance deliberately. The old safe-area ratio converts to millimetres. Existing cut/guide shape settings are preserved. New saves use version 2 and should be opened with the updated editor.

Jobs are limited to 100,000 finished items. Raster export surfaces are limited to 64 million pixels and 16,384 pixels per axis. Maximum DPI is 1,200, and bleed can range from 0 to 25 mm. Actual memory limits depend on the browser and device.

## Preflight and proofing

Print checks appear in the editor and Print Layout. The checks sample resolved QR values for density and clear space, check nominal QR contrast, estimate effective image resolution, and assess visible QR/text bounds against cut and safe guides. Production packages include warnings, thresholds and sampling scope in `preflight.json`. Print-quality warnings are advisory. Missing mapped CSV QR values and other blocking export errors must be addressed before exporting the job. Proof at actual size and scan a printed sample before running the batch.

## Mimaki first

Mimaki RasterLink7 supports named spot-color cut paths and documents FineCut/ID-cut workflows. The generic production package must be validated with the internal Mimaki printer/cutter and RIP before claiming equipment compatibility. Cut naming, marks, and cutting conditions belong to the supported shop profile, not to artwork styling. Roland and other RIP profiles can share this physical document model.

Reference: [Mimaki RasterLink7 manuals](https://mimaki.com/product/software/rip/raster-link7/download-manual.html).
