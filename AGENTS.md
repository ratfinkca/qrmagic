# Working on QR Mystic

- Start with the [development handoff](docs/development-handoff.md) for setup, current state and open work. Read the [engineering guardrails](docs/engineering-guardrails.md) before changing project files, rendering, production exports or storage.
- Develop the web app under `web/`. The root Python/Tkinter app and its packaged builds are legacy.
- Use QR Mystic in pilot user-facing copy. Preserve the file format identifier `qrmagic.project`, the legacy `.qrmagic.json` import path, and existing browser storage identifiers for compatibility.
- Run commands from `web/` using Node.js 24 and the pnpm version in [package.json](web/package.json). Use `pnpm test`, `pnpm test:export` (after installing the Playwright browser), `pnpm build`, and `pnpm test:offline` against that build. The handoff has the exact setup and commands.
- Keep user help in [helpContent.ts](web/src/lib/helpContent.ts). Run `pnpm docs:help` when it changes and include the regenerated [user guide](docs/user-guide.md).
- Update affected docs in the same change as the code. Check setup and release steps, visible UI and help, file and export contracts, and milestone status. Before handing off, review the [development handoff](docs/development-handoff.md) and update it when setup, operating state, known blockers or the next starting point changes. Update the [roadmap](docs/next-edition-plan.md) when a milestone ships or priorities change. Keep dated plans in [docs/superpowers](docs/superpowers/README.md) as historical records.
- Keep environment files, tokens, tester rosters and real project/CSV data out of Git. Use synthetic data in fixtures and docs. See the [Drive runbook](docs/google-drive.md) for configuration.
