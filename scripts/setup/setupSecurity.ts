// Step 4: the allow-listed users (locale/email/personTagName) and the
// cookie secret (issue #36). No paperless.node overlap — confirmed during
// triage — so these are always manual prompts, one per user already listed
// in config/default.json's security.allowList (today: user-one, user-two).
import crypto from "node:crypto";
import type { Interface } from "node:readline/promises";
import config from "../../server/src/config.js";
import type { ConfigTree } from "../../server/src/setup/deepMerge.js";
import { ask } from "./prompt.js";

interface AllowListEntry {
  locale?: string;
  email?: string;
  personTagName?: string;
}

export async function setupSecurity(rl: Interface): Promise<ConfigTree> {
  console.log("\n-- Users & access --");
  const currentAllowList = config.get<Record<string, AllowListEntry>>("security.allowList");
  const allowList: ConfigTree = {};
  for (const [username, entry] of Object.entries(currentAllowList)) {
    console.log(`\nUser "${username}":`);
    const locale = await ask(rl, "  Locale (e.g. en, he)?", entry.locale ?? "en");
    const email = await ask(rl, "  Reminder email address?", entry.email ?? "REPLACE_ME");
    const personTagName = await ask(
      rl,
      "  Person tag name (this user's tag in the shared document archive)?",
      entry.personTagName ?? "REPLACE_ME"
    );
    allowList[username] = { locale, email, personTagName };
  }

  console.log("\nCookie secret signs session cookies — press Enter to accept a freshly generated random one.");
  const currentSecret = config.has("security.cookieSecret")
    ? config.get<string>("security.cookieSecret")
    : undefined;
  const suggestedSecret =
    currentSecret && currentSecret !== "REPLACE_ME" ? currentSecret : crypto.randomBytes(32).toString("hex");
  const cookieSecret = await ask(rl, "Cookie secret?", suggestedSecret);

  return { security: { allowList, cookieSecret } };
}
