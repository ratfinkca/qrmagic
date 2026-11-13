import { readFile, writeFile } from "node:fs/promises";

const databaseId = process.env.PILOT_D1_DATABASE_ID;
const audience = process.env.PILOT_ACCESS_AUDIENCE;
if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(databaseId ?? "")) {
  throw new Error("Set PILOT_D1_DATABASE_ID to the pilot database UUID.");
}
if (!/^[\da-f]{64}$/i.test(audience ?? "")) {
  throw new Error("Set PILOT_ACCESS_AUDIENCE to the dashboard Access Audience tag.");
}

const example = new URL("../wrangler.deploy.example.jsonc", import.meta.url);
const config = JSON.parse(await readFile(example, "utf8"));
config.d1_databases[0].database_id = databaseId;
config.vars.ACCESS_AUDIENCE = audience;
await writeFile(new URL("../wrangler.deploy.jsonc", import.meta.url), `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" });
