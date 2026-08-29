// Read/write helpers for config/local.json used by the setup wizard
// (issue #36). Kept separate from server/src/config.ts, which only ever
// *reads* the merged default.json+local.json via the `config` npm package
// — writing has to go straight to local.json instead, and the wizard needs
// the path parameterized so tests can point it at a temp file.
import fs from "node:fs";
import { deepMerge, type ConfigTree } from "./deepMerge.js";

/** Reads config/local.json as-is (no merge with default.json — that's server/src/config.ts's job at runtime). Returns {} if the file doesn't exist yet, which is the normal state before the wizard's first write. */
export function readLocalConfig(localConfigPath: string): ConfigTree {
  if (!fs.existsSync(localConfigPath)) return {};
  return JSON.parse(fs.readFileSync(localConfigPath, "utf-8")) as ConfigTree;
}

/** Deep-merges `patch` onto whatever's already in config/local.json and writes the result back, so each wizard step (storage, HTTPS, mail, security) can save its own answers without clobbering the others'. Returns the merged config. */
export function mergeLocalConfig(localConfigPath: string, patch: ConfigTree): ConfigTree {
  const merged = deepMerge(readLocalConfig(localConfigPath), patch);
  fs.writeFileSync(localConfigPath, JSON.stringify(merged, null, 2) + "\n");
  return merged;
}
