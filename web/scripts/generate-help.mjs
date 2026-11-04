import { writeFile } from "node:fs/promises";
import { helpMarkdown } from "../src/lib/helpContent.ts";
await writeFile(new URL("../../docs/user-guide.md",import.meta.url),helpMarkdown());
console.log("Updated docs/user-guide.md from the in-app help content.");
