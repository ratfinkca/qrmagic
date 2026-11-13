# QR Magic development handoff

QR Magic is a browser app for one-off QR artwork and print batches. The editor, QR generation and export run in the browser. Google Drive is an optional way to move and share editable project files. Active development is in `web/`, using React, TypeScript, Vite and Konva.

## Resume on another machine

Install Git, Node.js 24 and pnpm `11.0.7` (the version in [web/package.json](../web/package.json)). If you need to install the pinned pnpm, run `npm install --global pnpm@11.0.7` after installing Node.

```sh
git clone https://github.com/ratfinkca/qrmagic.git
cd qrmagic/web
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 5173 --strictPort
```

Open [the local editor](http://127.0.0.1:5173/qrmagic/). Vite serves the app under `/qrmagic/`. If port 5173 is busy, stop the other process or choose a free port. A different host or port needs its own authorized origin for Drive.

If you’re transferring work in progress, push its branch from the old machine and check out that branch on the new one. A clone only includes work available on the remote.

To move designs, download the editable `.qrmagic.json` files or save copies to Google Drive on the old machine, then open those files on the new one. Recent Projects and autosave are in IndexedDB for the current browser profile and origin. Changing from `127.0.0.1` to `localhost` also changes that storage scope. To test real Drive locally, follow [Google Drive setup](google-drive.md). A fresh clone can run the editor and automated tests without Drive configuration.

## Run the checks

From `web/`:

```sh
pnpm test
pnpm exec playwright install chromium
pnpm test:export
pnpm build
```

On Linux, use `pnpm exec playwright install --with-deps chromium` if browser system libraries are missing. On Windows PowerShell, an installed Microsoft Edge can substitute for downloaded Chromium. Set `$env:PLAYWRIGHT_CHANNEL = "msedge"` before `pnpm test:export`.

Vitest covers project migration, quantities, CSV, storage, print and export models, and Drive helpers. The browser suite starts its own Vite server and checks the editor, rendered output and PDFs. It uses simulated Google responses for Drive; use the [manual Drive smoke test](google-drive.md#smoke-test-local-or-live) for real sign-in and sharing. `pnpm build` type-checks and writes `web/dist/`.

## Current release and open work

The deployed web app includes production exports and print layouts, help and onboarding, local recovery, print checks, CSV-driven batches, and manual Drive open, save and sharing. The Drive integration and Pages build configuration landed in `b5d8237` and `66f5200`. Drive on the live site is an External / Testing pilot, with testers managed in Google Cloud. The latest implementation status and possible next work are in the [roadmap](next-edition-plan.md).

Mimaki is the first equipment target. The internal printer/cutter model, RIP version and shop settings are still pending. Existing packages can be used for test imports and physical proofs. The [production reference](production-documents.md) describes what the package contains and what the shop still configures.

## Find your way around

| If you’re working on… | Start here |
| --- | --- |
| Editor state, project switching and commands | [App.tsx](../web/src/App.tsx) and [components](../web/src/components) |
| Saved projects, migration, CSV and numbering | [Project model](project-model.md), [project.ts](../web/src/lib/project.ts), [csvBatch.ts](../web/src/lib/csvBatch.ts), and [serial.ts](../web/src/lib/serial.ts) |
| Browser autosave and recovery | [useLocalProjects.ts](../web/src/hooks/useLocalProjects.ts) and [localProjects.ts](../web/src/lib/localProjects.ts) |
| Render parity, print checks and exports | [Production reference](production-documents.md), [EditorCanvas.tsx](../web/src/components/EditorCanvas.tsx), [exportRenderer.ts](../web/src/lib/exportRenderer.ts), [productionPdf.ts](../web/src/lib/productionPdf.ts), and [printLayoutExport.ts](../web/src/lib/printLayoutExport.ts) |
| Help, tips and tour | [helpContent.ts](../web/src/lib/helpContent.ts). Run `pnpm docs:help` in `web/` to regenerate the [user guide](user-guide.md). |
| Drive setup, account access and sharing | [Drive runbook](google-drive.md) and [googleDrive.ts](../web/src/lib/googleDrive.ts) |

## Release the web app

[GitHub Actions](https://github.com/ratfinkca/qrmagic/actions) runs the unit suite, Chromium browser/export suite and production build on pull requests and pushes to `main`. The [Pages workflow](../.github/workflows/deploy-pages.yml) also supports manual runs. The Pages source in repository settings is **GitHub Actions**. The deploy job runs only from `main` after verification and artifact upload.

For a release, check the workflow for the intended commit and verify both the build and deployment jobs. Then open the [live site](https://ratfinkca.github.io/qrmagic/) and smoke-test the changed path. For Drive build configuration or OAuth changes, use the [Drive runbook](google-drive.md).

## Keep this handoff current

Read this file at the start of a new development session. Update affected docs in the same change as the code, while the details are fresh. Review this handoff before wrapping up and update it when setup, release configuration, blockers or the next starting point changes. Put feature status and priorities in the [roadmap](next-edition-plan.md), usage in the [shared help source](../web/src/lib/helpContent.ts) and [generated user guide](user-guide.md), and durable design details in the relevant technical reference. Keep historical implementation plans under [docs/superpowers](superpowers/README.md).
