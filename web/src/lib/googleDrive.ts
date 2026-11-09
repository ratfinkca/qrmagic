const driveScope = "https://www.googleapis.com/auth/drive.file";
const mimeType = "application/json";
const folderMimeType = "application/vnd.google-apps.folder";
export const driveProjectExtension = ".qrmagic.json";
const clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID?.trim();
const appId = import.meta.env.VITE_GOOGLE_DRIVE_PROJECT_NUMBER?.trim();
const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY?.trim();
export const googleDriveConfigured = Boolean(clientId && appId && apiKey);

export type DriveProject = { id: string; name: string; resourceKey?: string; modifiedTime?: string };
export type DriveFolder = Pick<DriveProject, "id" | "name" | "resourceKey">;
type TokenResponse = { access_token?: string; expires_in?: number | string; scope?: string; error?: string };
type GooglePicker = { setVisible(visible: boolean): void; dispose(): void };
type PickerView = {
  setIncludeFolders(included: boolean): PickerView;
  setSelectFolderEnabled(enabled: boolean): PickerView;
  setMimeTypes(types: string): PickerView;
  setMode(mode: string): PickerView;
};
type PickerBuilder = {
  addView(view: PickerView): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setOrigin(origin: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setSelectableMimeTypes(types: string): PickerBuilder;
  setCallback(callback: (data: { action: string; docs?: DriveProject[] }) => void): PickerBuilder;
  build(): GooglePicker;
};
type ShareClient = {
  setOAuthToken(token: string): void;
  setItemIds(ids: string[]): void;
  showSettingsDialog(): void;
};
type GoogleWindow = Window & {
  google?: {
    accounts?: { oauth2: {
      initTokenClient(config: {
        client_id: string; scope: string; include_granted_scopes: boolean;
        callback: (response: TokenResponse) => void;
        error_callback: (error: { type: string }) => void;
      }): { requestAccessToken(config: { prompt: string }): void };
    } };
    picker?: {
      DocsView: new (id: string) => PickerView;
      DocsViewMode: { LIST: string };
      ViewId: { DOCS: string };
      Action: { PICKED: string; CANCEL: string; ERROR: string };
      PickerBuilder: new () => PickerBuilder;
    };
  };
  gapi?: {
    load(name: string, options: { callback: () => void; onerror: () => void; ontimeout: () => void; timeout: number }): void;
    drive?: { share?: { ShareClient: new () => ShareClient } };
  };
};
const googleWindow = () => window as GoogleWindow;
const scripts = new Map<string, Promise<void>>();
let access: { token: string; expiresAt: number } | undefined;

function loadScript(url: string) {
  const loaded = scripts.get(url);
  if (loaded) return loaded;
  const pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("Could not load Google Drive. Check your connection and try again."));
    }
    const timeout = window.setTimeout(fail, 15_000);
    script.src = url;
    script.async = true;
    script.onload = () => { window.clearTimeout(timeout); resolve(); };
    script.onerror = fail;
    document.head.append(script);
  });
  scripts.set(url, pending);
  void pending.catch(() => scripts.delete(url));
  return pending;
}

export async function prepareDriveSignIn() {
  if (!googleDriveConfigured) throw new Error("Google Drive setup is required for this version of QR Magic.");
  if (!googleWindow().google?.accounts) await loadScript("https://accounts.google.com/gsi/client");
  if (!googleWindow().google?.accounts) throw new Error("Google sign-in could not start. Try reloading QR Magic.");
}

export function cachedDriveToken() {
  return access && Date.now() < access.expiresAt ? access.token : undefined;
}

export async function getDriveToken() {
  const cached = cachedDriveToken();
  if (cached) return cached;
  const oauth = googleWindow().google?.accounts?.oauth2;
  if (!clientId || !oauth) throw new Error("Google sign-in is still loading.");
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Google sign-in timed out. Try again.")), 120_000);
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope: driveScope,
      include_granted_scopes: false,
      callback(response) {
        window.clearTimeout(timeout);
        if (response.error || !response.access_token || !response.scope?.split(" ").includes(driveScope)) {
          reject(new Error("Allow QR Magic to access the Drive files you choose, then try again."));
          return;
        }
        access = { token: response.access_token, expiresAt: Date.now() + Math.max(0, Number(response.expires_in) - 30) * 1000 };
        resolve(access.token);
      },
      error_callback({ type }) {
        window.clearTimeout(timeout);
        reject(new Error(type === "popup_failed_to_open" ? "Allow the Google sign-in pop-up and try again." : "Google sign-in was not completed. Try again when ready."));
      },
    });
    client.requestAccessToken({ prompt: access ? "" : "select_account" });
  });
}

async function loadDriveModule(name: string) {
  if (!googleWindow().gapi) await loadScript("https://apis.google.com/js/api.js");
  const gapi = googleWindow().gapi;
  if (!gapi) throw new Error("Google Drive could not start.");
  await new Promise<void>((resolve, reject) => {
    const failed = () => reject(new Error("Google Drive could not load. Try again."));
    gapi.load(name, { callback: resolve, onerror: failed, ontimeout: failed, timeout: 15_000 });
  });
}

export async function pickDriveItem(token: string, kind: "project" | "folder", beforeDisplay: () => void) {
  await loadDriveModule("picker");
  const picker = googleWindow().google?.picker;
  if (!picker || !appId || !apiKey) throw new Error("The Google Drive file picker could not start.");
  return new Promise<DriveProject | undefined>((resolve, reject) => {
    const selectingFolder = kind === "folder";
    const types = selectingFolder ? folderMimeType : "application/json,application/octet-stream,text/plain";
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(selectingFolder)
      .setMimeTypes(types)
      .setMode(picker.DocsViewMode.LIST);
    const dialog = new picker.PickerBuilder()
      .setAppId(appId).setDeveloperKey(apiKey).setOAuthToken(token).setOrigin(window.location.origin)
      .setTitle(selectingFolder ? "Choose a folder for this project" : "Open a QR Magic project")
      .setSelectableMimeTypes(types).addView(view)
      .setCallback(({ action, docs }) => {
        if (action === picker.Action.CANCEL) { dialog.dispose(); resolve(undefined); }
        if (action === picker.Action.PICKED) { dialog.dispose(); resolve(docs?.[0]); }
        if (action === picker.Action.ERROR) { dialog.dispose(); reject(new Error("Google Drive could not show the selected files.")); }
      }).build();
    beforeDisplay();
    dialog.setVisible(true);
  });
}

export async function shareDriveProject(token: string, file: DriveProject, beforeDisplay: () => void) {
  await loadDriveModule("drive-share");
  const Share = googleWindow().gapi?.drive?.share?.ShareClient;
  if (!Share) throw new Error("The sharing dialog could not start. Open the file in Drive to share it there.");
  const client = new Share();
  client.setOAuthToken(token);
  client.setItemIds([file.id]);
  beforeDisplay();
  client.showSettingsDialog();
}

export function driveProjectUrl(file: DriveProject) {
  const url = new URL(`https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`);
  if (file.resourceKey) url.searchParams.set("resourcekey", file.resourceKey);
  return url.href;
}

async function driveRequest(url: string, options: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(120_000) });
  } catch {
    throw new Error("Could not reach Google Drive. Check your connection and try again.");
  }
  if (response.ok) return response;
  if (response.status === 401) {
    access = undefined;
    throw new Error("Your Google Drive session expired. Try again to sign in.");
  }
  if (response.status === 403 || response.status === 404) throw new Error("Drive could not access this file. Check your account and permissions.");
  throw new Error("Google Drive could not complete the request. Try again.");
}

function driveHeaders(token: string, item?: DriveProject) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (item?.resourceKey) headers["X-Goog-Drive-Resource-Keys"] = `${item.id}/${item.resourceKey}`;
  return headers;
}

export async function listDriveProjects(token: string) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.search = new URLSearchParams({
    q: "trashed = false", spaces: "drive", orderBy: "modifiedTime desc", pageSize: "100",
    supportsAllDrives: "true", includeItemsFromAllDrives: "true",
    fields: "nextPageToken,files(id,name,resourceKey,modifiedTime)",
  }).toString();
  const projects: DriveProject[] = [];
  let pageToken: string | undefined;
  do {
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await driveRequest(url.href, { headers: driveHeaders(token) });
    const page: { files?: DriveProject[]; nextPageToken?: string } = await response.json();
    for (const file of page.files ?? []) {
      if (file.name.toLowerCase().endsWith(driveProjectExtension)) projects.push(file);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return projects;
}

export async function saveDriveProject(token: string, name: string, project: Blob, folder?: DriveFolder): Promise<DriveProject> {
  const start = await driveRequest("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,resourceKey,modifiedTime", {
    method: "POST",
    headers: { ...driveHeaders(token, folder), "Content-Type": mimeType, "X-Upload-Content-Type": mimeType },
    body: JSON.stringify({ name, mimeType, ...(folder ? { parents: [folder.id] } : {}) }),
  });
  const location = start.headers.get("Location");
  if (!location || new URL(location).origin !== "https://www.googleapis.com") {
    throw new Error("Google Drive did not return a valid upload session.");
  }
  const result = await driveRequest(location, { method: "PUT", headers: { "Content-Type": mimeType }, body: project });
  return result.json();
}

export async function downloadDriveProject(token: string, file: DriveProject) {
  const response = await driveRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`, { headers: driveHeaders(token, file) });
  return response.text();
}
