# QR Mystic milestones and roadmap

QR Mystic is a web app for quick QR posters as well as numbered decals, repeated stickers and spreadsheet-driven print jobs. The editor and production tools run in the browser. The original Tkinter app remains a legacy reference.

## Shipped

| Milestone | What users can do today |
| --- | --- |
| Web designer and publishing | Start from a template or blank canvas, design with QR/text/image/shape layers, and open or download editable project files. Tests and build gate Pages deployment. |
| Production documents and export | Set finished size, bleed, cut shape, and quantities. Download a single-item proof, image batches, or a vector-capable production PDF package with cut references and preflight. |
| Roll and sheet layout | Place all copies at actual size with margins, gaps, uniform rotation and panel splitting. Export multi-up PDFs with cut references and a placement CSV. |
| Help and onboarding | Search in-app help, open contextual tips and take an optional walkthrough. |
| Local recovery | Autosave, open or duplicate recent projects, and preserve conflicting edits as separate local copies. |
| Print checks | Review sampled QR size, clear space and contrast, effective image resolution, and safe-area suggestions. |
| CSV batches | Map columns to QR and text layers, preview rows, and review missing or repeated values before export. |
| Google Drive pilot | Search or browse accessible Drive projects, save a named copy to a chosen folder, and use Google’s sharing controls. OAuth is External / Testing for listed accounts. |
| Installable web app and offline editing | Install from a supported browser. After the first online setup, edit, save local projects and export offline. Drive requires a connection. |

See the [user guide](user-guide.md) for the current interface, the [development handoff](development-handoff.md) for setup, and the [plan archive](superpowers/README.md) for implementation history.

## Open milestones

| Work | Status and next decision |
| --- | --- |
| Validate the Mimaki workflow | Waiting for the internal printer/cutter model, RIP name and version, and shop media/cut settings. Use a small physical proof and a roll/sheet test to verify size, feed, contour alignment, and QR readability. Decide on a shop profile once the RIP requirements are known. Roland can follow with its own validation. |
| Managed QR destinations | QR Mystic pilot on a separate branch, deployed to Cloudflare staging. Invited staff can manage links, label placements, and view daily redirect activity. Cloudflare shows Worker and D1 usage. Choose the durable scan host before printing a real job. See the [pilot guide](managed-links-pilot.md). |
| QR Mystic rebrand | The pilot saves new files as `.qrmystic.json` and opens existing `.qrmagic.json` files locally and from Drive. The live GitHub Pages release and OAuth branding continue to use QR Magic until their rollout is approved. |
| Wider Drive access | The named-account pilot is the current choice. Revisit Google production branding, privacy disclosures and any applicable verification if the project owner wants a public rollout. A synced project library, team editing and other providers are separate proposals. |

Additional ideas include a per-item data manifest for reconciliation, portable sample jobs, and testing large jobs on modest devices. Capture a concrete print or design workflow before promoting one to a milestone. Keep this page updated when work ships or a priority changes.
