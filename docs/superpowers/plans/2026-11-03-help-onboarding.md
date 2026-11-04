# Friendly help and onboarding

The user explicitly requested in-app help, tooltips and a getting-started walkthrough, with local review before push. Implement in the existing web app and style; no new dependency or account service. The preceding design-to-print workflow is the source of truth.

## Scope and design choices

- Persistent Help entry in editor and Print Layout; a Help & getting started entry in the project chooser.
- Searchable native modal with short guides for starting, QR content, quantities, artwork, print setup, exporting/layout, saving/sharing, and scan troubleshooting. One structured content source also generates the repository user guide.
- Optional six-step walkthrough highlights finished size, QR content, quantities, layers, saving and exporting. It uses the current design, reveals existing controls, restores editor selection/panel state when it ends, never creates/replaces/mutates artwork, and always permits Back, Skip and Escape. A blank canvas points to Add layer instead of adding a QR automatically. Returning users can restart it. Only completion preference is stored locally; storage failure must not block the app.
- Short keyboard/hover/touch explanations use accessible native popovers and stable field names. Cover finished size, bleed, safe inset, DPI, quantities, QR modes/shared sources, export choices and layout spacing/orientation.
- Help accurately distinguishes single-item exports, proofs and imposed layout packages. Existing QR destinations are direct; no claims of managed links, scan analytics, cloud saves, autosave or installable/offline support.
- Narrow/laptop layouts, focus containment/restoration, Escape, native form submission and export locks remain usable. No forced first-run tour or new modal before every project.

## Implementation

1. Add help content, search and safe tour-completion storage helpers; failing unit tests for search, missing results and denied storage. Add a small user-guide generator from the shared source.
2. Add HelpCenter, HelpTip, Walkthrough and scoped help CSS. Integrate chooser, toolbar, Sidebar, QR inspector and Print Layout. Keep all content on-device and help state outside project JSON/history.
3. Add failing browser regressions for chooser/editor/layout entry, search/empty results, keyboard/hover/touch tips, complete/skip/restart walkthrough, blank-canvas guidance, unchanged saved project, focus restoration, responsive display and modal shortcut isolation.
4. Run unit tests, all browser regressions and build. Independently review, resolve material findings and verify in the local browser. Leave changes uncommitted/unpushed and the dev server running for review.

## Progress

Base: main `860429d`, clean checkout; released baseline 41 unit tests, 39 browser tests, build/Pages passed. User authorization covers implementation and local verification. Use a feature branch in this checkout to preserve the review URL.

Completed on `codex/help-onboarding`, left uncommitted and unpushed for local review.

- Added nine searchable in-app articles, context tips, and an optional six-step tour. The same article source generates `docs/user-guide.md`; README now describes the web app and links the guide.
- Native dialogs contain focus and isolate editor undo shortcuts. Tour finish/skip restores selection and panel visibility without changing saved project content; completion is a local preference only.
- Browser tests cover chooser/editor/layout entry, search and missing results, focus restoration, keyboard/hover/click tips, outside dismissal, finish/restart/Back/Skip/Escape, pre-existing edits, blank canvases, hidden panels, and all six highlighted targets at desktop and 390 px width.
- Visual review caught a late-mounted QR target; MutationObserver discovery and ResizeObserver measurements now keep the spotlight aligned. Independent read-only review found no other blocking issues; the Help toolbar width was also corrected.
- Final verification: 45 unit tests and all 42 Chromium browser tests passed; TypeScript and Vite production build passed. The existing large-chunk warning remains. Local visual checks passed at desktop and 390 × 844, with no browser warning/error logs. No actual touch-device or screen-reader session was performed.
- Vite remains running at `http://127.0.0.1:5173/qrmagic/`; a separate review tab is left open on Help. Screenshots are stored outside the repository in the session visualization directory.
