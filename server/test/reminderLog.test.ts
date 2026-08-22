import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ReminderLog } from "../src/reminders/ReminderLog.js";

describe("ReminderLog", () => {
  let db: Database.Database;
  let log: ReminderLog;

  beforeEach(() => {
    db = new Database(":memory:");
    log = new ReminderLog(db);
  });

  it("finds nothing for a key that was never recorded", () => {
    expect(log.find("appointment", 1, "2026-08-23")).toBeUndefined();
  });

  it("creates a pending entry with one attempt on the first failed send", () => {
    const entry = log.markFailed("appointment", 1, "2026-08-23");

    expect(entry.id).toBeTypeOf("number");
    expect(entry.itemType).toBe("appointment");
    expect(entry.itemId).toBe(1);
    expect(entry.targetDate).toBe("2026-08-23");
    expect(entry.status).toBe("pending");
    expect(entry.attempts).toBe(1);
    expect(entry.missedReason).toBeNull();

    expect(log.find("appointment", 1, "2026-08-23")).toEqual(entry);
  });

  it("increments attempts on the same key instead of creating a second row", () => {
    log.markFailed("appointment", 1, "2026-08-23");
    const second = log.markFailed("appointment", 1, "2026-08-23");

    expect(second.attempts).toBe(2);
    expect(second.status).toBe("pending");
  });

  it("marks an entry sent, terminal, after a successful send", () => {
    const entry = log.markSent("task", 5, "2026-08-23");

    expect(entry.status).toBe("sent");
    expect(entry.missedReason).toBeNull();
    expect(log.find("task", 5, "2026-08-23")).toEqual(entry);
  });

  it("marks an entry missed with an explicit reason, terminal", () => {
    const entry = log.markMissed("appointment", 2, "2026-08-20", "window closed before delivery");

    expect(entry.status).toBe("missed");
    expect(entry.missedReason).toBe("window closed before delivery");
    expect(log.find("appointment", 2, "2026-08-20")).toEqual(entry);
  });

  it("sweeps a pending entry whose target date has passed into missed/'send failed'", () => {
    log.markFailed("task", 7, "2026-08-20");

    const swept = log.sweepMissed("2026-08-21");

    expect(swept).toHaveLength(1);
    expect(swept[0].status).toBe("missed");
    expect(swept[0].missedReason).toBe("send failed");
    expect(log.find("task", 7, "2026-08-20")?.status).toBe("missed");
  });

  it("sweeps into missed/'send failed' after multiple retries, not just one attempt", () => {
    log.markFailed("task", 10, "2026-08-20");
    log.markFailed("task", 10, "2026-08-20");
    log.markFailed("task", 10, "2026-08-20");

    const swept = log.sweepMissed("2026-08-21");

    expect(swept[0].attempts).toBe(3);
    expect(swept[0].status).toBe("missed");
    expect(swept[0].missedReason).toBe("send failed");
  });

  it("treats sent and missed as terminal: a later mark call on the same key is a no-op", () => {
    log.markSent("task", 11, "2026-08-20");
    const afterMissedAttempt = log.markMissed("task", 11, "2026-08-20", "send failed");
    expect(afterMissedAttempt.status).toBe("sent");

    log.markMissed("appointment", 12, "2026-08-20", "window closed before delivery");
    const afterSentAttempt = log.markSent("appointment", 12, "2026-08-20");
    expect(afterSentAttempt.status).toBe("missed");
    expect(afterSentAttempt.missedReason).toBe("window closed before delivery");

    log.markSent("task", 13, "2026-08-20");
    const afterFailedAttempt = log.markFailed("task", 13, "2026-08-20");
    expect(afterFailedAttempt.status).toBe("sent");
  });

  it("leaves pending entries whose target date has not yet passed alone", () => {
    log.markFailed("task", 8, "2026-08-22");

    const swept = log.sweepMissed("2026-08-21");

    expect(swept).toHaveLength(0);
    expect(log.find("task", 8, "2026-08-22")?.status).toBe("pending");
  });

  it("does not sweep entries already sent", () => {
    log.markSent("task", 9, "2026-08-20");

    const swept = log.sweepMissed("2026-08-21");

    expect(swept).toHaveLength(0);
    expect(log.find("task", 9, "2026-08-20")?.status).toBe("sent");
  });

  it("lists pending entries, and only pending entries", () => {
    log.markFailed("task", 1, "2026-08-23");
    log.markSent("task", 2, "2026-08-23");
    log.markMissed("appointment", 3, "2026-08-20", "window closed before delivery");

    const pending = log.pending();

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ itemType: "task", itemId: 1, status: "pending" });
  });

  it("lists missed entries, and only missed entries", () => {
    log.markFailed("task", 1, "2026-08-23");
    log.markSent("task", 2, "2026-08-23");
    log.markMissed("appointment", 3, "2026-08-20", "window closed before delivery");

    const missed = log.missed();

    expect(missed).toHaveLength(1);
    expect(missed[0]).toMatchObject({
      itemType: "appointment",
      itemId: 3,
      status: "missed",
      missedReason: "window closed before delivery",
    });
  });
});
