# QR Magic

QR Magic is a browser-based designer for QR posters, numbered decals and repeated stickers. Create artwork, save an editable project, and prepare actual-size files for a print shop.

[Open QR Magic](https://ratfinkca.github.io/qrmagic/) · [Read the user guide](docs/user-guide.md)

## Start designing

1. Choose **Poster or sign**, **Repeated stickers**, **Numbered decals**, or **Blank canvas**.
2. Set the finished size. Select a QR to enter a website, plain text or serial content in the Inspector.
3. Set the quantity in **Job**, then use **Save project** to download an editable `.qrmagic.json` file.
4. Check one item with a proof package, or arrange the whole job in **Print layout** for roll or sheet output.

Open **Help** in the editor or Print Layout for searchable guides. **Take a quick tour** shows the main controls without changing your design. The small question-mark buttons explain print terms and advanced features with keyboard, pointer or touch input.

Edits save automatically in this browser; wait for **Saved on this device**. Use **Projects** to reopen recent designs or make an independent copy. Download project files as separate backups: local browser storage can be cleared or evicted, and there is no cloud project library or automatic cloud backup. QR links currently encode the destination directly; managed redirects and scan tracking are not implemented.

When Google Drive is configured, use **Open from Google Drive** in Projects or the cloud button in the editor. **Drive Projects** lists projects QR Magic has access to. Use **Browse Drive** to select another project. In **Save to Drive**, edit the filename, then save a copy to My Drive or choose a folder. **Share Drive file** opens Google's sharing dialog for the selected or saved file. You can also open the file in Drive and share it there. Drive actions are manual and local autosave continues separately.

## What it can do

- Physical document dimensions, bleed outside the cut, safe-area guides and saved cut geometry.
- Text, image, shape and styled QR layers with palettes, gradients, shadows, alignment and multi-selection.
- Independent fixed or numbered QR sources, shared serial labels and custom content templates.
- Separate counts for unique serials and copies; a fixed job uses one total quantity.
- Proof packages, PNG/JPG job ZIPs and one-item-per-page image PDFs.
- Production PDF packages with supported vector text, shapes and QR codes, embedded fonts, cut references and preflight notes. Images and unsupported effects use documented raster fallbacks.
- Roll/sheet layouts at actual size with margins, spacing, rotation, panel splitting, PDF artwork, cut-reference SVGs and placement reports. Layout output already includes every requested copy.
- Save/open project files to continue editing or share with a print shop.
- Local autosave and recent projects, with independent duplicates, failed-save retry, and separate copies for conflicting edits in different tabs.
- Advisory print checks for QR density/contrast/clear space, placed image detail, and QR/text safe boundaries. Suggestions appear with every export format and in Print Layout, and production handoff reports include check scope and thresholds. Always verify a physical sample.

Production packages are generic RGB handoffs. Machine-specific cut separations, registration marks, color conversion and PDF/X certification are not yet implemented. Mimaki is the first target for equipment validation; ask your print shop to validate a sample in its own RIP before a production run.

## Run locally

Use Node.js 24 and the pnpm version pinned in `web/package.json`.

```sh
cd web
pnpm install
pnpm dev
```

Open the local URL printed by Vite, with `/qrmagic/` as the path.

```sh
pnpm test
pnpm exec playwright install chromium
pnpm test:export
pnpm build
```

The browser suite exercises help, onboarding, editor interactions and real exported artwork. On Windows, an installed Edge can be used with `$env:PLAYWRIGHT_CHANNEL="msedge"` before `pnpm test:export`.

The in-app articles and repository user guide share one content source: `web/src/lib/helpContent.ts`. After updating the articles, run `pnpm docs:help` from `web/` and include the regenerated guide.

## Deployment

[GitHub Actions](https://github.com/ratfinkca/qrmagic/actions) runs unit tests, Chromium browser tests and the production build on pull requests and pushes to `main`. Pages deploys only after those checks pass on `main`. Pull requests do not deploy. Repository Pages settings must use **GitHub Actions** as the source.

To enable Drive in a local build, copy `web/.env.example` to `web/.env.local` and set its three values from the same Google Cloud project. Enable the **Google Drive API** and **Google Picker API**, configure the OAuth consent screen for the `drive.file` scope, and create a **Web application** OAuth client. Add the exact app origin under Authorized JavaScript origins, such as `http://127.0.0.1:5173` for local review and `https://ratfinkca.github.io` for Pages. Add review accounts as test users if the consent screen is in testing mode. Restrict the browser API key to Google Picker and Drive and allow the app origins and `https://docs.google.com/*` as website referrers. Restart Vite after changing the local configuration. For Pages, add the three values as repository variables under **Settings → Secrets and variables → Actions → Variables**, then rerun the Pages workflow. Vite includes these browser settings in the built app. Keep OAuth client secrets out of the frontend. [Google Picker setup](https://developers.google.com/workspace/drive/picker/guides/web-picker-sample)

## Development notes

See [the project model](docs/project-model.md), [engineering guardrails](docs/engineering-guardrails.md) and [the next-edition plan](docs/next-edition-plan.md) for technical background. Some planning documents describe earlier phases; the user guide describes the current interface.

The original Python/Tkinter files remain in the repository as a legacy reference. Active product development targets the web app.

## Contributing and license

Issues and pull requests are welcome. QR Magic uses the [MIT license](LICENSE).
