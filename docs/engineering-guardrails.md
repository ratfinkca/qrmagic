# Engineering Guardrails

## Mission

Build the next edition of QR Magic as a flexible, production-focused QR document designer while preserving the working legacy desktop app until the replacement is proven.

These guardrails are meant to keep future implementation grounded. Update them deliberately when the project direction changes.

## Preserve The Legacy App

- Do not break the existing Python/Tkinter app while building the web version.
- Treat the desktop app as the behavioral reference for core batch generation.
- Avoid large rewrites of the desktop app unless the task specifically targets it.
- If files are reorganized, keep the old app runnable and document the new command.

## Do Not Port Blindly

- Do not translate Tkinter screens line-for-line into web UI.
- Use the current app to understand workflows, not as a web architecture template.
- Prefer a visual designer model over a larger web form.

## Keep Core Logic Separate

Rendering, project state, serial generation, CSV parsing, validation, and export should not be trapped inside UI components.

Target separation:

- UI components manage controls and interaction.
- Project model stores document, layers, data, and export settings.
- Rendering engine converts a project and record into visual output.
- Batch engine iterates records and reports progress.
- Export engine writes images, PDFs, ZIPs, and manifests.

## Local-First By Default

- Prefer browser-local operation before adding a backend.
- Do not introduce accounts, cloud storage, or hosted rendering without a clear reason.
- Avoid sending user artwork or CSV data to external services.

## Production Workflow First

Every major feature should support real batch production, not just look good in a demo.

Prioritize:

- Accurate document/page sizing.
- DPI-aware export.
- CSV/data mapping.
- Serial generation.
- Batch preview.
- Duplicate detection.
- Export manifests.
- Print-ready output.
- Reusable templates.

## Designer UX

- Prefer direct manipulation on a canvas.
- Numeric fields are still useful, but should complement visual editing.
- Provide zoom, pan, alignment, snapping, and layer controls.
- Make the preview represent exported output as closely as possible.
- Do not hide production-critical settings behind decorative UI.

## Data Safety And Validation

- Validate before export.
- Detect duplicate QR payloads.
- Detect duplicate or invalid filenames.
- Detect missing required fields.
- Detect layers outside document bounds.
- Warn about potentially unreadable QR sizes or quiet zones.
- Report export failures in a manifest or clear result log.

## Publishable Repo Hygiene

- Keep generated build artifacts out of normal source tracking once cleanup begins.
- Add sample templates and sample CSV data that do not contain private event or guest information.
- Keep setup instructions current.
- Prefer explicit scripts for development, testing, and building.
- Keep docs written for future contributors, not only the original author.

## Testing Priorities

Start with focused tests around behavior that can quietly ruin a production batch:

- Serial value generation.
- Filename template rendering and sanitization.
- CSV parsing and mapping.
- Duplicate detection.
- Project model migrations.
- Export record planning.

UI tests can come later, once the web designer structure settles.

## Dependency Choices

- Prefer mature libraries for canvas editing, QR generation, CSV parsing, ZIP generation, and PDF export.
- Prefer strongly supported public libraries for common, well-understood formats and workflows.
- Do not invent custom engines where proven browser libraries already fit the production need.
- Do not be afraid to write small custom adapters, renderers, exporters, or validation logic when existing libraries are incomplete, abandoned, too limiting, or produce poor production output.
- Keep dependency count reasonable and explain major choices in docs.
- When a format has weak browser support, document the limitation instead of pretending the export is more editable or standards-compliant than it really is.

## Export Quality

- Support flattened exports for dependable production output.
- Explore layer-preserving exports for formats where reliable libraries or standards make that realistic.
- Treat layered PDF, EPS, SVG, Photoshop, and Illustrator-oriented exports as format-specific investigations.
- Prefer honest, verified export behavior over checking boxes in the UI.
- Add export test files or visual verification for formats that become officially supported.

## Decision Log

When making a meaningful architectural choice, add a short note to project docs explaining:

- What was chosen.
- Why it fits QR Magic.
- What tradeoffs it brings.

This matters because the project is moving from a small personal utility toward a reusable public tool.
