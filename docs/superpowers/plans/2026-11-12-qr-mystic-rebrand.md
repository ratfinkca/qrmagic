# QR Mystic pilot rebrand implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Review locally before publishing.

**Goal:** Give the pilot the QR Mystic name while keeping existing QR Magic projects usable.

**Architecture:** Update the names people see and the names of new pilot resources. Keep serialized project and print identifiers, browser storage, app scope, and the current repository and live site stable. Stage the Worker locally; the hosted setup is a later step.

**Tech stack:** React, Vite, Playwright, Cloudflare Workers and local D1.

**Scope:** Rebrand in place on `codex/managed-links-pilot` for local review. A visible-only rename would leave confusing pilot resource names; a full internal rename would risk existing files, autosaves and offline installs. Move the public editor and change OAuth branding separately. Do not push or change Cloudflare during this pass.

- [x] **Project portability.** Save new projects as `.qrmystic.json`. Accept `.qrmagic.json` and `.qrmystic.json` in the editor and Drive listing, preserve `qrmagic.project` in the file, and prevent a double suffix when saving. Exercise a legacy file and a Drive project, and verify the new save name.
- [x] **Brand surfaces.** Update the editor, project chooser, help, install manifest and print output labels. Preserve the existing manifest identity, Vite base, browser storage keys and machine-readable export identifiers. Test the production app opens, saves and exports offline.
- [x] **Managed links.** Update the local dashboard and the hosted example. Name the future hosted Worker and D1 database `qrmystic-links-pilot`; use `go-pilot.qrmystic.com` for public test scans and `manage-pilot.qrmystic.com` for private management. Keep the `links` schema and leave the empty old hosted database alone.
- [x] **Handoff.** Refresh help and the living docs, run the editor unit, browser export, production build and offline suites plus the managed-links tests and dry-run build. Leave the editor and dashboard running locally.

Local review: 76 web unit tests, 55 browser/export tests, two offline browser tests, and three Worker tests passed. The web production build and Worker dry run passed. Drive browser tests use simulated Google responses; the real Google OAuth branding and hosted Cloudflare setup are unchanged.
