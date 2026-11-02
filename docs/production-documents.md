# Production document model, phase one

The web editor starts with a new-project chooser for numbered decals, a QR poster, repeated stickers, or an empty canvas. Open project file is available in the chooser and toolbar. Creating or opening another project asks before replacing an unsaved design.

## Version 2 project contract

- `document.width`, `height`, and `unit` describe the finished trim dimensions. Layer positions remain relative to the top-left of trim, measured in pixels at document DPI.
- `document.bleedMm` is a uniform physical allowance outside all four trim edges. It enlarges the artwork/export canvas without moving the artwork relative to trim. The bleed envelope is rectangular, including when the cut is curved.
- `document.safeAreaMm` is an inset for composition guides. On nonrectangular cuts the inset bounding-box guide is a visual aid, not a computed constant-distance offset of the contour.
- `document.shape` is the intended cut geometry within the finished bounds, independently of artwork layers. It uses the existing parametric geometry presets and polygon controls. Corner radius is stored in document pixels and edited in millimetres.
- `production.copiesPerRecord` is a positive integer. Data-group quantities still determine the record count. Records can deliberately share the same payload, including when a text layer uses `{{index}}`.

For example, one fixed record with 5,000 copies creates 5,000 identical items. Fixed-only jobs expose a single Quantity control. Identical legacy fixed records collapse into copies while preserving total item count. If artwork or filenames use `{{index}}`, their indexed variations remain available under Advanced content sources. Fixed content stays present on every item, regardless of the quantities of other sources.

Three serial records with two copies create `0001, 0001, 0002, 0002, 0003, 0003`. Copies preserve record indices and template values. Job export includes every copy; the proof package contains the selected record once and separate guide overlays. PDF copies reuse the embedded artwork image. ZIP names remain collision-safe. Switching a repeated job to numbering keeps its total quantity, with one copy per serial.

## Editor workflow

Document contains finished dimensions, background and contextual cut-shape controls. Print setup contains DPI, bleed, safe inset and guide visibility. Job contains quantity or numbering, with shared-source management under Advanced. The QR inspector leads with content and its resolved first-item value; source binding, templates and technical QR settings remain accessible under Advanced. Shared sources show their layer usage and offer an explicit Make independent action.

Adding a QR defaults to a new fixed source without changing quantity. Numbered QR and an optional serial-label pair remain available in Add layer. Finished preview masks artwork at the intended cut edge and hides editing guides; it does not change exported artwork. Narrow windows expose Document & job and Inspector drawers.

## Rendering and export

Preview and raster output include the outside bleed envelope. An opaque document background extends into that area. Imported artwork and artwork layers must extend beyond trim when needed; increasing the allowance does not synthesize missing image content. Guides are optional printed proof overlays and should normally be off for artwork sent to a printer.

PDF MediaBox and BleedBox include bleed. TrimBox describes the original finished size and its offset inside the page. Physical PDF dimensions use exact millimetre-to-point conversion; raster dimensions round to whole pixels, with each bleed allowance rounded once. PNG/JPG file dimensions include bleed; their embedded resolution metadata is not a production sizing contract. Use the PDF for physical page sizing.

PDF artwork is still flattened raster. This phase stores and previews cut geometry; it does not emit a machine spot-color cutting separation, PDF/X, registration marks, imposition, or ICC conversion. Parametric custom shapes are supported; imported arbitrary vector paths and true geometric contour offsets are future work.

## Migration and limits

Version 1 projects open as version 2 without changing artwork coordinates, finished dimensions, record order, or quantities. The old percentage-based inward “bleed” guide was not real external bleed. Migrated projects receive zero external bleed to preserve exported size; set a physical allowance deliberately. The old safe-area ratio converts to millimetres. Existing cut/guide shape settings are preserved. New saves use version 2 and should be opened with the updated editor.

Jobs are limited to 100,000 finished items. Raster export surfaces are limited to 64 million pixels and 16,384 pixels per axis; maximum DPI is 1,200. Actual memory limits depend on the browser and device.

## Mimaki first

Mimaki RasterLink7 supports named spot-color cut paths and documents FineCut/ID-cut workflows. The next print-and-cut exporter should be validated with the internal Mimaki printer/cutter and RIP before claiming equipment compatibility. Cut naming, marks, and cutting conditions belong to the supported shop profile, not to artwork styling. Roland and other RIP profiles can share this physical document model.

Reference: [Mimaki RasterLink7 manuals](https://mimaki.com/product/software/rip/raster-link7/download-manual.html).
