# Google Drive setup and support

QR Mystic uses Drive to open, save and share editable project files. **Save a copy** creates a separate `.qrmystic.json` file each time. Drive Projects and Browse Drive can open older `.qrmagic.json` files too. Opening a Drive file starts a local editing session, and autosave writes to that browser. Use Save to Drive again to put an updated copy in Drive.

Drive sign-in, browsing, saving and sharing need an internet connection, including in the installed web app. To take a Drive project offline, open it while connected and wait for **Saved on this device**, or download the editable file.

## Live pilot

The [live QR Magic Pages site](https://ratfinkca.github.io/qrmagic/) uses the existing Google Cloud project `qr-magic-local-test`. OAuth branding is **QR Magic**, with the Pages URL as its homepage. The [OAuth audience](https://console.cloud.google.com/auth/audience?project=qr-magic-local-test) is **External / Testing**. The QR Mystic pilot rebrand uses the existing OAuth setup until a separate change is approved.

Add each tester’s exact Google Account email under **Audience → Test users**. The pilot can include users from separate Workspaces, subject to each Workspace’s third-party app policy. Google allows up to 100 test users and Drive consent expires after seven days in Testing. Updating the tester list takes effect in Google Cloud without a Pages deployment. Use the Console as the source for the current roster. [Google’s audience rules](https://support.google.com/cloud/answer/15549945?hl=en)

## Enable Drive locally

1. Get the public browser configuration from the project maintainer, or set up a development Google Cloud project as described below.
2. Copy [`web/.env.example`](../web/.env.example) to `web/.env.local`. Set all three values from the same Google Cloud project:

   | Variable | Value |
   | --- | --- |
   | `VITE_GOOGLE_DRIVE_CLIENT_ID` | OAuth client ID for a **Web application** |
   | `VITE_GOOGLE_DRIVE_PROJECT_NUMBER` | Numeric Cloud project number used by Google Picker |
   | `VITE_GOOGLE_DRIVE_API_KEY` | Browser API key with website and API restrictions |

3. Start or restart Vite and open the exact configured origin, typically `http://127.0.0.1:5173/qrmagic/`. `localhost`, `127.0.0.1` and different ports are separate origins.

### Set up or change the Google Cloud project

1. Enable **Google Drive API** and **Google Picker API**. In Google Auth Platform, configure Branding, Audience and the `https://www.googleapis.com/auth/drive.file` scope under Data Access. In Testing, add the accounts that will sign in.
2. For the Web application client, set **Authorized JavaScript origins** to the exact origins you use, such as `http://127.0.0.1:5173` and, for Pages, `https://ratfinkca.github.io`. An origin has no `/qrmagic/` path. This app uses Google’s browser token flow.
3. Restrict the browser API key to Google Picker API and Google Drive API. Under website restrictions, allow the app referrers (for example `http://127.0.0.1:5173/*` and `https://ratfinkca.github.io/*` where applicable) and `https://docs.google.com/*` for the Picker iframe. [Google’s Picker setup guide](https://developers.google.com/workspace/drive/picker/guides/web-picker)

Vite includes `VITE_*` values in the browser bundle. Keep OAuth client secrets and access tokens out of frontend configuration and Git. `web/.env.local` is ignored by Git.

### QR Mystic editor pilot

The pilot build can use the existing `QR Magic localhost` OAuth client and Picker key in the same Google Cloud project. Add `https://editor-pilot.qrmystic.com` to that client's authorized JavaScript origins, and `https://editor-pilot.qrmystic.com/*` to that key's website restrictions. Keep the existing localhost origin, the `https://docs.google.com/*` Picker entry, and the current API restrictions. The GitHub Pages release uses its own existing credentials. The pilot retains the current Google consent screen and approved tester list.

## Configure the Pages build

Set the three values above as **repository variables** under **Settings → Secrets and variables → Actions → Variables**. Run the [Pages workflow](https://github.com/ratfinkca/qrmagic/actions/workflows/deploy-pages.yml) from `main` after changing these values. Verify the build and deployment jobs, then smoke-test the live site. The [workflow](../.github/workflows/deploy-pages.yml) supplies these values to Vite at build time.

## Smoke test local or live

1. Open a sample design and choose the editor’s **Google Drive** button. Under **Save to Drive**, enter a distinctive test filename, select **Choose folder**, and save a copy. Check that Drive shows the file in the selected folder.
2. From **Projects → Open from Google Drive**, try **Show Drive projects**, search for the test filename, and open it. Check the artwork and job settings. Use **Browse Drive** to exercise Google’s file picker as well.
3. In the editor’s Drive dialog, open **Share Drive file** for the opened or saved project. Confirm that Google shows the correct file and sharing controls. If the dialog is blocked, use **Open file in Drive** and verify sharing there.

| Symptom | Check |
| --- | --- |
| Google Drive setup is required | All three values are present in the local environment or Pages build. Restart Vite or rebuild Pages after changing them. |
| Google rejects sign-in | Check the exact JavaScript origin, the account selected in Google, the tester list and the account’s Workspace policy. |
| Picker rejects the API key | Check the Cloud project, enabled APIs and website restrictions, including `https://docs.google.com/*`. |
| A project is missing from Drive Projects | The list shows files already accessible to the editor. Select the project through **Browse Drive**. |
| A recipient cannot open a shared file through QR Mystic | Check the file’s Drive permissions and the recipient’s pilot access. They can also download the file from Drive and open it locally if their Drive permissions allow downloading. |
