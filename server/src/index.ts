import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./config.js";
import { createDb } from "./db.js";
import { createApp } from "./app.js";
import type { IAuthHandler } from "./auth/Auth.js";
import { AllowList, type AllowListConfig } from "./auth/AllowList.js";
import { Appointments } from "./appointments/Appointments.js";
import { Tasks } from "./tasks/Tasks.js";
import { Doctors } from "./doctors/Doctors.js";
import { ReminderLog } from "./reminders/ReminderLog.js";
import { ReminderService } from "./reminders/ReminderService.js";
import { NodemailerMailer, createNodemailerTransport } from "./reminders/Mailer.js";
import { schedulePolling } from "./reminders/schedulePolling.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = expandHome(config.get<string>("db.path"));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = createDb(dbPath, config.get<number>("db.busyTimeoutMs"));

const authHandlerModule = await import(config.get<string>("auth.handler"));
const authHandler: IAuthHandler = new authHandlerModule.AuthHandler();

const allowListConfig = config.get<AllowListConfig>("security.allowList");
const doctorsParentTagName = config.has("doctors.parentTagName")
  ? config.get<string>("doctors.parentTagName")
  : "medical/doctors";
const remindersTimezone = config.has("reminders.timezone") ? config.get<string>("reminders.timezone") : "Asia/Jerusalem";

const app = createApp({
  authHandler,
  allowList: allowListConfig,
  cookieSecret: config.get<string>("security.cookieSecret"),
  supportedLocales: config.get<string[]>("i18n.supportedLocales"),
  fallbackLocale: config.get<string>("i18n.fallbackLocale"),
  db,
  doctorsParentTagName,
  documentTypeParentTagName: config.has("documents.documentTypeParentTagName")
    ? config.get<string>("documents.documentTypeParentTagName")
    : "medical/document-type",
  specialtyParentTagName: config.has("documents.specialtyParentTagName")
    ? config.get<string>("documents.specialtyParentTagName")
    : "medical/specialty",
  remindersTimezone,
  photosDir: expandHome(config.get<string>("doctors.photosDir")),
  medicalNotebookId: config.has("notebook.medicalNotebookId") ? config.get<number>("notebook.medicalNotebookId") : undefined,
  medicalNotebookName: config.has("notebook.medicalNotebookName") ? config.get<string>("notebook.medicalNotebookName") : "Medical",
  attachmentsDir: config.has("attachments.dir") ? expandHome(config.get<string>("attachments.dir")) : undefined,
  clientDistPath: path.resolve(__dirname, "../../client/dist"),
});

// issue #10: derive a fresh ReminderService against the same shared `db` the
// app above uses (each of these classes owns its table but not the
// connection — see db.ts), then poll it hourly + once on startup.
const reminderService = new ReminderService({
  appointments: new Appointments(db),
  tasks: new Tasks(db),
  doctors: new Doctors(db, doctorsParentTagName),
  reminderLog: new ReminderLog(db),
  allowList: new AllowList(allowListConfig),
  mailer: new NodemailerMailer(
    createNodemailerTransport({
      host: config.get<string>("mail.host"),
      port: config.get<number>("mail.port"),
      user: config.get<string>("mail.user"),
      pass: config.get<string>("mail.pass"),
    }),
    config.get<string>("mail.from"),
  ),
  timezone: remindersTimezone,
});
schedulePolling(() => reminderService.runOnce(), 60 * 60 * 1000);

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
