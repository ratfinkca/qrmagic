# Installable web app and offline editing

**Goal:** QR Magic opens as a standalone web app and can edit, save and export local projects after one online visit. Drive requires an internet connection.

**Design:** Keep the existing web editor and IndexedDB. Add a standalone manifest, reuse the QR Magic icon, and generate a service worker from the production output. Precache the entire release so the first PDF or layout export works even after a cold offline launch. Keep each release together until its open windows and tabs close.

1. Verify a production browser test fails before installability and offline support exist.
2. Generate a versioned cache from the built HTML, lazy chunks, fonts and other static files. Scope it to `/qrmagic/` and leave unrelated requests alone. Keep the service worker out of Vite development mode.
3. Show when offline setup is complete. Offer the browser’s install action when available, document browser menu alternatives, and explain the offline limitation in Drive.
4. Verify Chromium installability, offline cold start, local file and recovery flows, all export formats and the release update lifecycle. Add the production browser test to the Pages gate and update user help and the handoff.
5. Run the tests and build. Leave a local production preview running for review.

**Verified locally:** Edge reported no installability errors. The production browser tests stopped the server, reopened the app offline, edited and reopened a project, and exported every format. They decoded the edited QR from its PNG, checked that offline Drive makes no Google requests, and exercised update waiting and recovery from a mismatched deployment. The unit suite, browser export suite and production build also passed. Review the production preview at `http://127.0.0.1:5173/qrmagic/`.
