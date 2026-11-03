# Print Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use native inline execution authorized by the user's explicit build request; independent whole-change review at the end.

**Goal:** Deliver the approved roll/sheet layout workflow with verifiable actual-size PDF panels, cut references and placement manifest.

**Architecture:** Pure millimetre layout calculation drives both preview and export. A dedicated React workspace previews only the current panel; a separate exporter reuses the production PDF renderer for unique records and imposes embedded artwork into panel pages. Optional saved settings preserve version-2 project compatibility.

**Tech Stack:** Existing React/TypeScript/Vite, Konva renderer, pdf-lib, JSZip, Vitest and Playwright. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-11-03-print-layout-design.md` (approved by user).

## Global constraints

- Web-only, local-first. Keep current exports; no push. Reuse current checkout on a feature branch so local review stays at the known URL.
- Media dimensions >0 and <=5,000 mm; nonnegative finite margins/gaps; existing 100,000-item job limit. Finished size never scales to fit.
- Spacing is between bleed envelopes. One uniform orientation; Best fit minimizes actual media area, then panel count, then favors original orientation.
- Row-major placement; all copies of each record stay consecutive. Every panel includes its own margins. Sheets retain fixed dimensions; roll panels shrink to occupied rows.
- RGB/reference-cut handoff only. No machine marks, cut commands, ICC/PDFX, mixed-orientation nesting or cloud services.

## Review focus

- Malformed imported layout settings: editor stays usable and layout offers reset/recovery (Task 1 + 3 tests).
- Floating-point exact fits and inch/mm changes: no accidental extra row, dropped item or resizing (Task 1 tests).
- Rotation/clipping/transparency: matching artwork/cut transforms, no neighboring artwork spill (Task 2 browser tests).
- Large repeated jobs and cancellation: render each source once, yield/progress, release export lock, discard partial ZIP (Tasks 2 + 3 tests).
- Last-panel auditing and mixed QR content: exact totals/order, empty slots, first/last decodes, formula-safe CSV (Tasks 1 + 2 tests).

## Task 1: Layout model and portable settings

Files: create `web/src/lib/printLayout.ts`, `printLayout.test.ts`; modify `web/src/types.ts`, `web/src/lib/project.ts`.

Interfaces: `PrintLayoutSettings`; `defaultLayoutSettings()`; `calculateLayout(project, settings)` -> dimensions/orientation/columns/rows/capacity/panel count/material summary; `layoutPanel(plan, index)` -> actual dimensions and ordered placements; `placementIdentity(itemIndex, copies)` -> record/copy indices. All physical fields use mm and indices are zero-based internally.

- [x] Add failing tests: 5,000-copy worked example (35 panels, last104 items, 33,843.8 mm), exact fits, asymmetric margins, zero gap, non-square rotation, best-fit actual material comparison/tie, invalid values/impossible fit, record/copy order, legacy and malformed saved settings.
- [x] Run targeted Vitest and observe red.
- [x] Implement pure calculation and optional settings normalization. Store no placements in project JSON; preserve malformed input as recoverable layout validation state.
- [x] Run targeted tests/typecheck and record results.

## Task 2: Imposed PDF and audit package

Files: create `web/src/lib/printLayoutExport.ts`; extend `productionPdf.ts` with optional AbortSignal/progress hooks; add export tests to `web/tests/export-rendering.test.mjs`.

Interfaces: `exportLayoutPackage(project, settings, {signal,onProgress}) -> Blob`; `layoutCutSvg(project, plan, panel)`; `placementCsv(project, plan)`.

- [x] Add browser tests for two-panel sheet export with exact PDF size, source reuse, font/text/vector preservation, first/last QR decodes, rotated non-square cuts, fallback/clipping and empty slots; unit tests for CSV quoting/formula safety and abort.
- [x] Run targeted tests and observe red.
- [x] Render unique records once with cancellation/progress, embed clipped PDF forms, impose pages using shared transforms. Write cut SVG per page, job metadata, safe placement CSV, preflight and README. Yield between records/panels and check abort through ZIP creation.
- [x] Run export and unit regressions; record results.

## Task 3: Print Layout workspace and editor integration

Files: create `web/src/components/PrintLayout.tsx`, `PrintLayoutPreview.tsx`, `print-layout.css`; modify App/Inspector/types/project save integration; extend browser tests.

Interfaces: workspace consumes project and saved settings; updates optional `production.layout`; Back to design retains selection/history; preview receives plan/panel and renders cached unique-record artwork at capped preview resolution. Export controls stay locked while generating, except cancel.

- [x] Add failing UI tests: entry/back, media presets/mm-in, independent margins, validation/reset, panel navigation/zoom, save/reopen, narrow/keyboard access, export/progress/cancel recovery.
- [x] Implement the approved concept in existing visual style, using responsive sections, accessible labels, stable controls and current-panel preview only. Show correct physical summary and preflight notes.
- [x] Run all unit tests, full browser suite and production build. Independently review changes, fix material findings with regressions, rerun affected/full checks as appropriate.
- [x] Leave local server running; do not commit/push new layout implementation before user review.

## Progress ledger

Base: `4e73622`. Current approved foundation: 26 unit tests, 35 browser tests and build passed before this feature. No implementation changes yet.

Ruling: use a feature branch in the existing checkout instead of a new worktree, honoring the active local review workflow and shared dependencies. No new runtime dependency or environment setup is needed.

Task 1: complete. Added 13 layout unit cases; targeted Vitest passed (including five invalid-dimension cases). TypeScript passes. Observed missing-module red before implementing the model.

Task 2: implementation complete; focused browser PDF test passed for rotated mixed serial/fixed QR panels, exact dimensions, source reuse, six copies, SVG count, CSV count and cancellation. Additional fidelity/empty-slot regressions and full-suite checks remain in Task 3. Observed missing-export-module red before implementation.

Task 3: workspace implemented; focused UI regression in progress. No layout implementation commits or pushes, as requested for local review.

Final review: independent reviewer approved after one material finding was fixed. Generated QR PNG images now bypass the permanent imported-image cache, so thumbnail eviction/unmount can release their source images. Browser regression observed one retained source image before the fix (red), then two ephemeral sources after two renders (green), while imported artwork still loads once.

Task 3: complete. Desktop laptop-height visibility regression observed red, then passed with independently scrolling columns/persistent export actions. Fit responds to preview viewport size; guide checkboxes are scoped to avoid global input sizing. Save/reopen, corrupt-settings recovery, narrow Inspector entry, cancel/retry and ZIP-stage cancellation pass. No unreviewed implementation commits or pushes.

Final verification: 39 unit tests and 39 browser tests pass; TypeScript/Vite production build passes with bundle-size warnings. Local Vite remains running on http://127.0.0.1:5173/qrmagic/ for user review. Layout settings and packaging remain generic; machine/RIP validation is deferred as specified.

Release: user reviewed the local implementation and authorized shipment on 2026-11-03. Commit the reviewed changes, integrate into main, push, and verify GitHub Actions tests/build and Pages deployment for the pushed commit. This supersedes the earlier hold for local review.
