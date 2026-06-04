#!/usr/bin/env node
/* Rewrite the hardcoded LoopGain version fallbacks in the landing HTML from the
 * live PyPI version, so the *shipped* HTML is always current and the fallback
 * is generated, not hand-edited.
 *
 * Runs at deploy time (.github/workflows/deploy.yml) before `wrangler deploy`,
 * mutating the CI checkout only — it does NOT commit back. The git copy is just
 * the last-known default; the served artifact is what this regenerates.
 * Also runnable locally:  node scripts/sync-version.mjs   (use --check in CI to
 * fail if anything was stale instead of silently fixing).
 *
 * What it touches (and ONLY this — historical "loopgain v0.4.0" prose in the
 * bench notes is left alone because it doesn't match these patterns):
 *   <... data-lg-version>vX.Y.Z<       (nav badges)
 *   <... data-lg-version-num>X.Y.Z<    (version embedded in text)
 *   "softwareVersion": "X.Y.Z"         (JSON-LD structured data)
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = String.raw`\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?`;
const checkOnly = process.argv.includes("--check");

async function pypiVersion() {
  const res = await fetch("https://pypi.org/pypi/loopgain/json");
  if (!res.ok) throw new Error(`PyPI fetch failed: HTTP ${res.status}`);
  const v = (await res.json())?.info?.version;
  if (!v) throw new Error("PyPI response had no info.version");
  return v;
}

function rewrite(html, v) {
  return html
    .replace(new RegExp(`(data-lg-version>)v${SEMVER}`, "g"), `$1v${v}`)
    .replace(new RegExp(`(data-lg-version-num>)${SEMVER}`, "g"), `$1${v}`)
    .replace(new RegExp(`("softwareVersion":\\s*")${SEMVER}(")`, "g"), `$1${v}$2`);
}

const version = await pypiVersion();
const files = (await readdir(ROOT)).filter((f) => f.endsWith(".html"));
let staleFiles = [];

for (const file of files) {
  const path = join(ROOT, file);
  const before = await readFile(path, "utf8");
  const after = rewrite(before, version);
  if (after !== before) {
    staleFiles.push(file);
    if (!checkOnly) await writeFile(path, after);
  }
}

if (checkOnly && staleFiles.length) {
  console.error(`[sync-version] stale fallbacks (expected v${version}): ${staleFiles.join(", ")}`);
  process.exit(1);
}
console.log(
  staleFiles.length
    ? `[sync-version] set version to ${version} in: ${staleFiles.join(", ")}`
    : `[sync-version] all HTML fallbacks already at ${version}`
);
