import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const worker = new URL("./offline-worker.js", import.meta.url);
const output = new URL("../dist/", import.meta.url);
const integrity = (data) => "sha256-" + createHash("sha256").update(data).digest("base64");

export async function writeOfflineWorker(directory = output) {
  const root = fileURLToPath(directory);
  const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name !== "sw.js" && !entry.name.endsWith(".map"))
    .map(entry => relative(root, join(entry.parentPath, entry.name)).split(sep).map(encodeURIComponent).join("/"))
    .sort();
  if (!files.includes("index.html")) throw new Error("Build the editor before preparing the offline release.");
  const assets = await Promise.all(files.map(async path => [path, integrity(await readFile(new URL(path, directory)))]));
  const source = await readFile(worker, "utf8");
  const version = createHash("sha256").update(JSON.stringify(assets)).update(source).digest("hex").slice(0, 24);
  await writeFile(new URL("sw.js", directory),
    `const RELEASE = ${JSON.stringify(version)};\nconst ASSETS = ${JSON.stringify(assets)};\n${source}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeOfflineWorker();
}
