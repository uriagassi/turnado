// Step 3b: Google Chat DM reminders, sent as a dedicated Workspace sender
// account via user OAuth. Prerequisites: docs/gchat-setup.md.
import http from "node:http";
import { randomBytes } from "node:crypto";
import type { Interface } from "node:readline/promises";
import config from "../../server/src/config.js";
import type { ConfigTree } from "../../server/src/setup/deepMerge.js";
import { ask, askYesNo } from "./prompt.js";

const PORT = 53682; // arbitrary fixed loopback port; Desktop OAuth clients accept any
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;
const CODE_TIMEOUT_MS = 5 * 60 * 1000;
const SCOPES = [
  "https://www.googleapis.com/auth/chat.spaces",
  "https://www.googleapis.com/auth/chat.spaces.create",
  "https://www.googleapis.com/auth/chat.messages.create",
];

interface CodeWait {
  code: Promise<string>;
  cancel: () => void;
}

function waitForCode(state: string): CodeWait {
  let cancel = () => {};
  const code = new Promise<string>((resolve, reject) => {
    const finish = (err?: Error, code?: string) => {
      clearTimeout(timer);
      server.close();
      if (code) resolve(code);
      else reject(err);
    };
    cancel = () => {
      clearTimeout(timer);
      server.close();
    };
    const timer = setTimeout(() => finish(new Error("Timed out waiting for authorization")), CODE_TIMEOUT_MS);
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", REDIRECT_URI);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (!code && !error) {
        res.statusCode = 404; // favicon and other stray requests
        res.end();
        return;
      }
      if (url.searchParams.get("state") !== state) {
        res.statusCode = 400;
        res.end("State mismatch.");
        return;
      }
      res.end(code ? "Authorized. You can close this tab." : "Authorization failed.");
      finish(error ? new Error(error) : undefined, code ?? undefined);
    });
    server.on("error", (err) => finish(err));
    server.listen(PORT, "127.0.0.1");
  });
  return { code, cancel: () => cancel() };
}

/** Extracts the auth code from a pasted redirect URL (for when the browser can't reach the loopback listener, e.g. over SSH). */
function codeFromRedirect(pasted: string, state: string): string {
  const url = new URL(pasted.trim());
  if (url.searchParams.get("state") !== state) throw new Error("Pasted URL has the wrong state");
  const code = url.searchParams.get("code");
  if (!code) throw new Error(`Pasted URL has no code (${url.searchParams.get("error") ?? "no error given"})`);
  return code;
}

async function obtainCode(rl: Interface, state: string): Promise<string> {
  const listener = waitForCode(state);
  const abort = new AbortController();
  const pasted = rl
    .question("If the browser can't reach this machine, paste the redirect URL it ended up on, or wait: ", {
      signal: abort.signal,
    })
    .then((answer) => codeFromRedirect(answer, state));
  try {
    return await Promise.race([listener.code.catch(() => pasted), pasted]); // a listener failure (port busy, timeout) leaves pasting as the way forward
  } finally {
    abort.abort();
    listener.cancel();
    pasted.catch(() => {}); // the aborted question rejects; nothing to report
  }
}

export async function setupGChat(rl: Interface): Promise<ConfigTree> {
  console.log("\n-- Google Chat reminders (optional; email remains the fallback) --");
  if (!(await askYesNo(rl, "Send reminders as Google Chat DMs?", false))) return {};

  const clientId = await ask(rl, "OAuth client ID?", config.get<string>("gchat.clientId"));
  const clientSecret = await ask(rl, "OAuth client secret?", config.get<string>("gchat.clientSecret"));

  const state = randomBytes(16).toString("hex");
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
  console.log(`\nSign in as the sender account and approve:\n\n${authUrl}\n`);

  const code = await obtainCode(rl, state);
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
  const tokens = (await res.json()) as { refresh_token?: string; error?: string };
  if (!res.ok || !tokens.refresh_token) {
    throw new Error(`Token exchange failed (${res.status}): ${tokens.error ?? "no refresh token returned"}`);
  }

  return { gchat: { clientId, clientSecret, refreshToken: tokens.refresh_token } };
}
