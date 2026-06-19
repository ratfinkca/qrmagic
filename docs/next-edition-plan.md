# QR Magic Next Edition Plan

## Purpose

QR Magic exists to make production batches of serialized QR-coded documents, decals, labels, and similar printed assets. The next edition should preserve the practical batch-generation strength of the original desktop app while becoming more flexible, visual, reusable, and publishable.

The current Python/Tkinter app should be treated as the working reference implementation. It proves the workflow and should remain intact until the web app can replace it confidently.

## Product Direction

The next edition should feel like a lightweight production designer, not a form that happens to generate images.

The core workflow should be:

1. Define the document or decal size.
2. Add artwork, QR codes, and text layers on a visual canvas.
3. Connect QR and text values to serial rules or imported data.
4. Preview generated records before export.
5. Export production-ready files and a manifest.

## Primary Users

- Event operators producing parking passes, decals, credentials, wristband inserts, tickets, or permits.
- Designers preparing artwork with serialized QR overlays.
- Small operators who need one-off, small-batch, and large-batch generation without a heavy publishing suite.
- Developers or technically comfortable users who may want to reuse the app as an open-source tool.

## Guiding Principles

- Keep batch production reliable and boring in the best way.
- Prefer direct manipulation over numeric-only controls.
- Make the first screen useful, not promotional.
- Design around real printed output: size, DPI, bleed, safe area, alignment, and validation matter.
- Keep the app local-first unless a backend becomes clearly necessary.
- Keep templates portable as plain project files.
- Separate rendering/export logic from UI so the engine can be reused.
- Preserve the current desktop app until replacement behavior is proven.

## Web App Target

The recommended path is a local-first web app:

- Vite + React + TypeScript for the app shell.
- A canvas editor using a proven library such as Konva or Fabric.
- Client-side QR generation.
- Client-side image/PDF/ZIP export where practical.
- Web Workers for heavy batch generation once needed.
- JSON project/template files for save/load.

This avoids account, hosting, privacy, and upload concerns while still making the app easy to publish and share.

## Major Feature Areas

### Designer

- Page/decal setup with units such as inches, millimeters, and pixels.
- DPI-aware canvas.
- Background image layer.
- QR layer placement, resizing, and settings.
- Text layers for serials and imported fields.
- Alignment tools and snapping.
- Layer ordering, lock, hide, duplicate, and delete.
- Zoom, pan, fit-to-page, and preview modes.

### Data And Serialization

- Manual quantity-based serial generation.
- Prefix, suffix, start number, step, and zero-padding.
- CSV import with real column parsing.
- Field mapping for QR payload, visible serial text, filenames, and optional text layers.
- Duplicate detection.
- Missing-field validation.
- Reserved or skipped serial ranges.

### Export

- Individual PNG/JPG files.
- Flattened raster exports for simple production workflows.
- Layer-preserving exports where supported by the format and available libraries.
- ZIP export for batches.
- Print-ready PDF output.
- SVG export for vector-oriented workflows.
- EPS export if practical library support is reliable enough.
- BMP export for compatibility with older print or production tools.
- Layered PDF, Photoshop, and Illustrator-oriented export should be explored, with clear documentation of support limits.
- Multi-up sheet layouts.
- Manifest CSV/XLSX containing source row, generated filename, QR payload, serial, and status.
- Proof sheet export.
- Export presets.

### Templates

- Save/load project files.
- Save reusable templates without private data.
- Bundle template examples for common use cases.
- Support portable project files that can be shared publicly.

### Validation

- Warn on duplicate QR payloads.
- Warn on invalid or duplicate filenames.
- Warn when required mapped fields are empty.
- Warn when layers fall outside page bounds.
- Warn when QR size or quiet zone may reduce scan reliability.
- Optionally decode generated QR samples as a scan check.

## Current Web Prototype Checkpoint

As of the `codex/convert_2_web_00` branch, the web prototype has moved beyond the initial single-export proof of concept. It now includes:

- Vite, React, TypeScript, and Konva editor scaffold.
- Visual document canvas with select, pan, zoom, lasso selection, and multi-select transforms.
- Collapsible left panels for document setup, guide settings, data groups, and layers.
- Document settings for size, unit, DPI, page color, transparent backgrounds, trim, bleed, and safe-area guides.
- Shape/color, image, QR, and text layers with ordering, visibility, deletion, opacity, sizing, and inspector controls.
- Multiple serial data groups, with new QR layers automatically paired with a matching serial text layer.
- Single-layer and group alignment tools, including alignment to document guide targets and non-overlapping selection packing.
- Save/open support for `.qrmagic.json` project files.
- Flattened PNG export for one record and zipped PNG batch export.

Near-term priorities for the next development session:

- CSV import, column mapping, and generated-record validation.
- Manifest export for batch jobs.
- Export architecture cleanup before adding layered/vector/PDF-oriented formats.
- Code splitting for export-heavy libraries so the main web bundle stays smaller.
- More formal tests around project serialization, serial generation, selection alignment, and export naming.

## Suggested Phases

### Phase 1: Foundation

- Preserve the legacy app.
- Add planning docs and guardrails.
- Define a project/template model.
- Decide web stack.
- Scaffold the web app.

### Phase 2: Prototype

- Build a single-page designer.
- Support document size, background image, QR layer, and serial text layer.
- Support basic serial generation.
- Preview a selected record.
- Export one PNG.

### Phase 3: Batch Workflow

- Add CSV import and column mapping.
- Add batch preview records.
- Add ZIP export.
- Add manifest export.
- Add validation before generation.

### Phase 4: Print Production

- Add DPI/unit controls.
- Add print-ready PDF export.
- Add flattened versus layered export options where formats support it.
- Add additional print-oriented formats based on library feasibility.
- Add multi-up layouts.
- Add bleed, safe area, and alignment helpers.
- Add proof sheets.

### Phase 5: Publishable Repo

- Reorganize legacy desktop files clearly.
- Remove generated build artifacts from normal source tracking.
- Add screenshots, sample templates, and example data.
- Add tests for project model, serial generation, and export naming.
- Add contributor and development docs.

## Out Of Scope For The First Web Version

- User accounts.
- Cloud storage.
- Collaborative editing.
- Hosted rendering queues.
- Payments or licensing.
- A marketplace for templates.

These may become useful later, but the first web version should prove the local production workflow.
