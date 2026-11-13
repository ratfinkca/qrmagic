# Engineering guardrails

QR Mystic should be approachable for a poster designer and predictable for a print shop. Develop the browser app in `web/` and keep the Python/Tkinter app as a legacy reference.

## Keep the editor and export in agreement

- Keep physical dimensions and quantities in the project and production models. Convert to pixels for raster output and to points for PDF. Keep artwork anchored to the finished trim origin when bleed changes. Preserve real size through preview, placement and export.
- Keep the record resolver, geometry and rendering logic reusable across the editor, print checks and exporters. Exercise shape, gradient, shadow, transparency, text and QR parity in the browser suite when they change.
- Preserve record order and values when adding copies. A repeated design should have a simple quantity control. Keep advanced sources available for designs that need multiple independent values. Distinguish deliberate repeats from accidental duplicates.
- Keep proof, one-item production PDF and imposed layout behavior explicit. Report vector/raster fallbacks, sampling limits and print checks in the appropriate handoff. Use the [production reference](production-documents.md) for exact contracts.
- Validate printer-specific settings with the actual RIP and a physical sample before claiming compatibility. Keep cut paths, machine marks and color-management choices separate from artwork design.

## Preserve project data and compatibility

- Keep project files portable and support older saved versions. Add migration coverage when changing their format or defaults. Keep local identity and storage revisions outside the file.
- Keep edits and exports in the browser by default. Save, open and share with Drive through explicit user actions and the `drive.file` scope. See the [Drive runbook](google-drive.md).
- Treat artwork, CSV rows, QR payloads, filenames and production reports as potentially private. Use synthetic data in tests and examples. Preserve both versions when local saves conflict and expose local save failures without taking away file download.
- Keep generated web output, credentials, tokens and local overrides out of Git. The checked-in desktop build files are historical.
- Prefer established libraries for canvas, QR, CSV, PDF and ZIP. Add an adapter where the library falls short, and document any output limitations people need to know before choosing a format.

## Verify changes and document them as you go

- Use Vitest for pure models and Playwright for editor workflows and exported artifacts. For export changes, check the dimensions, visual output, quantity/order and decoded QR payloads that the change can affect. Use the [development handoff](development-handoff.md) for commands and the release workflow.
- Update docs with the change that affects them. User-facing behavior belongs in the shared [help source](../web/src/lib/helpContent.ts), with the regenerated [user guide](user-guide.md). Update setup and operating notes in the [handoff](development-handoff.md), project/export contracts in their technical references, and milestone changes in the [roadmap](next-edition-plan.md). Record meaningful architectural choices and their tradeoffs in the relevant reference.
- Read the handoff when resuming development and review it again before handing off. [AGENTS.md](../AGENTS.md) is the entry point for automated contributors.
