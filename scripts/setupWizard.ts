// Interactive setup wizard for config/local.json (issue #36). Walks through
// every deployment-specific value the app needs (shared DB path,
// attachments dir, HTTPS cert, reminder-email SMTP, the allow-listed
// users, cookie secret), and — where the value overlaps with the sibling
// paperless.node project's own config — pre-fills it from a detected
// paperless.node install instead of a generic placeholder.
//
// Modeled on paperless.node's own `scripts/setup_wizard.ts` (a linear list
// of step functions run in sequence, each saving its own answers before
// the next runs so quitting partway doesn't lose progress), adapted to
// this repo's readline/promises + async/await CLI style
// (scripts/adoptDocuments.ts) instead of paperless.node's older
// callback-based readline, and to this repo's scripts/*.ts camelCase
// file-naming convention.
//
// Run: npm run setup_wizard  (kept snake_case as the command name, to
// match the familiar `yarn setup_wizard` a paperless.node deployer already
// knows — only the source filename follows this repo's own convention.)
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { mergeLocalConfig } from "../server/src/setup/localConfigFile.js";
import { localConfigPath } from "./setup/repoPaths.js";
import { detectPaperlessNodeInstall, setupStorage } from "./setup/setupStorage.js";
import { setupHttps } from "./setup/setupHttps.js";
import { setupMail } from "./setup/setupMail.js";
import { setupSecurity } from "./setup/setupSecurity.js";

const rl = readline.createInterface({ input: stdin, output: stdout });

console.log("turnado setup wizard — press Enter at any prompt to accept the bracketed default.");

const { installDir, defaults } = detectPaperlessNodeInstall();
console.log(
  !installDir
    ? "\nNo paperless.node install found in the usual places (../paperless.node, ~/paperless.node) — proceeding with the manual flow."
    : defaults
      ? `\nFound a paperless.node install at ${installDir} — proposing its shared DB/attachments/TLS paths as defaults below.`
      : `\nFound a paperless.node install at ${installDir}, but couldn't derive any shared values from its config — proceeding with the manual flow.`
);

mergeLocalConfig(localConfigPath, await setupStorage(rl, defaults));
mergeLocalConfig(localConfigPath, await setupHttps(rl, defaults));
mergeLocalConfig(localConfigPath, await setupMail(rl));
mergeLocalConfig(localConfigPath, await setupSecurity(rl));

rl.close();
console.log(`\nDone — wrote ${localConfigPath}`);
