import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./config.js";
import { createDb } from "./db.js";
import { createApp } from "./app.js";
import type { IAuthHandler } from "./auth/Auth.js";
import type { AllowListConfig } from "./auth/AllowList.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = expandHome(config.get<string>("db.path"));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = createDb(dbPath, config.get<number>("db.busyTimeoutMs"));

const authHandlerModule = await import(config.get<string>("auth.handler"));
const authHandler: IAuthHandler = new authHandlerModule.AuthHandler();

const app = createApp({
  authHandler,
  allowList: config.get<AllowListConfig>("security.allowList"),
  cookieSecret: config.get<string>("security.cookieSecret"),
  supportedLocales: config.get<string[]>("i18n.supportedLocales"),
  fallbackLocale: config.get<string>("i18n.fallbackLocale"),
  db,
  doctorsParentTagName: config.has("doctors.parentTagName")
    ? config.get<string>("doctors.parentTagName")
    : "medical/doctors",
  documentTypeParentTagName: config.has("documents.documentTypeParentTagName")
    ? config.get<string>("documents.documentTypeParentTagName")
    : "medical/document-type",
  photosDir: expandHome(config.get<string>("doctors.photosDir")),
  medicalNotebookId: config.has("notebook.medicalNotebookId") ? config.get<number>("notebook.medicalNotebookId") : 0,
  attachmentsDir: config.has("attachments.dir") ? expandHome(config.get<string>("attachments.dir")) : undefined,
  clientDistPath: path.resolve(__dirname, "../../client/dist"),
});

const hostname = config.get("server.localOnly") === true ? "127.0.0.1" : "0.0.0.0";
const port = config.get<number>("server.port");

if (config.has("https.use") && config.get("https.use") === true) {
  const key = fs.readFileSync(config.get<string>("https.keyPath"));
  const cert = fs.readFileSync(config.get<string>("https.certPath"));
  https.createServer({ key, cert }, app).listen(port, hostname, () => {
    console.log(`turnado server listening on https://${hostname}:${port}`);
  });
} else {
  app.listen(port, hostname, () => {
    console.log(`turnado server listening on http://${hostname}:${port}`);
  });
}

function expandHome(p: string): string {
  if (p.startsWith("~")) {
    return path.join(process.env.HOME ?? process.env.USERPROFILE ?? "", p.slice(1));
  }
  return p;
}
