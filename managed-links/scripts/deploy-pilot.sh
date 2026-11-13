#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN in cloudflare-pilot}"
: "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID in cloudflare-pilot}"
: "${GITHUB_SHA:?Run this script from the pilot deployment workflow}"

upload_version() (
  local config="$1"
  local output_file
  output_file="$(mktemp)" || return 1
  trap 'rm -f "$output_file"' EXIT
  WRANGLER_OUTPUT_FILE_PATH="$output_file" pnpm exec wrangler versions upload \
    --config "$config" --message "GitHub $GITHUB_SHA" >&2 || return 1
  node --input-type=module - "$output_file" <<'NODE'
import { readFileSync } from "node:fs";
const entries = readFileSync(process.argv[2], "utf8").trim().split("\n").map(line => JSON.parse(line));
const version = entries.find(entry => entry.type === "version-upload")?.version_id;
if (!version) throw new Error("Wrangler did not return an uploaded version ID.");
console.log(version);
NODE
)

links_config=wrangler.deploy.jsonc
editor_config=../web/wrangler.pilot.jsonc
links_version="$(upload_version "$links_config")"
editor_version="$(upload_version "$editor_config")"

pnpm exec wrangler versions deploy "$links_version@100%" --config "$links_config" --yes --message "GitHub $GITHUB_SHA"
pnpm exec wrangler versions deploy "$editor_version@100%" --config "$editor_config" --yes --message "GitHub $GITHUB_SHA"
