// Step 3: reminder-email SMTP credentials (issue #36). No paperless.node
// overlap here — its "mail" config is Gmail-OAuth-specific (redirect URI,
// labels), not SMTP — so this is always a plain manual prompt, confirmed
// during the issue's triage.
import type { Interface } from "node:readline/promises";
import config from "../../server/src/config.js";
import type { ConfigTree } from "../../server/src/setup/deepMerge.js";
import { ask, askNumber } from "./prompt.js";

export async function setupMail(rl: Interface): Promise<ConfigTree> {
  console.log("\n-- Reminder emails (SMTP) --");
  const host = await ask(rl, "SMTP host?", config.get<string>("mail.host"));
  const port = await askNumber(rl, "SMTP port?", config.get<number>("mail.port"));
  const user = await ask(rl, "SMTP username?", config.get<string>("mail.user"));
  const pass = await ask(rl, "SMTP password?", config.get<string>("mail.pass"));
  const from = await ask(
    rl,
    'From address (e.g. "Turnado <user@example.com>")?',
    config.get<string>("mail.from")
  );

  return { mail: { host, port, user, pass, from } };
}
