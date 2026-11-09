import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadDriveProject, listDriveProjects, saveDriveProject } from "./googleDrive";

afterEach(() => vi.unstubAllGlobals());

describe("Google Drive project files", () => {
  it("creates a resumable upload and sends the complete project as JSON", async () => {
    const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?upload_id=session";
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { headers: { Location: uploadUrl } }))
      .mockResolvedValueOnce(Response.json({ id: "saved-id", name: "Decals.qrmagic.json" }));
    vi.stubGlobal("fetch", fetch);
    const project = new Blob(['{"format":"qrmagic.project"}'], { type: "application/json" });
    await expect(saveDriveProject("token", "Decals.qrmagic.json", project)).resolves.toMatchObject({ id: "saved-id" });
    const [endpoint, options] = fetch.mock.calls[0];
    expect(new URL(endpoint).searchParams.get("uploadType")).toBe("resumable");
    expect(options).toMatchObject({ method: "POST", headers: { Authorization: "Bearer token" } });
    expect(JSON.parse(options.body)).toEqual({ name: "Decals.qrmagic.json", mimeType: "application/json" });
    expect(fetch.mock.calls[1]).toEqual([uploadUrl, expect.objectContaining({ method: "PUT", headers: { "Content-Type": "application/json" }, body: project })]);
  });

  it("downloads the selected file and sends its resource key when present", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("project"));
    vi.stubGlobal("fetch", fetch);
    await expect(downloadDriveProject("token", { id: "one", name: "one.qrmagic.json", resourceKey: "key" })).resolves.toBe("project");
    const [endpoint, options] = fetch.mock.calls[0];
    expect(new URL(endpoint).searchParams.get("alt")).toBe("media");
    expect(options.headers).toMatchObject({ Authorization: "Bearer token", "X-Goog-Drive-Resource-Keys": "one/key" });
  });

  it("lists project files across pages, excluding unrelated Drive files", async () => {
    const first = { id: "one", name: "Print run.QRMAGIC.JSON", modifiedTime: "2026-01-02T00:00:00Z" };
    const second = { id: "two", name: "Decals.qrmagic.json", resourceKey: "key" };
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ files: [first, { id: "other", name: "other.json" }], nextPageToken: "second-page" }))
      .mockResolvedValueOnce(Response.json({ files: [second] }));
    vi.stubGlobal("fetch", fetch);
    await expect(listDriveProjects("token")).resolves.toEqual([first, second]);
    const [url, options] = fetch.mock.calls[0];
    expect(new URL(url).searchParams.get("orderBy")).toBe("modifiedTime desc");
    expect(new URL(url).searchParams.get("q")).toBe("trashed = false");
    expect(options.headers.Authorization).toBe("Bearer token");
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get("pageToken")).toBe("second-page");
  });

  it("uploads a copy to the explicitly selected folder", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { headers: { Location: "https://www.googleapis.com/upload/drive/v3/files?upload_id=folder" } }))
      .mockResolvedValueOnce(Response.json({ id: "new" }));
    vi.stubGlobal("fetch", fetch);
    await saveDriveProject("token", "Print run.qrmagic.json", new Blob(), { id: "folder", name: "Prints", resourceKey: "key" });
    const [url, options] = fetch.mock.calls[0];
    expect(new URL(url).searchParams.get("supportsAllDrives")).toBe("true");
    expect(JSON.parse(options.body)).toEqual({ name: "Print run.qrmagic.json", mimeType: "application/json", parents: ["folder"] });
    expect(options.headers["X-Goog-Drive-Resource-Keys"]).toBe("folder/key");
  });

  it("reports access failures without exposing the raw Google response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private details", { status: 403 })));
    await expect(downloadDriveProject("token", { id: "one", name: "one.qrmagic.json" })).rejects.toThrow(/permission/i);
  });
});
