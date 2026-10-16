// Optional step: Google Chat DM reminders, sent as a dedicated Workspace
// sender account via user OAuth. Needs a GCP project with the Chat API
// enabled and a configured Chat app, plus a Desktop-type OAuth client.
import http from "node:http";
import type { Interface } from "node:readline/promises";
import config from "../../server/src/config.js";
import type { ConfigTree } from "../../server/src/setup/deepMerge.js";
import { ask, askYesNo } from "./prompt.js";

const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;
const SCOPES = [
  "https://www.googleapis.com/auth/chat.spaces",
  "https://www.googleapis.com/auth/chat.spaces.create",
  "https://www.googleapis.com/auth/chat.messages.create",
];

function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", REDIRECT_URI);
      const code = url.searchParams.get("code");
      res.end(code ? "Authorized. You can close this tab." : "Authorization failed.");
      server.close();
      if (code) resolve(code);
      else reject(new Error(url.searchParams.get("error") ?? "no code returned"));
    });
    server.listen(PORT, "127.0.0.1");
  });
}

export async function setupGChat(rl: Interface): Promise<ConfigTree> {
  console.log("\n-- Google Chat reminders (optional; email remains the fallback) --");
  if (!(await askYesNo(rl, "Send reminders as Google Chat DMs?", false))) return {};

  const clientId = await ask(rl, "OAuth client ID?", config.get<string>("gchat.clientId"));
  const clientSecret = await ask(rl, "OAuth client secret?", config.get<string>("gchat.clientSecret"));

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
    });
  console.log(`\nSign in as the sender account and approve:\n\n${authUrl}\n`);

  const code = await waitForCode();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await res.json()) as { refresh_token?: string };
  if (!tokens.refresh_token) throw new Error(`Token exchange returned no refresh token: ${JSON.stringify(tokens)}`);

  return { gchat: { clientId, clientSecret, refreshToken: tokens.refresh_token } };
}
