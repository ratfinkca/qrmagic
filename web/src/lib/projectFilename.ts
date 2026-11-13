const projectExtension = ".qrmystic.json";
const projectExtensions = [projectExtension, ".qrmagic.json"];

export const projectFileAccept = [...projectExtensions, "application/json"].join(",");

function findProjectExtension(filename: string) {
  const lower = filename.toLowerCase();
  return projectExtensions.find(extension => lower.endsWith(extension));
}

export function isProjectFilename(filename: string) {
  return findProjectExtension(filename) !== undefined;
}

export function projectFilename(name: string) {
  const extension = findProjectExtension(name);
  const stem = extension ? name.slice(0, -extension.length) : name;
  return stem + projectExtension;
}
