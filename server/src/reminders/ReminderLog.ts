import type { Database, Statement } from "better-sqlite3";
import type { ReminderItemType } from "./dueReminders.js";

export type ReminderLogStatus = "pending" | "sent" | "missed";
export type MissedReason = "send failed" | "window closed before delivery";

export interface ReminderLogEntry {
  id: number;
  itemType: ReminderItemType;
  itemId: number;
  targetDate: string;
  status: ReminderLogStatus;
  attempts: number;
  missedReason: MissedReason | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dedup/retry ledger for issue #10's reminders, keyed on (itemType, itemId,
 * targetDate) per the AC — a rescheduled date is a new key with no reset
 * logic needed. One row per key; status moves pending -> sent|missed and
 * never back, so a caller can always trust a non-"pending" row as final.
 */
export class ReminderLog {
  private readonly findStmt: Statement;
  private readonly markFailedStmt: Statement;
  private readonly markSentStmt: Statement;
  private readonly markMissedStmt: Statement;
  private readonly pastDuePendingStmt: Statement;
  private readonly sweepOneMissedStmt: Statement;
  private readonly listPendingStmt: Statement;
  private readonly listMissedStmt: Statement;

  constructor(db: Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ReminderLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemType TEXT NOT NULL,
        itemId INTEGER NOT NULL,
        targetDate TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        missedReason TEXT,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(itemType, itemId, targetDate)
      )
    `);

    this.findStmt = db.prepare(
      `SELECT * FROM ReminderLog WHERE itemType = ? AND itemId = ? AND targetDate = ?`
    );

    // Every ON CONFLICT below guards its DO UPDATE with "WHERE status =
    // 'pending'": once a row reaches "sent" or "missed" it's terminal (per
    // the AC), and without the guard a stray call on an already-terminal
    // key would silently flip it back — SQLite just skips the update when
    // the WHERE is false, so this is a no-op on a terminal row rather than
    // an error.
    this.markFailedStmt = db.prepare(`
      INSERT INTO ReminderLog (itemType, itemId, targetDate, status, attempts)
      VALUES ($itemType, $itemId, $targetDate, 'pending', 1)
      ON CONFLICT(itemType, itemId, targetDate) DO UPDATE SET
        attempts = attempts + 1,
        updatedAt = datetime('now')
      WHERE status = 'pending'
    `);

    this.markSentStmt = db.prepare(`
      INSERT INTO ReminderLog (itemType, itemId, targetDate, status, attempts)
      VALUES ($itemType, $itemId, $targetDate, 'sent', 1)
      ON CONFLICT(itemType, itemId, targetDate) DO UPDATE SET
        status = 'sent',
        attempts = attempts + 1,
        updatedAt = datetime('now')
      WHERE status = 'pending'
    `);

    this.markMissedStmt = db.prepare(`
      INSERT INTO ReminderLog (itemType, itemId, targetDate, status, attempts, missedReason)
      VALUES ($itemType, $itemId, $targetDate, 'missed', 0, $reason)
      ON CONFLICT(itemType, itemId, targetDate) DO UPDATE SET
        status = 'missed',
        missedReason = $reason,
        updatedAt = datetime('now')
      WHERE status = 'pending'
    `);

    this.pastDuePendingStmt = db.prepare(
      `SELECT * FROM ReminderLog WHERE status = 'pending' AND targetDate < ?`
    );
    this.sweepOneMissedStmt = db.prepare(`
      UPDATE ReminderLog SET status = 'missed', missedReason = 'send failed', updatedAt = datetime('now')
      WHERE itemType = ? AND itemId = ? AND targetDate = ?
    `);

    this.listPendingStmt = db.prepare(
      `SELECT * FROM ReminderLog WHERE status = 'pending' ORDER BY targetDate ASC, id ASC`
    );
    this.listMissedStmt = db.prepare(
      `SELECT * FROM ReminderLog WHERE status = 'missed' ORDER BY targetDate ASC, id ASC`
    );
  }

  find(itemType: ReminderItemType, itemId: number, targetDate: string): ReminderLogEntry | undefined {
    return this.findStmt.get(itemType, itemId, targetDate) as ReminderLogEntry | undefined;
  }

  /** Records a failed send attempt, creating the entry on its first attempt. Stays "pending" — eligible for retry. */
  markFailed(itemType: ReminderItemType, itemId: number, targetDate: string): ReminderLogEntry {
    return this.runAndFetch(this.markFailedStmt, { itemType, itemId, targetDate }, itemType, itemId, targetDate);
  }

  /** Marks the entry sent — terminal, no further attempts. Creates the entry if this is somehow the first record of it. */
  markSent(itemType: ReminderItemType, itemId: number, targetDate: string): ReminderLogEntry {
    return this.runAndFetch(this.markSentStmt, { itemType, itemId, targetDate }, itemType, itemId, targetDate);
  }

  /**
   * Marks the entry missed with an explicit reason — terminal. Reason
   * derivation ("send failed" vs "window closed before delivery") is the
   * caller's job: an entry with prior attempts implies "send failed", but
   * "window closed before delivery" applies to items this log may never
   * have seen at all (the server was down for their entire due window), so
   * ReminderLog can't always derive the reason from its own rows — see
   * sweepMissed() for the one case it can derive automatically.
   */
  markMissed(
    itemType: ReminderItemType,
    itemId: number,
    targetDate: string,
    reason: MissedReason,
  ): ReminderLogEntry {
    return this.runAndFetch(
      this.markMissedStmt,
      { itemType, itemId, targetDate, reason },
      itemType,
      itemId,
      targetDate,
    );
  }

  /**
   * Auto-transitions every still-pending entry whose targetDate has already
   * passed `today` into "missed"/"send failed" — the one reason this log
   * can derive on its own, since a pending row only exists here after at
   * least one recorded attempt (see markFailed). The other reason, "window
   * closed before delivery", covers items this log never saw an attempt
   * for at all; that's outside what a sweep over existing rows can find,
   * so the caller marks those directly via markMissed().
   */
  sweepMissed(today: string): ReminderLogEntry[] {
    const pastDue = this.pastDuePendingStmt.all(today) as any[];
    return pastDue.map((row) =>
      this.runAndFetch(this.sweepOneMissedStmt, [row.itemType, row.itemId, row.targetDate], row.itemType, row.itemId, row.targetDate),
    );
  }

  /** Entries still needing a (re)send attempt — seam 5's ReminderService iterates this each tick. */
  pending(): ReminderLogEntry[] {
    return this.listPendingStmt.all() as ReminderLogEntry[];
  }

  /** Terminally missed entries, with their reason — the read seam a future route-level marker will query. */
  missed(): ReminderLogEntry[] {
    return this.listMissedStmt.all() as ReminderLogEntry[];
  }

  // Every write method here is "run the statement, then refetch the row by
  // key" — pulled out once so markFailed/markSent/markMissed/sweepMissed
  // don't each repeat the pairing.
  private runAndFetch(
    stmt: Statement,
    params: Record<string, unknown> | unknown[],
    itemType: ReminderItemType,
    itemId: number,
    targetDate: string,
  ): ReminderLogEntry {
    if (Array.isArray(params)) {
      stmt.run(...params);
    } else {
      stmt.run(params);
    }
    return this.find(itemType, itemId, targetDate)!;
  }
}
