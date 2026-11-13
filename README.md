# QR Magic

QR Magic is a browser-based designer for QR posters, numbered decals and repeated stickers. Create artwork, save an editable project, and prepare actual-size files for a print shop.

[Open QR Magic](https://ratfinkca.github.io/qrmagic/) · [Read the user guide](docs/user-guide.md) · [Set up development](docs/development-handoff.md)

## Start designing

1. Choose **Poster or sign**, **Repeated stickers**, **Numbered decals**, or **Blank canvas**.
2. Set the finished size. Select a QR to enter a website, plain text or serial content in the Inspector.
3. Set the quantity in **Job**, or choose **Set up CSV batch** to fill QR and text layers from a spreadsheet. Use **Save project** to download an editable `.qrmagic.json` file.
4. Check one item with a proof package, or arrange the whole job in **Print layout** for roll or sheet output.

Open **Help** in the editor or Print Layout for searchable guides. **Take a quick tour** shows the main controls without changing your design. The small question-mark buttons explain print terms and advanced features with keyboard, pointer or touch input.

Edits save automatically in this browser. Wait for **Saved on this device**, then use **Projects** to reopen recent designs or make an independent copy. Keep a portable project file for backup or to move to another device. Printed QR links encode the destination you entered, so editing the project later leaves already printed codes pointing to the original address.

Google Drive is available to approved testers. Use the editor’s cloud button to open a project or save a named copy to a Drive folder. **Share Drive file** opens Google’s sharing dialog. Local autosave continues separately. See the [saving and sharing guide](docs/user-guide.md#save-open--share-projects).

## What it can do

- Physical document dimensions, bleed outside the cut, safe-area guides and saved cut geometry.
- Text, image, shape and styled QR layers with palettes, gradients, shadows, alignment and multi-selection.
- Independent fixed or numbered QR sources, shared serial labels and custom content templates.
- Separate counts for unique serials and copies; a fixed job uses one total quantity.
- CSV import with per-layer QR and text column mapping, row previews, and missing-value and duplicate checks.
- Proof packages, PNG/JPG job ZIPs and one-item-per-page image PDFs.
- Production PDF packages with supported vector text, shapes and QR codes, embedded fonts, cut references and preflight notes. Images and unsupported effects use documented raster fallbacks.
- Roll/sheet layouts at actual size with margins, spacing, rotation, panel splitting, PDF artwork, cut-reference SVGs and placement reports. Layout output already includes every requested copy.
- Save/open project files to continue editing or share with a print shop.
- Local autosave and recent projects, with independent duplicates, failed-save retry, and separate copies for conflicting edits in different tabs.
- Advisory print checks for QR density/contrast/clear space, placed image detail, and QR/text safe boundaries. Suggestions appear with every export format and in Print Layout, and production handoff reports include check scope and thresholds. Always verify a physical sample.

Production packages are generic RGB handoffs. Machine-specific cut separations, registration marks, color conversion and PDF/X certification are not yet implemented. Mimaki is the first target for equipment validation; ask your print shop to validate a sample in its own RIP before a production run.

## Develop and deploy

Use Node.js 24 and the pnpm version pinned in `web/package.json`. From the repo root:

```sh
cd web
pnpm install --frozen-lockfile
pnpm dev
```

Open the Vite URL with `/qrmagic/` as the path. The [development handoff](docs/development-handoff.md) covers a fresh checkout, tests, deployment and where to resume. [Google Drive setup](docs/google-drive.md) covers the optional local configuration and the live pilot. [Milestones and roadmap](docs/next-edition-plan.md) lists what shipped and what’s still open.

Active development takes place in [`web/`](web/). The original Python/Tkinter app is a legacy reference. Contributors and coding agents should start with [AGENTS.md](AGENTS.md).

## Contributing and license

Issues and pull requests are welcome. Update the affected docs alongside your changes, and review the [handoff maintenance notes](docs/development-handoff.md#keep-this-handoff-current) before wrapping up. QR Magic uses the [MIT license](LICENSE).
