// Step 1: shared DB path + attachments dir (issue #36). Pre-fills from a
// detected paperless.node install (server/src/setup/detectPaperlessNode.ts)
// when one's found nearby, since this app is designed to share that app's
// SQLite DB and attachments directory.
import os from "node:os";
import type { Interface } from "node:readline/promises";
import config from "../../server/src/config.js";
import {
  detectPaperlessNode,
  wellKnownPaperlessNodeDirs,
  type PaperlessNodeDefaults,
} from "../../server/src/setup/detectPaperlessNode.js";
import type { ConfigTree } from "../../server/src/setup/deepMerge.js";
import { repoRoot } from "./repoPaths.js";
import { ask } from "./prompt.js";

/** Scans the well-known locations (see wellKnownPaperlessNodeDirs) for a paperless.node install; null if none was found. */
export function detectPaperlessNodeInstall(): PaperlessNodeDefaults | null {
  return detectPaperlessNode(wellKnownPaperlessNodeDirs(repoRoot, os.homedir()));
}

export async function setupStorage(
  rl: Interface,
  detected: PaperlessNodeDefaults | null
): Promise<ConfigTree> {
  console.log("\n-- Database & attachments --");
  if (detected) {
    console.log(
      "Detected a paperless.node install — proposing its DB/attachments paths below (edit or accept each)."
    );
  }

  const dbPath = await ask(
    rl,
    "What path should the shared paperless DB file be at?",
    detected?.dbPath ?? config.get<string>("db.path")
  );
  const attachmentsDir = await ask(
    rl,
    "What directory holds shared attachments?",
    detected?.attachmentsDir ?? config.get<string>("attachments.dir")
  );

  return { db: { path: dbPath }, attachments: { dir: attachmentsDir } };
}
