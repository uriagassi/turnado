// Repo-root-relative paths shared by the setup wizard's steps (issue #36),
// resolved from this file's own location so they're correct regardless of
// the directory the wizard is launched from — same reasoning as
// server/src/config.ts's NODE_CONFIG_DIR resolution.
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(__dirname, "../..");
export const localConfigPath = path.join(repoRoot, "config", "local.json");
