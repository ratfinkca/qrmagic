# Local autosave, recovery and recent projects

The user approved the proposed next release: autosave, recovery and a friendly Recent Projects screen. Build in the existing React web app and leave locally reviewable; do not commit/push this phase until reviewed.

## Design

Use native IndexedDB, with separate lightweight metadata and full project stores written atomically. This fits embedded artwork better than synchronous localStorage. No new dependencies, backend, cloud accounts or desktop work. Explicit project downloads remain portable backups. Local storage is per browser/site and can be cleared or evicted; communicate that in the chooser/help, without claiming permanent backups.

Autosave after a short idle debounce and flush before switching projects or when the page becomes hidden. Show pending/saving/saved/error states, and warn on leaving while a write is still pending or failed. Never claim saved before transaction completion. Do not rely on unload for durable async writes. On startup, show Recent projects when present; do not automatically replace the initial canvas. New project and Projects toolbar actions select the appropriate chooser tab. Keep existing accessible chooser/help names stable.

Local identity/revision belongs outside portable project JSON. Opening retains local identity; downloading does not create another project; importing a file creates a new local entry. Duplicate makes an independent project. Revisions prevent stale tabs from overwriting each other; save a separate local copy on a conflict and explain it. Never evict older projects automatically. Storage/open/quota/corrupt-record failures leave the editor usable and file download available.

## Implementation plan

1. Write failing session/repository-contract unit tests for ordered saves, revisions, independent copies, concurrent tabs, denied storage and retry. Implement an IndexedDB repository and a serialized autosave session, with committed-write notifications.
2. Add a React autosave hook: debounce, flush, status, loading, recent summaries, read/duplicate/activate helpers. Integrate explicit document switches, downloaded saves, visibility flush and pending-change unload guard. Test project-content preservation in the real browser.
3. Add Recent Projects chooser tab with metadata, date/size, search, Open/Duplicate actions, loading/empty/error states and local-storage explanation. Keep New Project templates and file-open flow. Add save status in editor and Print Layout.
4. Update shared help and generated guide/README. Add browser regressions for refresh/reopen, assets and layout persistence, renaming/duplicates, rapid switching, save errors/retry, concurrent tabs, and keyboard/narrow-screen chooser use. Isolate browser tests' local libraries so existing fixture assumptions remain deterministic.
5. Run all unit/browser tests and production build; independent read-only review and rendered desktop/narrow checks. Leave Vite running at the current local URL.

## Review focus

- A late write from the previous project must not overwrite a newly opened project.
- Browser transaction abort/quota errors must never display Saved or discard the last committed snapshot.
- Conflicting edits in two tabs must preserve both versions.
- Large embedded artwork must survive a reopen without being loaded into the recent-list metadata.
- Downloading/reopening/touring must not pollute portable JSON with local identity or mutate artwork.

Base: main `01b6690`; 45 unit tests and 42 browser tests pass. Implementation choices above are defaults made within the user's approved scope.

## Completed and verified

- Added native IndexedDB storage with separate lightweight recent metadata and full snapshots, atomic transactions, revision checks, serialized writes and independent local identities. Local IDs never enter downloaded project JSON. Conflicting tabs fork and mark a separate tab copy.
- Added debounced autosave, visibility flush, pending/failed-save unload protection, status/retry/download-backup actions, and flushed document switches. Initial-canvas undo stays engaged with autosave; undo to an already committed snapshot clears stale errors.
- Added searchable Recent Projects with size/date, Open and Duplicate; retained templates and file-open/download flows. Editor toolbar adapts at laptop widths; Print Layout shares local-save status. Required render structure is validated before activating local or imported projects.
- Updated in-app saving/recovery documentation, regenerated user guide and README. The generated guide matches the shared article source.
- Independent read-only review found the two undo cases and malformed-record activation issue; fixed all three with unit/browser regression coverage.
- Verification: all 55 unit tests and 48 Chromium browser/export tests passed. The browser suite now explicitly selects New Project when the startup chooser defaults to Recent, and waits for the separate Konva canvas commit after async file opening; pixel comparison tolerances are unchanged.
- TypeScript and Vite build passed; existing large-chunk warning remains. Rendered review passed at 1280 × 720 and 390 × 844. Fresh-load console checks are clean; hook-edit hot-reload warnings during development disappeared on fresh load. No Safari/Firefox, physical touch device or actual screen-reader session was performed.
- Vite stays running at `http://127.0.0.1:5173/qrmagic/` with Recent Projects open in a separate review tab. Two clearly named sample sticker projects demonstrate Open/Duplicate. Screenshots live outside the repository. Work remains uncommitted and unpushed on `codex/local-project-recovery` for review.
