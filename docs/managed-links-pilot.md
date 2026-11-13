# Managed QR links pilot

Managed links give a printed QR code a stable address. The invited team can change the destination or pause the link after printing. Anyone with the QR can scan it without signing in. The dashboard is where staff manage links, even if they no longer have the original QR Mystic project.

## Run the pilot locally

From `managed-links/`, with Node.js 24 and pnpm, run the install, migration, and dev commands.

```sh
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev
```

Open the [local dashboard](http://127.0.0.1:8787/manage). Wrangler uses a local D1 database and simulates an invited identity. Run `pnpm test` and `pnpm build` from the same directory to check the pilot. The build is a Wrangler dry run. The separate [editor setup](development-handoff.md#resume-on-another-machine) runs QR Mystic for the copy-and-paste workflow. [Wrangler local Access identities](https://developers.cloudflare.com/workers/configuration/cloudflare-access/#test-ctxaccess-locally)

## Try the workflow

1. Open the dashboard and create a link with a name and an `https://` destination.
2. Select **Copy QR URL**. In QR Mystic, select a fixed QR and paste the copied address into **Website or text**. Save or export the project as usual.
3. Open the copied URL or scan the exported QR. Edit the destination in the dashboard and try the same address again. Then pause and resume it to see the difference.

Sharing or duplicating a project shares its public URL. Staff manage the destination in the dashboard. An updated destination affects every existing print and project copy with that URL. Create a new managed link for a separate campaign. A code that already contains a direct destination can be changed only at the address printed on it.

Use **Placement** to distinguish links such as Front gate and Merch tent, even when they share the same destination. Each link shows its total redirects, latest recorded redirect, and counts for the last 30 calendar days in UTC. Counting starts when this feature is deployed. A redirect from **Test link**, a repeat visit, a bot, or a link preview can count. Paused or unknown links and `HEAD` requests are excluded. Counts measure redirects served. They cannot tell whether the destination loaded or how many people scanned the code.

Keep the editor and dashboard open separately. The editor can save and export a project containing a managed URL while offline. Scanning a managed link, signing in, and changing a destination require an internet connection outside the local demo. Local test URLs are for the review machine. Use a staging or production hostname to test on a phone.

## How the hosted pilot works

| Address | Purpose |
| --- | --- |
| `https://go-pilot.qrmystic.com/<slug>` | Public scan URL for the pilot. A live link returns a temporary redirect and sends `Cache-Control: no-store`. Paused or unknown links show an unavailable page. |
| [Pilot dashboard](https://manage-pilot.qrmystic.com/manage) | Dashboard and management API, available to invited staff using an emailed Cloudflare Access PIN. |

Both pilot hostnames can point at one Cloudflare Worker. The Worker reads the current destination from the primary D1 database on each scan so a new scan uses the latest saved destination. The pilot stores link records for one shared team. Set up a backup admin in Access so the team can manage links if the original admin leaves. Reserve `go.qrmystic.com` for durable production scans after the pilot. Use pilot URLs for testing only. Keep the production hostname and slugs stable when changing providers, and export and back up the link data regularly. [Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) · [D1 primary reads](https://developers.cloudflare.com/d1/best-practices/read-replication/) · [D1 exports](https://developers.cloudflare.com/d1/best-practices/import-export-data/)

## Maintain the Cloudflare staging deployment

The `qrmystic-links-pilot` Worker and D1 database are deployed. Apply all pending D1 migrations before publishing a Worker build that uses their tables. Cloudflare Access protects only the management hostname. The Worker’s `workers.dev` route and preview URLs are disabled. Keep the approved invite list in Cloudflare Access. The setup below also works to recreate the pilot in a new account.

1. Copy [the hosted config example](../managed-links/wrangler.deploy.example.jsonc) to `managed-links/wrangler.deploy.jsonc`. Use the `qrmystic.com` zone and configure `go-pilot.qrmystic.com` and `manage-pilot.qrmystic.com` as Custom Domains on the `qrmystic-links-pilot` Worker. The hosted example turns off `workers.dev` and Worker preview URLs.
2. Sign in to the intended Cloudflare account and create a separate D1 database named `qrmystic-links-pilot`. Leave the previous empty `qrmagic-links-pilot` database in place. Set the new database name and ID in the hosted config. From `managed-links/`, run `pnpm exec wrangler d1 migrations apply qrmystic-links-pilot --remote --config wrangler.deploy.jsonc`. [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
3. Create a self-hosted Access application for the dashboard hostname before making the Worker available. Use an Allow policy with the **Emails** selector for each invited address. To let staff from different organizations use their current email, add the **One-time PIN** identity provider in Zero Trust and select it for the application. Use a short session duration. Protect the dashboard hostname only so phones can scan the public hostname without an account. [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) · [One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
4. Set `SCAN_ORIGIN` to `https://go-pilot.qrmystic.com`, `MANAGE_ORIGIN` to `https://manage-pilot.qrmystic.com`, and `ACCESS_AUDIENCE` to the dashboard Access application's Audience (AUD) tag. The Worker checks the audience and signed-in identity provided by Cloudflare Access. To point the dashboard's **Open QR editor** link at a separate editor preview, set `EDITOR_URL` to its full URL. Deploy with `pnpm exec wrangler deploy --config wrangler.deploy.jsonc` when the staging setup is ready. Keep any credentials and tester roster out of Git.
5. In a signed-out browser, confirm the dashboard asks for sign-in and public scans work. Try an uninvited address and confirm it cannot open the dashboard or list links through the management API. Sign in with an invited address, then create, edit, pause and resume a link. Scan the same QR on the intended phone after each change. Test on the intended scan hostname before printing a live batch.

When someone leaves the pilot, remove their email from the Allow policy and revoke their active Access sessions. [Cloudflare Access session management](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/#revoke-user-sessions)

## Monitor the pilot in Cloudflare

Open **Workers & Pages**, select `qrmystic-links-pilot`, and open **Metrics** to see requests, invocation errors and CPU time across both hosts. Use **Observability** to look for `Managed QR redirect count failed`, `Managed QR scan request failed`, or `Managed QR dashboard request failed`. A handled error can appear in Logs even if the Worker invocation completed. The app logs fixed messages for these failures. Routine invocation logs and traces are disabled. [Workers metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/) · [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)

In **Storage & databases → D1 SQLite Database**, select `qrmystic-links-pilot` to see rows read and written. Each tracked redirect attempts one background update to that link’s UTC daily aggregate. QR Mystic stores counts and the last redirect time, with no per-visitor record. A failed background write can leave a count low while the redirect still succeeds. D1 quota exhaustion can also affect database reads, so check usage if the scan host starts returning errors. [D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/) · [D1 pricing and limits](https://developers.cloudflare.com/d1/platform/pricing/)

If you do not have a Cloudflare zone yet, you can use the pilot Worker's `workers.dev` hostname for temporary testing. In the hosted config, remove `routes`, set `workers_dev` to `true`, leave `preview_urls` off, and set both origins to the same HTTPS Worker URL. In one self-hosted Access application, add both `/manage` and `/manage/*` on that hostname so the dashboard and its API use the same audience. Leave the scan paths outside that policy. Switch to an organization-controlled scan hostname before printing real jobs. [Cloudflare Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/) · [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

## Release the pilot from GitHub Actions

Pushes to `codex/managed-links-pilot` run [the pilot workflow](../.github/workflows/deploy-cloudflare-pilot.yml). It runs the editor unit, export and offline tests, plus the managed-link tests and build. A second job builds and checks the pilot editor using its deployed Drive configuration. Once the checks pass, it uploads versions of both Workers and publishes them to the existing pilot hostnames. After publication, Actions checks the deployed service worker, exercises the hosted editor offline, and checks that the scan host can read D1 and the dashboard still requires Cloudflare Access.

Apply new D1 migrations to `qrmystic-links-pilot` using the staging command above before pushing Worker code that depends on them. Keep migrations compatible with the running Worker while a deploy is in progress. The release credential is scoped to the two pilot Workers.

To set up or restore GitHub deployment, allow only `codex/managed-links-pilot` under **Settings → Environments → cloudflare-pilot → Deployment branches and tags**. Configure the following in that environment.

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` (secret) | Cloudflare account API token with **Individual Workers → Editor**, scoped to `qrmystic-editor-pilot` and `qrmystic-links-pilot`. Rotate it in Cloudflare and replace the GitHub environment secret when needed. |
| `CLOUDFLARE_ACCOUNT_ID` | The pilot Cloudflare account ID. |
| `PILOT_D1_DATABASE_ID` | The UUID of `qrmystic-links-pilot`. |
| `PILOT_ACCESS_AUDIENCE` | The Audience (AUD) tag of the pilot dashboard’s Access application. |
| `PILOT_GOOGLE_DRIVE_CLIENT_ID`, `PILOT_GOOGLE_DRIVE_PROJECT_NUMBER`, `PILOT_GOOGLE_DRIVE_API_KEY` | Public browser configuration for the Google Cloud project authorized for `https://editor-pilot.qrmystic.com`. See the [Drive runbook](google-drive.md). |

Keep the token in the branch-restricted environment. The workflow uses Worker versions on existing Custom Domains. Manage changes to domains, routes and Access policies separately in Cloudflare. The live QR Magic deployment continues to use the independent GitHub Pages workflow on `main`. [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) · [Cloudflare Workers roles](https://developers.cloudflare.com/workers/authorization/workers/) · [Cloudflare version deployment](https://developers.cloudflare.com/workers/versions-and-deployments/)

## Publish an editor preview separately

The paste workflow works with the released editor. For a hosted test of link management, a staging Worker and D1 database are enough. Publish a separate editor preview when testing editor changes, such as the QR Mystic rebrand or a future managed-link picker.

The pilot uses `codex/managed-links-pilot` in the same repository. The live QR Magic GitHub Pages editor is built from `main`. The [hosted QR Mystic editor pilot](https://editor-pilot.qrmystic.com/) uses the separate `qrmystic-editor-pilot` Worker with Static Assets. The GitHub Pages workflow and `/qrmagic/` build are unchanged. The editor has no D1 binding and does not use Cloudflare Access. [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)

From `web/`, run `pnpm build:pilot` to build `dist-pilot/` for the root of the pilot hostname. Use [wrangler.pilot.jsonc](../web/wrangler.pilot.jsonc) with the repository's Wrangler (from `managed-links/`, `pnpm exec wrangler deploy --config ../web/wrangler.pilot.jsonc`). Check the selected Cloudflare account before deploying. For a local preview use `pnpm preview --mode pilot`. To test the built pilot offline locally, set `QRMYSTIC_TEST_PILOT=1` and run `pnpm test:offline`; set `QRMYSTIC_PILOT_URL=https://editor-pilot.qrmystic.com/` instead to run the same workflow against the hosted editor.

Deploy the entire pilot editor build, including `sw.js` and its matching release files. Check that the site serves `/`, `/index.html` and `/sw.js`, then test opening an older `.qrmagic.json` file, reopening and exporting offline, and opening an older project through real Google Drive. The pilot has a separate browser project library; move projects by file or Drive. Configure the exact pilot origin using the [Drive runbook](google-drive.md). The managed-links Worker's `EDITOR_URL` now points to the tested pilot.
