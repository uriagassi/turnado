import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { createDb } from "../src/db.js";
import { Appointments } from "../src/appointments/Appointments.js";
import { Tasks } from "../src/tasks/Tasks.js";
import { Doctors } from "../src/doctors/Doctors.js";
import { ReminderLog } from "../src/reminders/ReminderLog.js";
import { AllowList, AllowListConfig } from "../src/auth/AllowList.js";
import { ReminderService } from "../src/reminders/ReminderService.js";
import type { Mailer } from "../src/reminders/Mailer.js";
import type { ReminderEmailContent } from "../src/reminders/reminderEmail.js";
import { singleUserAllowList, twoUserAllowList } from "./support/allowListFixture.js";

class FakeMailer implements Mailer {
  sent: { to: string; content: ReminderEmailContent }[] = [];
  failFor = new Set<string>();

  async send(to: string, content: ReminderEmailContent): Promise<void> {
    if (this.failFor.has(to)) throw new Error("SMTP failure");
    this.sent.push({ to, content });
  }
}

describe("ReminderService.runOnce", () => {
  const tmpFiles: string[] = [];
  const openDbs: Database[] = [];

  afterEach(() => {
    for (const db of openDbs.splice(0)) db.close();
    for (const f of tmpFiles.splice(0)) {
      fs.rmSync(f, { force: true });
      fs.rmSync(f + "-wal", { force: true });
      fs.rmSync(f + "-shm", { force: true });
    }
  });

  function tmpDb(): Database {
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "turnado-")), "test.sqlite");
    tmpFiles.push(p);
    const db = createDb(p, 5000);
    openDbs.push(db);
    return db;
  }

  function harness(opts: { allowList?: AllowListConfig; mailer?: FakeMailer; now?: Date } = {}) {
    const db = tmpDb();
    const appointments = new Appointments(db);
    const tasks = new Tasks(db);
    const doctors = new Doctors(db, "medical/doctors");
    const reminderLog = new ReminderLog(db);
    const allowList = new AllowList(opts.allowList ?? singleUserAllowList());
    const mailer = opts.mailer ?? new FakeMailer();
    const now = opts.now ?? new Date("2026-08-22T09:00:00Z");
    const service = new ReminderService({
      appointments,
      tasks,
      doctors,
      reminderLog,
      allowList,
      mailer,
      timezone: "UTC",
      clock: () => now,
    });
    return { appointments, tasks, doctors, reminderLog, allowList, mailer, service };
  }

  it("sends a reminder to a due appointment's owner and marks it sent", async () => {
    const { appointments, mailer, reminderLog, service } = harness();
    const appt = appointments.create({ notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z" }, "alice");

    await service.runOnce();

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("alice@example.com");
    expect(reminderLog.find("appointment", appt.id, "2026-08-23")?.status).toBe("sent");
  });

  it("sends a reminder for a due task's owner", async () => {
    const { tasks, mailer, reminderLog, service } = harness();
    const task = tasks.create({ type: "test", title: "Blood test", dueDate: "2026-08-23" }, "alice");

    await service.runOnce();

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("alice@example.com");
    expect(reminderLog.find("task", task.id, "2026-08-23")?.status).toBe("sent");
  });

  it("sends only to the item's owner, not every allow-listed user", async () => {
    const { appointments, mailer, service } = harness({ allowList: twoUserAllowList() });
    appointments.create({ notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z" }, "alice");

    await service.runOnce();

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("alice@example.com");
  });

  it("skips an unowned item silently: no send, no log entry", async () => {
    const { appointments, mailer, reminderLog, service } = harness();
    const appt = appointments.create({ notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z" });

    await service.runOnce();

    expect(mailer.sent).toHaveLength(0);
    expect(reminderLog.find("appointment", appt.id, "2026-08-23")).toBeUndefined();
  });

  it("skips an item whose owner is no longer on the allow list", async () => {
    const { appointments, mailer, reminderLog, service } = harness();
    const appt = appointments.create({ notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z" }, "gone-user");

    await service.runOnce();

    expect(mailer.sent).toHaveLength(0);
    expect(reminderLog.find("appointment", appt.id, "2026-08-23")).toBeUndefined();
  });

  it("does not resend an item already marked sent", async () => {
    const { appointments, mailer, reminderLog, service } = harness();
    const appt = appointments.create({ notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z" }, "alice");
    reminderLog.markSent("appointment", appt.id, "2026-08-23");

    await service.runOnce();

    expect(mailer.sent).toHaveLength(0);
  });

  it("does not resend an item already marked missed", async () => {
    const { appointments, mailer, reminderLog, service } = harness();
    const appt = appointments.create({ notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z" }, "alice");
    reminderLog.markMissed("appointment", appt.id, "2026-08-23", "send failed");

    await service.runOnce();

    expect(mailer.sent).toHaveLength(0);
  });

  it("marks failed (not sent) when the mailer throws, and does not throw itself", async () => {
    const mailer = new FakeMailer();
    mailer.failFor.add("alice@example.com");
    const { appointments, reminderLog, service } = harness({ mailer });
    const appt = appointments.create({ notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z" }, "alice");

    await expect(service.runOnce()).resolves.toBeUndefined();

    const entry = reminderLog.find("appointment", appt.id, "2026-08-23");
    expect(entry?.status).toBe("pending");
    expect(entry?.attempts).toBe(1);
  });

  it("retries a previously failed item on a later run and marks it sent once delivery succeeds", async () => {
    const mailer = new FakeMailer();
    mailer.failFor.add("alice@example.com");
    const { appointments, reminderLog, service } = harness({ mailer });
    const appt = appointments.create({ notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z" }, "alice");
    await service.runOnce();

    mailer.failFor.clear();
    await service.runOnce();

    expect(mailer.sent).toHaveLength(1);
    expect(reminderLog.find("appointment", appt.id, "2026-08-23")?.status).toBe("sent");
  });

  it("marks 'window closed before delivery' for a past-due item that was never logged", async () => {
    const { appointments, reminderLog, service } = harness({ now: new Date("2026-08-25T09:00:00Z") });
    const appt = appointments.create({ notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z" }, "alice");

    await service.runOnce();

    const entry = reminderLog.find("appointment", appt.id, "2026-08-23");
    expect(entry?.status).toBe("missed");
    expect(entry?.missedReason).toBe("window closed before delivery");
  });

  it("does not mark 'window closed' for an unowned past-due item (skip silently)", async () => {
    const { appointments, reminderLog, service } = harness({ now: new Date("2026-08-25T09:00:00Z") });
    const appt = appointments.create({ notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z" });

    await service.runOnce();

    expect(reminderLog.find("appointment", appt.id, "2026-08-23")).toBeUndefined();
  });

  it("sweeps a stale pending log entry into missed/'send failed'", async () => {
    const { reminderLog, service } = harness({ now: new Date("2026-08-25T09:00:00Z") });
    reminderLog.markFailed("task", 99, "2026-08-20");

    await service.runOnce();

    const entry = reminderLog.find("task", 99, "2026-08-20");
    expect(entry?.status).toBe("missed");
    expect(entry?.missedReason).toBe("send failed");
  });

  it("resolves the appointment's doctor name into the email body", async () => {
    const { appointments, doctors, mailer, service } = harness();
    const doctor = doctors.create({ name: "Dr. Cohen" });
    appointments.create(
      { notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z", doctorId: doctor.id },
      "alice",
    );

    await service.runOnce();

    expect(mailer.sent[0].content.body).toContain("Dr. Cohen");
  });

  it("uses the recipient's own locale, not a fixed default", async () => {
    const { tasks, mailer, service } = harness({ allowList: twoUserAllowList() });
    tasks.create({ type: "test", title: "Blood test", dueDate: "2026-08-23" }, "bob"); // bob's locale is "he"

    await service.runOnce();

    expect(mailer.sent[0].to).toBe("bob@example.com");
    expect(mailer.sent[0].content.subject).toBe("תזכורת: Blood test עד מחר");
  });

  it("leaves reminders alone for an appointment that's been cancelled", async () => {
    const { appointments, mailer, service } = harness();
    const appt = appointments.create({ notes: "Annual checkup", dateTime: "2026-08-23T10:00:00Z" }, "alice");
    appointments.setStatus(appt.id, "cancelled");

    await service.runOnce();

    expect(mailer.sent).toHaveLength(0);
  });
});
