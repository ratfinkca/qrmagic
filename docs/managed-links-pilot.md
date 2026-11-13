# Managed QR links pilot

Managed links give a printed QR code a stable address. The invited team can change the destination or pause the link after printing. Anyone with the QR can scan it without signing in. The dashboard is where staff manage links, even if they no longer have the original QR Magic project.

## Run the pilot locally

From `managed-links/`, with Node.js 24 and pnpm, run the install, migration, and dev commands.

```sh
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev
```

Open the [local dashboard](http://127.0.0.1:8787/manage). Wrangler uses a local D1 database and simulates an invited identity. Run `pnpm test` and `pnpm build` from the same directory to check the pilot. The build is a Wrangler dry run. The separate [editor setup](development-handoff.md#resume-on-another-machine) runs QR Magic for the copy-and-paste workflow. [Wrangler local Access identities](https://developers.cloudflare.com/workers/configuration/cloudflare-access/#test-ctxaccess-locally)

## Try the workflow

1. Open the dashboard and create a link with a name and an `https://` destination.
2. Select **Copy QR URL**. In QR Magic, select a fixed QR and paste the copied address into **Website or text**. Save or export the project as usual.
3. Open the copied URL or scan the exported QR. Edit the destination in the dashboard and try the same address again. Then pause and resume it to see the difference.

Sharing or duplicating a project shares its public URL. Staff manage the destination in the dashboard. An updated destination affects every existing print and project copy with that URL. Create a new managed link for a separate campaign. A code that already contains a direct destination can be changed only at the address printed on it.

Keep QR Magic and the dashboard open separately. The editor can save and export a project containing a managed URL while offline. Scanning a managed link, signing in, and changing a destination require an internet connection outside the local demo. Local test URLs are for the review machine. Use a staging or production hostname to test on a phone.

## How the hosted pilot works

| Address | Purpose |
| --- | --- |
| `https://go.example.com/<slug>` | Public scan URL. A live link returns a temporary redirect and sends `Cache-Control: no-store`. Paused or unknown links show an unavailable page. |
| `https://manage.example.com/manage` | Dashboard and management API, available to invited staff after Cloudflare Access sign-in. |

Both hostnames can point at one Cloudflare Worker. The Worker reads the current destination from the primary D1 database on each scan so a new scan uses the latest saved destination. The pilot stores link records for one shared team. Set up a backup admin in Access so the team can manage links if the original admin leaves. Use a hostname the organization controls, and keep the same hostname and slugs when changing providers. Export and back up the link data regularly. [Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) · [D1 primary reads](https://developers.cloudflare.com/d1/best-practices/read-replication/) · [D1 exports](https://developers.cloudflare.com/d1/best-practices/import-export-data/)

## Prepare a Cloudflare staging deployment

1. Copy [the hosted config example](../managed-links/wrangler.deploy.example.jsonc) to `managed-links/wrangler.deploy.jsonc`. Choose separate staging scan and dashboard hostnames in an active Cloudflare zone the organization owns. Configure both as Custom Domains on the `qrmagic-links-pilot` Worker. The hosted example turns off `workers.dev` and Worker preview URLs.
2. Sign in to the intended Cloudflare account and create a D1 database named `qrmagic-links-pilot`. Set its name and ID in the hosted config. From `managed-links/`, run `pnpm exec wrangler d1 migrations apply qrmagic-links-pilot --remote --config wrangler.deploy.jsonc` to apply the migration to the pilot database. [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
3. Create a self-hosted Access application for the dashboard hostname before making the Worker available. Use an Allow policy with the **Emails** selector for each invited address. To let staff from different organizations use their current email, add the **One-time PIN** identity provider in Zero Trust and select it for the application. Use a short session duration. Protect the dashboard hostname only so phones can scan the public hostname without an account. [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) · [One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
4. Set `SCAN_ORIGIN` and `MANAGE_ORIGIN` to the exact staging origins and `ACCESS_AUDIENCE` to the dashboard Access application's Audience (AUD) tag. The Worker checks the audience and signed-in identity provided by Cloudflare Access. To point the dashboard's **Open QR Magic** link at a separate editor preview, set `EDITOR_URL` to its full URL. Deploy with `pnpm exec wrangler deploy --config wrangler.deploy.jsonc` when the staging setup is ready. Keep any credentials and tester roster out of Git.
5. In a signed-out browser, confirm the dashboard asks for sign-in and public scans work. Try an uninvited address and confirm it cannot open the dashboard or list links through the management API. Sign in with an invited address, then create, edit, pause and resume a link. Scan the same QR on the intended phone after each change. Test on the intended scan hostname before printing a live batch.

When someone leaves the pilot, remove their email from the Allow policy and revoke their active Access sessions. [Cloudflare Access session management](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/#revoke-user-sessions)

If you do not have a Cloudflare zone yet, you can use the pilot Worker's `workers.dev` hostname for temporary testing. In the hosted config, remove `routes`, set `workers_dev` to `true`, leave `preview_urls` off, and set both origins to the same HTTPS Worker URL. In one self-hosted Access application, add both `/manage` and `/manage/*` on that hostname so the dashboard and its API use the same audience. Leave the scan paths outside that policy. Switch to an organization-controlled scan hostname before printing real jobs. [Cloudflare Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/) · [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

## Publish an editor preview separately

The current pilot works with the released editor. For a hosted test of this version, a staging Worker and D1 database are enough. Publish a separate editor preview when testing changes to the editor itself, such as a managed-link picker.

The pilot uses `codex/managed-links-pilot` in the same repository. QR Magic's live GitHub Pages editor is built from `main`. If the pilot later needs its own hosted editor, use a separate Cloudflare Pages project built from the pilot branch and leave the live Pages deployment on `main`.

Use a separate hostname or browser profile to isolate browser projects and test data. Two paths on the same hostname still share the browser project library. Set an Access policy for every hostname that serves a private editor preview, including its default hostname if enabled. If the preview needs Drive, configure its exact origin using the [Drive runbook](google-drive.md). [Cloudflare Pages previews](https://developers.cloudflare.com/pages/configuration/preview-deployments/) · [Protect the default hostname](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain)
