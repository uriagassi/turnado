// Step 1: shared DB path + attachments dir (issue #36). Pre-fills from a
// detected paperless.node install (server/src/setup/detectPaperlessNode.ts)
// when one's found nearby, since this app is designed to share that app's
// SQLite DB and attachments directory.
import os from "node:os";
import type { Interface } from "node:readline/promises";
import config from "../../server/src/config.js";
import { expandHome } from "../../server/src/paths.js";
import {
  findPaperlessNodeInstall,
  readPaperlessNodeDefaults,
  wellKnownPaperlessNodeDirs,
  type PaperlessNodeDefaults,
} from "../../server/src/setup/detectPaperlessNode.js";
import type { ConfigTree } from "../../server/src/setup/deepMerge.js";
import { repoRoot } from "./repoPaths.js";
import { askDetected } from "./prompt.js";

/** installDir is set whenever a well-known location had a config/local.json at all, independent of whether `defaults` came out non-null — the wizard's start-of-run message needs both to avoid conflating "no install found" with "install found, nothing usable in it". */
export interface PaperlessNodeDetection {
  installDir: string | null;
  defaults: PaperlessNodeDefaults | null;
}

/** Scans the well-known locations (see wellKnownPaperlessNodeDirs) for a paperless.node install. */
export function detectPaperlessNodeInstall(): PaperlessNodeDetection {
  const installDir = findPaperlessNodeInstall(wellKnownPaperlessNodeDirs(repoRoot, os.homedir()));
  return { installDir, defaults: installDir ? readPaperlessNodeDefaults(installDir) : null };
}

export async function setupStorage(
  rl: Interface,
  detected: PaperlessNodeDefaults | null
): Promise<ConfigTree> {
  console.log("\n-- Database & attachments --");
  if (detected?.dbPath) {
    console.log(
      "Detected a paperless.node install — proposing its DB/attachments paths below (edit or accept each)."
    );
  }

  const dbPath = await askDetected(
    rl,
    "What path should the shared paperless DB file be at?",
    detected?.dbPath,
    expandHome(config.get<string>("db.path"))
  );
  const attachmentsDir = await askDetected(
    rl,
    "What directory holds shared attachments?",
    detected?.attachmentsDir,
    expandHome(config.get<string>("attachments.dir"))
  );

  return { db: { path: dbPath }, attachments: { dir: attachmentsDir } };
}
