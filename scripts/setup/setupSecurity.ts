// Step 4: the allow-listed users (locale/email/personTagName) and the
// cookie secret (issue #36). No paperless.node overlap — confirmed during
// triage — so these are always manual prompts.
//
// config/default.json ships two illustrative usernames ("user-one",
// "user-two") purely to show the shape of security.allowList — they
// aren't real accounts, and this app's auth actually trusts whatever
// usernames end up in local.json's allowList. So this step reads the
// *current* users straight from config/local.json (never from
// default.json's mock pair) and lets the deployer edit or add to that set
// — a fresh install starts from zero real users, not from user-one/
// user-two waiting to be filled in.
import type { Interface } from "node:readline/promises";
import config from "../../server/src/config.js";
import { readLocalConfig } from "../../server/src/setup/localConfigFile.js";
import type { ConfigTree } from "../../server/src/setup/deepMerge.js";
import { pickCookieSecretDefault } from "../../server/src/setup/cookieSecret.js";
import { localConfigPath } from "./repoPaths.js";
import { ask } from "./prompt.js";

interface AllowListEntry {
  locale?: string;
  email?: string;
  personTagName?: string;
}

type AllowList = Record<string, AllowListEntry>;

function currentAllowList(): AllowList {
  const security = readLocalConfig(localConfigPath).security;
  const allowList = typeof security === "object" && security !== null ? security.allowList : undefined;
  return typeof allowList === "object" && allowList !== null ? (allowList as AllowList) : {};
}

function printUsers(users: AllowList) {
  const usernames = Object.keys(users);
  if (usernames.length === 0) {
    console.log("No users configured yet.");
    return;
  }
  console.log("Current users:");
  for (const username of usernames) {
    const { locale, email, personTagName } = users[username];
    console.log(`  - ${username} (locale=${locale ?? "?"}, email=${email ?? "?"}, personTagName=${personTagName ?? "?"})`);
  }
}

async function promptNewUsername(rl: Interface, users: AllowList): Promise<string> {
  for (;;) {
    const username = (await rl.question("New username? ")).trim();
    if (username.length === 0) {
      console.log("Username can't be blank.");
    } else if (username in users) {
      console.log(`"${username}" already exists — pick [e]dit from the menu instead, or choose a different username.`);
    } else {
      return username;
    }
  }
}

async function promptUsernameToEdit(rl: Interface, users: AllowList): Promise<string | null> {
  for (;;) {
    const answer = (await rl.question("Which username? (blank to cancel) ")).trim();
    if (answer.length === 0) return null;
    if (answer in users) return answer;
    console.log(`No user "${answer}". Current users: ${Object.keys(users).join(", ") || "(none)"}`);
  }
}

async function promptUserFields(rl: Interface, existing: AllowListEntry): Promise<AllowListEntry> {
  const locale = await ask(rl, "  Locale (e.g. en, he)?", existing.locale ?? "en");
  const email = await ask(rl, "  Reminder email address?", existing.email ?? "REPLACE_ME");
  const personTagName = await ask(
    rl,
    "  Person tag name (this user's tag in the shared document archive)?",
    existing.personTagName ?? "REPLACE_ME"
  );
  return { locale, email, personTagName };
}

async function promptAction(rl: Interface, hasUsers: boolean): Promise<"add" | "edit" | "done"> {
  const defaultChoice = hasUsers ? "d" : "a";
  for (;;) {
    const answer = (await ask(rl, "[a]dd a user, [e]dit a user, or [d]one?", defaultChoice)).trim().toLowerCase();
    if (answer.startsWith("a")) return "add";
    if (answer.startsWith("e")) return "edit";
    if (answer.startsWith("d")) return "done";
    console.log('Please answer "a", "e", or "d".');
  }
}

async function setupUsers(rl: Interface): Promise<AllowList> {
  const users: AllowList = { ...currentAllowList() };

  for (;;) {
    console.log();
    printUsers(users);
    const action = await promptAction(rl, Object.keys(users).length > 0);
    if (action === "done") {
      return users;
    }
    if (action === "add") {
      const username = await promptNewUsername(rl, users);
      console.log(`User "${username}":`);
      users[username] = await promptUserFields(rl, {});
    } else {
      const username = await promptUsernameToEdit(rl, users);
      if (username) {
        console.log(`User "${username}":`);
        users[username] = await promptUserFields(rl, users[username]);
      }
    }
  }
}

export async function setupSecurity(rl: Interface): Promise<ConfigTree> {
  console.log("\n-- Users & access --");
  const allowList = await setupUsers(rl);

  console.log("\nCookie secret signs session cookies — press Enter to accept a freshly generated random one.");
  const currentSecret = config.has("security.cookieSecret")
    ? config.get<string>("security.cookieSecret")
    : undefined;
  const cookieSecret = await ask(rl, "Cookie secret?", pickCookieSecretDefault(currentSecret));

  return { security: { allowList: allowList as ConfigTree, cookieSecret } };
}
