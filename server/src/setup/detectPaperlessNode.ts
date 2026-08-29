// Issue #36: the setup wizard pre-fills its storage/HTTPS prompts from a
// sibling `paperless.node` install when it can find one, since this app is
// designed to share that app's SQLite DB, attachments dir, and (optionally)
// TLS cert with it — see the issue's triage comment for how this was
// investigated against paperless.node's actual source (it exposes no API/
// CLI, just a `config/local.json` merged over `config/default.json` the
// same way this app's own config works, via the `config` npm package).
//
// There's no fixed install path or reliable "is it running" signal for
// paperless.node, so detection is file-based and limited to a short list of
// well-known locations — see wellKnownPaperlessNodeDirs().
import fs from "node:fs";
import path from "node:path";
import { deepMerge, type ConfigTree } from "./deepMerge.js";
import { expandHome } from "../paths.js";

export interface PaperlessNodeDefaults {
  dbPath?: string;
  attachmentsDir?: string;
  httpsKeyPath?: string;
  httpsCertPath?: string;
}

/** The candidate directories the wizard scans for a paperless.node install: a sibling checkout next to this repo, and one directly under the deployer's home directory. */
export function wellKnownPaperlessNodeDirs(turnadoRootDir: string, homeDir: string): string[] {
  return [path.resolve(turnadoRootDir, "..", "paperless.node"), path.join(homeDir, "paperless.node")];
}

/** First candidate dir that looks like a paperless.node install (has a config/local.json), or null if none do. */
export function findPaperlessNodeInstall(candidateDirs: string[]): string | null {
  return candidateDirs.find((dir) => fs.existsSync(path.join(dir, "config", "local.json"))) ?? null;
}

/** Reads and JSON-parses a config file if it exists; {} if it's missing or unparseable — a config file this wizard doesn't own (paperless.node's) shouldn't crash the wizard just because it can't be read, any more than a missing one would. */
function readJsonIfExists(filePath: string): ConfigTree {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ConfigTree;
  } catch {
    return {};
  }
}

/** Reads a string-valued field two levels deep (e.g. `merged.paperless`, `"baseDir"`) out of a merged config tree, or undefined if that branch isn't there / isn't a string. */
function readStringField(section: ConfigTree[string], field: string): string | undefined {
  if (typeof section !== "object" || section === null) return undefined;
  const value = section[field];
  return typeof value === "string" ? value : undefined;
}

/**
 * Reads and derives the shared defaults from a known paperless.node install
 * dir, or null if nothing usable came out of it. The DB/attachments
 * derivation (needs `paperless.baseDir`) and the HTTPS derivation (needs
 * `https.use === true`) are independent of each other — an install missing
 * one can still contribute the other.
 */
export function readPaperlessNodeDefaults(installDir: string): PaperlessNodeDefaults | null {
  const defaults = readJsonIfExists(path.join(installDir, "config", "default.json"));
  const local = readJsonIfExists(path.join(installDir, "config", "local.json"));
  const merged = deepMerge(defaults, local);

  const result: PaperlessNodeDefaults = {};

  const rawBaseDir = readStringField(merged.paperless, "baseDir");
  if (rawBaseDir) {
    const baseDir = expandHome(rawBaseDir);
    result.dbPath = path.join(baseDir, "paperless.sqlite");
    result.attachmentsDir = path.join(baseDir, "attachments");
  }

  const https = merged.https;
  if (typeof https === "object" && https !== null && https.use === true) {
    const keyPath = readStringField(https, "key");
    const certPath = readStringField(https, "cert");
    if (keyPath) result.httpsKeyPath = keyPath;
    if (certPath) result.httpsCertPath = certPath;
  }

  return Object.keys(result).length > 0 ? result : null;
}

/** Scans candidateDirs (see wellKnownPaperlessNodeDirs) for a paperless.node install and derives this app's shared defaults from it, or returns null if none was found / usable. */
export function detectPaperlessNode(candidateDirs: string[]): PaperlessNodeDefaults | null {
  const installDir = findPaperlessNodeInstall(candidateDirs);
  return installDir ? readPaperlessNodeDefaults(installDir) : null;
}
