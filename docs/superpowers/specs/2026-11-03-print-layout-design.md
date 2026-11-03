# Print Layout: roll and sheet production

Status: proposed design for review. The production PDF foundation is committed separately as `b1553ca`; no layout product code has been added yet.

## Intent

Turn an approved finished design and its job quantities into a predictable multi-up print job. A designer shares the portable project; the print shop opens it, selects media and spacing, reviews the arrangement, and downloads actual-size PDF panels without resizing the design or rebuilding the batch in another design application.

The user approved configurable roll/sheet dimensions, margins, spacing, rotation, zoomable preview, manageable PDF panels, and a material-use summary. The specific defaults and implementation choices below are proposals, not supplied Mimaki specifications.

## Approach

Use a regular rectangular grid with one orientation per job. It makes record order, bleed clearance, quantities and cutting-reference alignment easy to inspect and verify. Reuse the current production PDF's vector artwork, embedded fonts and explicit raster fallbacks.

Alternatives considered: leaving all arrangement to the RIP would not deliver the requested app workflow. Arbitrary nesting, mixed orientations and contour interlocking could improve material use but would complicate quantity auditing and machine validation. Those remain future work. This proposal implements the regular roll/sheet layout direction already discussed, without claiming a particular Mimaki profile.

## Workflow and screen

Add a Print layout action beside the production package export. It opens a separate full-window workspace, with Back to design, a settings column, central panel preview and persistent summary/download actions. It is a production step; editing artwork remains in the existing editor.

- Media: Roll or Sheet, display units mm/in, printable width, and either maximum panel length or fixed sheet height.
- Start with a custom 24-inch (609.6 mm) roll and a 1,000 mm maximum panel length. Common sheet presets: US Letter, A4 and A3, plus Custom. Presets are conveniences, not machine profiles.
- Margins: 10 mm on every edge initially; a single control updates all edges, with separate top/right/bottom/left controls under Advanced.
- Spacing: 3 mm horizontally and vertically initially. Explain directly: spacing is clear space BETWEEN BLEED AREAS. Finished cut-to-cut separation therefore includes both items' bleed allowances. Never silently overlap or remove bleed to fit more items.
- Orientation: As designed, Rotate 90 degrees clockwise, or Best fit. Best fit evaluates two uniform grids for the actual requested quantity; it does not rotate individual items independently. Its complete ranking is lowest total media area, then fewer panels, then the original orientation. For a fixed roll width, lowest area also means shortest total media length. For fixed-size sheets it means fewest sheets. This ranking is the builder's proposed choice, prioritizing material use over theoretical maximum grid capacity.
- Quantity and content come from the current job. Show records, copies and total; a link back to Job lets the user change them. Layout does not create additional records or modify QR values.
- Summary: items across, rows on the selected panel, panel/sheet count, total quantity, finished item dimensions, current panel dimensions, and estimated media use. Roll use includes every panel's configured margins; sheets report count and total area. State that this excludes extra machine feed, test prints and registration space not entered in margins.
- Preview: Fit, zoom in/out and panel navigation. Artwork, finished cut outlines and bleed envelopes are individually identifiable; production guides are preview-only. Show the selected panel's page/item range. Empty grid positions on the last page remain empty.
- On narrow screens, settings and preview become stacked sections or accessible drawers. Controls have persistent labels, keyboard access and visible validation; changing a layout field must not scroll the user away from that field.

The visual concept is a design illustration, not a working production export.

## Physical layout contract

All calculations use physical millimetres; display-unit changes do not change the stored geometry. Derive exact trim/bleed sizes from the current production geometry, rather than rounded raster pixels. An item occupies its full rectangular bleed envelope even when the finished cut is curved.

Let an oriented envelope be W by H, usable media width U, usable panel/sheet height V, and gaps Gx/Gy. Columns = floor((U + Gx) / (W + Gx)); rows = floor((V + Gy) / (H + Gy)), with a small numerical tolerance for exact fits. Margins are outside this grid, and gaps occur only between items. Zero columns/rows is a blocking error, never an invitation to scale the design.

Place items left-to-right, top-to-bottom. Preserve current print-record order: all requested copies of record 1, then record 2, and so on. A copy keeps the record's QR and visible serial. Assign a monotonically increasing finished-item number independently of unique record index.

Sheet pages always retain their selected dimensions. Roll panels retain full configured width and use only the length needed for their occupied rows plus top/bottom margins; no roll panel exceeds the maximum panel length. Reapply margins to each new panel and include them in material estimates.

Media dimensions must be positive and at most 5,000 mm on each axis; margins/gaps must be finite and nonnegative and leave room for at least one envelope. The 5,000 mm cap is a generic PDF compatibility bound, not a printer specification. Preserve existing item and job limits. Do not create a full-resolution raster canvas for an entire roll or sheet.

Placement, artwork and cut geometry must use the same transform, including a 90-degree rotation. Clip each embedded item to its own bleed envelope so off-page artwork cannot intrude into neighboring items. A page's TrimBox/BleedBox describe the media page; individual finished cuts are described by the cut reference and manifest, not by pretending a sheet has one item's TrimBox.

## Auditable example

5,000 copies of one 50.8 x 50.8 mm sticker, 3 mm bleed, a 609.6 mm roll, 10 mm margins, 3 mm gaps and a maximum 1,000 mm panel:

- Envelope: 56.8 x 56.8 mm; usable width: 589.6 mm.
- 9 columns x 16 rows = 144 items per full panel.
- 34 full panels (4,896 items) plus one final panel (104 items).
- Full panel length: 973.8 mm. Final panel: 12 occupied rows, 734.6 mm long, with four unused positions in its last row.
- Total: 35 panels and 33,843.8 mm (33.844 m) of calculated media length, excluding additional machine feed and testing.

## Saved settings and exports

Store an optional layout-settings object alongside production quantities in the portable version-2 project. Existing files without it retain the current individual-item export. Normalize and validate settings on load; invalid saved settings must show a recoverable layout error rather than breaking the design editor. Store settings only, not every derived placement; recompute after artwork size, bleed or quantity changes.

Keep the existing individual-item production package. Layout export creates a separate ZIP with:

- `artwork.pdf`: one actual-size panel or sheet per page, retaining reusable vector artwork/fonts and the current fallback behavior.
- `cut-reference/panel-0001.svg` and subsequent page references: physical media dimensions and every transformed finished cut, without artwork. Curves remain vector paths. Clearly labeled reference geometry; no machine cutting commands or spot separation.
- `job.json`: settings, physical page dimensions, quantity totals, expected page count, and ordered record values.
- `placements.csv`: panel number, finished-item number, record number, copy number, resolved primary serial, envelope x/y, oriented trim dimensions, bleed and rotation; physical fields in mm. Escape CSV quoting and protect spreadsheet formula-leading values. The complete QR data remain available in the project/source record values; the primary serial alone is not claimed to enumerate every independently bound QR layer.
- `preflight.json` and README: rendering/fallback notes, generic RGB limitations, actual-size printing instructions and expected item/panel totals.

Render each unique source record once and reuse its embedded PDF artwork for all copies and placements. Do not render a separate canvas for every copy. Preview renders only the selected panel and caches/reuses record artwork. PDF generation yields to the browser and reports panel progress so large jobs do not appear frozen. Cancellation before download discards the partial package and releases the export lock.

## Scope boundaries

Web app only; client-side/local-first, no account, backend, cloud upload or desktop packaging. This phase adds geometric imposition, not production certification. No inferred printer width, ink configuration, integrated cutter, registration marks, CutContour separation, ICC conversion, PDF/X certification, contour nesting or automatic material-specific cutting settings. Defaults are editable. Mimaki validation follows once the actual printer/cutter/RIP details arrive.

## Implementation boundaries

- Pure layout calculation and placement iteration live outside React and PDF rendering.
- A dedicated PrintLayout component owns the production workspace; do not put its controls into the already large Inspector.
- A layout-PDF module composes the existing production renderer's results and reuses artwork. The existing one-item export API remains available to current callers and tests.
- Package assembly owns manifest/reference generation separately from layout calculation.
- No new runtime dependency is expected; reuse React, pdf-lib, JSZip and the current geometry/rendering helpers. Precise component styling, control grouping and internal function names are builder choices within this design.

## Acceptance checks

Unit tests cover the worked 5,000-item example, exact fits, inch/mm equivalence, zero gap, non-square rotated items, asymmetric margins, impossible fits, nonfinite/negative values, final partially filled rows, sheet dimensions, deterministic best-fit ties, unchanged record/copy order, old project files and invalid saved settings.

Browser export tests open layout from the editor, change settings, navigate/zoom, export and reopen a saved project. Inspect PDF physical page dimensions and manifest totals; rasterize representative first/last panels and decode first/last QR payloads, including a mixed fixed/serialized design, multiple copies, rotated artwork and a raster fallback. Verify cut-reference transforms match artwork, exported artwork contains no preview guides, empty last-panel slots remain empty, and text remains selectable with embedded fonts. Verify keyboard/narrow-screen access, validation recovery, progress/cancel behavior and no uncaught browser errors.

Run all unit tests, the full browser export suite and the production build. Independently review the final implementation. Leave it running locally and unpushed for user review.
