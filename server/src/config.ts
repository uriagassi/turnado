// Points the `config` package at the repo-root `config/` directory
// (default.json committed, local.json gitignored) regardless of which
// directory the process was launched from, and regardless of OS —
// avoids relying on a NODE_CONFIG_DIR env var set by npm scripts.
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.NODE_CONFIG_DIR = path.resolve(__dirname, "../../config");

const config = (await import("config")).default;

export default config;
