# QR Magic project model

A `.qrmagic.json` project is the editable design, including artwork, data and print settings. The same file format is used for local downloads and Google Drive copies. For the precise TypeScript fields, see [types.ts](../web/src/types.ts). For physical sizing, cut geometry and package contents, see the [production reference](production-documents.md).

## File format and compatibility

New files use an envelope with `format: "qrmagic.project"`, an ISO `savedAt` timestamp, and a `project` object at version 2. The importer accepts both that envelope and legacy bare project objects, then [normalizes them](../web/src/lib/project.ts) and [checks the structure needed by the editor](../web/src/lib/projectValidation.ts).

| Field in `project` | What it stores |
| --- | --- |
| `version` | Project schema version. Current saves use 2. |
| `document` | Name, finished width and height in `px`, `in` or `mm`, DPI, background color and opacity, bleed and safe inset in mm, guide visibility, and cut geometry. |
| `production` | `copiesPerRecord` and optional roll/sheet settings in `layout`. Layout positions are calculated from settings and the job quantity. |
| `layers` | Back-to-front stack of image, QR, text and shape layers. Geometry uses document pixels relative to the trim origin. Each layer has its own visibility, lock state, opacity, rotation and shadow settings. Artwork shape layers have their own geometry, fill and stroke. |
| `data` | Shared fixed and serial content groups and optional imported `csv` data. |
| `colors` | Recently used colors and saved palette swatches. |
| `export` | Filename template, format selection, render mode and guide preference. The editor and production references define which formats are available. |

Image layers store their source in `src`, and QR logos in `logoSrc`. Artwork imported through the editor is embedded as data URLs. Browser IndexedDB IDs, revisions, Drive file identity and OAuth tokens stay outside the portable file. Downloading or saving a Drive copy preserves the current design snapshot. Opening a file creates a local editing session.

Version 1 projects migrate to version 2 with the same finished dimensions and artwork positions. Legacy inward bleed guides become zero external bleed, and the safe inset converts to millimetres. Fixed-only jobs without indexed variations can normalize to one record with the original total quantity as copies. Keep these behaviors covered by project and export regression tests when changing the model.

## Records, copies and CSV

- Fixed groups supply the same content on every record. For a repeated design, the editor exposes one total quantity. Numbered jobs use serial settings for each source. With multiple serial groups and no CSV, the largest serial group sets the record count. A shorter serial group yields an empty value past its own range.
- The `{{serial}}` template token reads the selected content group, or the primary value when no group is specified. `{{index}}` is the one-based record index. Copies repeat the resolved record and appear consecutively in batch exports.
- With CSV, each row is one record. `data.csv` stores the source name, headers, rows and the optional setting for intentional QR repeats. Each mapped QR/text layer stores its column name in `csvColumn`. Mapped values replace the template output for that layer. Unmapped layers use their original sources, and numbered sources advance once per row.
- Missing mapped QR content on a visible layer blocks batch export. Missing mapped text renders blank, and repeated mapped QR values are flagged per layer unless marked intentional. The CSV importer accepts up to 5 MiB, 100 columns, 100,000 rows and 1,000,000 cells. The finished job limit includes copies.
- CSV rows and QR values travel with the project. Production reports can also contain serials and other job data. Use sample data in examples and share real project files only with the intended recipients.

The main entry points are [serial.ts](../web/src/lib/serial.ts) for record resolution, [csvBatch.ts](../web/src/lib/csvBatch.ts) for import and mapping, and [production.ts](../web/src/lib/production.ts) for dimensions and quantities.
