# Friendly print-quality checks

Shipped in `b4a7db9`. This is a [historical plan](../README.md). See the [development handoff](../../development-handoff.md) for current instructions.

User approved QR size/contrast, image resolution and safe-area warnings; run all tests/build and leave locally reviewable, uncommitted/unpushed. Base main22eef0d, 55 unit tests/48 browser tests.

## Design decisions

Keep existing production errors and raster-fallback reports. Add an advisory Print checks card for all editor export formats and Print Layout, with layer names, concrete measurements and useful next steps. Warnings never disable exports or silently modify artwork. State that checks are automated guidance; test a physical sample, and let the shop set final requirements. Include new warnings in production/layout preflight reports.

- QR: analyze real module density with the same QR encoder/mode/error-correction rules as the renderer. Compare physical module pitch with a conservative 0.25 mm starting guideline (not certification) and raster module pitch with four pixels. Verify four-module clear-space allowance. Analyze first/last and serial-boundary samples, deduplicating fixed payloads; disclose sampling, do not expand copies or claim every record scanned. Compare solid dark/light QR colors; warn on low contrast, reversed polarity, opacity and unknown/transparent backgrounds. A luminance ratio is a screening heuristic, not an ISO barcode grade. No synthetic scan-success guarantee.
- Images: decode native pixel dimensions without mutating the project; calculate effective PPI using stretch/contain/cover/original fit. Advisory target300PPI for close viewing, explain that large posters may be acceptable lower. Skip intrinsic PPI for SVG vectors, and disclose embedded raster limitations. Bound image metadata cache and decode time; report unavailable data without claiming good quality. Do not fetch/upload separate remote data.
- Safe area: check visible nonempty QR/text boundaries and rotation against trim and configured safe guide for the actual cut shape. Background shapes/images may bleed and do not get text-style safe warnings. Use the shared cut path and bounded perimeter sampling via browser Path2D; labels say 'appears' and request a guide check. Detect obvious outside-trim separately from inside-trim/unsafe, and do not treat hidden guide overlays as disabled validation.

## Implementation and verification

1. Failing unit tests for physical QR scale/quiet zone/contrast, fit-aware effective PPI, rotated bounds, ignored invisible artwork and sampled record planning. Keep pure calculations in printQualityModel.ts; shared cut geometry in cutGeometry.ts. Add direct access to the already-used QR encoder if needed, with pinned compatible dependency and lockfile.
2. Browser analysis adapter loads bounded image metadata, supplies cut-path containment, and merges quality issues with productionPreflight. Debounced hook ignores stale results and shows Checking/Unavailable rather than stale success. Separate errors from quality warnings and format-specific raster notes.
3. Reusable PrintChecks UI: friendly summary, details, select affected layer in editor (respect export lock), tips and measurements. Reuse in Print Layout and include final analysis in production PDF packages/reports without duplicating notes.
4. Browser tests for all-format visibility, issues resolving after real edits, QR density agreement with rendered symbols, actual raster dimensions/fit, curved/rotated safe bounds, missing images, stale-analysis handling and unchanged project/export dimensions. Update shared help and generated guide/README.
5. Full unit/browser suites and build, independent read-only review, rendered desktop/narrow check. Leave Vite at127.0.0.1:5173/qrmagic/ for review.

Reference guidance: DENSO quiet zone https://www.qrcode.com/en/howto/code.html and module sizing https://www.qrcode.com/en/howto/cell.html; Adobe effective resolution https://helpx.adobe.com/photoshop/desktop/crop-resize-transform/resize-adjust-resolution/resolution-specs-for-printing-images.html. Thresholds above are app guidance, not printer profiles or barcode certification. Browser unit tests cover pure computations; browser regressions cover native image/Path2D behavior.

## Completed and verified

- Added pure quality calculations, renderer-matched QR module measurements, native bounded image metadata checks, and shared cut-path checks. All sampled QR densities contribute quiet-zone checks; the densest samples supply conservative size guidance. Safe inset rounding matches visible guides.
- Added debounced, cancellable UI analysis and a Print checks card in all export modes and Print Layout, with measurements, layer selection, failure/checking states and explicit sampling/overlap limitations. Warnings leave artwork unchanged and remain advisory; existing production errors still gate production export.
- Added print-quality issues and scope/threshold metadata to both production and imposed-layout reports. Updated in-app help, generated guide, README and lazy dependency prebundling. Direct qrcode-generator1.5.2 was already the locked renderer dependency; no encoder/rendering behavior changed.
- Independent read-only review found only a transparent-text visibility mismatch. Fixed it, including shadow-aware behavior, and added a regression.
- All 63 unit tests and 52 Chromium browser/export tests passed. New browser cases cover all-format visibility/fixes, no silent artwork changes, real QR decoder version parity including Unicode, curved cuts, image fit/output DPI/SVG/unreadable sources, stale asynchronous results and narrow-screen bounds. Existing exact pixel/PDF checks still pass. The old zero-note vector-export assertion now expects its correctly reported advisory quiet-zone warning; vector, sizing and decode assertions are unchanged.
- TypeScript and production build passed; existing large-chunk warning remains. Generated guide matches shared content. Desktop1280×720 and phone390×844 rendered review passed, with no browser error/warning logs. No physical printer, actual phone scan, Safari/Firefox or screen-reader session was performed.
- Local Vite remains running at `http://127.0.0.1:5173/qrmagic/` (session8169). A separate review tab shows the autosaved Print checks demo with intentional size/contrast/curved-cut suggestions. Screenshots are outside the repository in the session visualization directory. Changes remain uncommitted and unpushed on `codex/print-quality-checks`.
