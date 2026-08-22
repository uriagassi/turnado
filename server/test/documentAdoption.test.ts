import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { createDb } from "../src/db.js";
import { SharedTags } from "../src/doctors/SharedTags.js";
import { DocumentAdoption } from "../src/documents/DocumentAdoption.js";

describe("DocumentAdoption", () => {
  const tmpFiles: string[] = [];
  const openDbs: Database[] = [];

  afterEach(() => {
    for (const db of openDbs.splice(0)) {
      db.close();
    }
    for (const f of tmpFiles.splice(0)) {
      fs.rmSync(f, { force: true, recursive: true });
    }
  });

  function tmpDb(): Database {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "turnado-adopt-"));
    const p = path.join(dir, "test.sqlite");
    tmpFiles.push(dir);
    const db = createDb(p, 5000);
    openDbs.push(db);
    // The shared Notebooks/Notes/Attachments/DocumentMeta tables normally
    // get created by Documents.ts's ensureTables(); DocumentAdoption reads
    // them but doesn't own their schema, so tests recreate the minimal
    // subset here rather than pulling in the whole Documents class.
    db.exec(`
      CREATE TABLE IF NOT EXISTS Notes (
        noteId INTEGER PRIMARY KEY AUTOINCREMENT,
        notebookId INTEGER NOT NULL,
        title TEXT NOT NULL,
        noteData TEXT,
        createTime TEXT NOT NULL DEFAULT (date('now')),
        updateTime TEXT NOT NULL DEFAULT (date('now')),
        updatedBy TEXT
      );
      CREATE TABLE IF NOT EXISTS DocumentMeta (
        noteId INTEGER PRIMARY KEY,
        documentDate TEXT,
        doctorId INTEGER,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS NoteTags (
        noteId INTEGER NOT NULL,
        tagId INTEGER NOT NULL,
        PRIMARY KEY (noteId, tagId)
      );
    `);
    return db;
  }

  function insertNote(db: Database, title: string, createTime = "2026-01-01"): number {
    return Number(
      db
        .prepare(`INSERT INTO Notes (notebookId, title, createTime, updateTime) VALUES (1, ?, ?, ?)`)
        .run(title, createTime, createTime).lastInsertRowid,
    );
  }

  function tagNote(db: Database, noteId: number, tagId: number): void {
    db.prepare(`INSERT INTO NoteTags (noteId, tagId) VALUES (?, ?)`).run(noteId, tagId);
  }

  it("includes a note tagged under the existing 'medical' tag subtree, owned by an in-scope person", () => {
    const db = tmpDb();
    const tags = new SharedTags(db);
    const medicalTagId = tags.findOrCreatePath("medical");
    const personTagId = tags.findOrCreatePath("person/Alice");

    const noteId = insertNote(db, "Blood test results");
    tagNote(db, noteId, medicalTagId);
    tagNote(db, noteId, personTagId);

    const adoption = new DocumentAdoption(db, ["Alice"]);

    const candidates = adoption.discoverCandidates();

    expect(candidates).toEqual([expect.objectContaining({ noteId, title: "Blood test results" })]);
  });

  it("excludes a note that's already been adopted (has a DocumentMeta row)", () => {
    const db = tmpDb();
    const tags = new SharedTags(db);
    const medicalTagId = tags.findOrCreatePath("medical");
    const personTagId = tags.findOrCreatePath("person/Alice");

    const noteId = insertNote(db, "Already adopted document");
    tagNote(db, noteId, medicalTagId);
    tagNote(db, noteId, personTagId);
    db.prepare(`INSERT INTO DocumentMeta (noteId) VALUES (?)`).run(noteId);

    const adoption = new DocumentAdoption(db, ["Alice"]);

    expect(adoption.discoverCandidates()).toEqual([]);
  });

  it("includes a note tagged with a descendant of 'medical', not just 'medical' itself", () => {
    const db = tmpDb();
    const tags = new SharedTags(db);
    const legacyTagId = tags.findOrCreatePath("medical/legacy-scans");
    const personTagId = tags.findOrCreatePath("person/Alice");

    const noteId = insertNote(db, "Old scan, manually tagged under a medical subcategory");
    tagNote(db, noteId, legacyTagId);
    tagNote(db, noteId, personTagId);

    const adoption = new DocumentAdoption(db, ["Alice"]);

    expect(adoption.discoverCandidates()).toEqual([expect.objectContaining({ noteId })]);
  });

  it("includes a note with no medical tag at all, whose title matches a medical keyword", () => {
    const db = tmpDb();
    const tags = new SharedTags(db);
    const personTagId = tags.findOrCreatePath("person/Alice");

    const noteId = insertNote(db, "Referral to cardiology");
    tagNote(db, noteId, personTagId);

    const adoption = new DocumentAdoption(db, ["Alice"]);

    expect(adoption.discoverCandidates()).toEqual([expect.objectContaining({ noteId })]);
  });

  it("orders the merged candidates newest-first, across both discovery sources", () => {
    const db = tmpDb();
    const tags = new SharedTags(db);
    const medicalTagId = tags.findOrCreatePath("medical");
    const personTagId = tags.findOrCreatePath("person/Alice");

    const oldest = insertNote(db, "Referral from 2024", "2024-03-01");
    tagNote(db, oldest, personTagId);

    const middle = insertNote(db, "Tagged note from 2025", "2025-06-15");
    tagNote(db, middle, medicalTagId);
    tagNote(db, middle, personTagId);

    const newest = insertNote(db, "Referral from 2026", "2026-01-10");
    tagNote(db, newest, personTagId);

    const adoption = new DocumentAdoption(db, ["Alice"]);

    expect(adoption.discoverCandidates().map((c) => c.noteId)).toEqual([newest, middle, oldest]);
  });

  it("guesses the doctor from an existing doctor-tag on the note, when one is present", () => {
    const db = tmpDb();
    const tags = new SharedTags(db);
    db.exec(`
      CREATE TABLE Doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tagId INTEGER NOT NULL
      );
    `);
    const doctorTagId = tags.findOrCreatePath("Dr. Cohen");
    const doctorId = Number(
      db.prepare(`INSERT INTO Doctors (name, tagId) VALUES (?, ?)`).run("Dr. Cohen", doctorTagId)
        .lastInsertRowid,
    );

    const noteId = insertNote(db, "Some untitled scan result");
    tagNote(db, noteId, doctorTagId);

    const adoption = new DocumentAdoption(db, ["Alice"]);

    expect(adoption.guessDoctorId(noteId, "Some untitled scan result")).toBe(doctorId);
  });

  it("falls back to parsing the title for a known doctor's name, when the note has no doctor-tag", () => {
    const db = tmpDb();
    const tags = new SharedTags(db);
    db.exec(`
      CREATE TABLE Doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tagId INTEGER NOT NULL
      );
    `);
    const doctorTagId = tags.findOrCreatePath("Dr. Cohen");
    const doctorId = Number(
      db.prepare(`INSERT INTO Doctors (name, tagId) VALUES (?, ?)`).run("Dr. Cohen", doctorTagId)
        .lastInsertRowid,
    );

    const noteId = insertNote(db, "Referral letter from Dr. Cohen");

    const adoption = new DocumentAdoption(db, ["Alice"]);

    expect(adoption.guessDoctorId(noteId, "Referral letter from Dr. Cohen")).toBe(doctorId);
  });

  it("returns null when the note has no doctor-tag and no known doctor's name in the title", () => {
    const db = tmpDb();
    db.exec(`
      CREATE TABLE Doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tagId INTEGER NOT NULL
      );
    `);
    const noteId = insertNote(db, "Quarterly pension statement");

    const adoption = new DocumentAdoption(db, ["Alice"]);

    expect(adoption.guessDoctorId(noteId, "Quarterly pension statement")).toBeNull();
  });

  it("excludes a note owned by a person outside the configured in-scope list", () => {
    const db = tmpDb();
    const tags = new SharedTags(db);
    const medicalTagId = tags.findOrCreatePath("medical");
    const otherPersonTagId = tags.findOrCreatePath("person/Someone Else");

    const noteId = insertNote(db, "Someone else's medical note");
    tagNote(db, noteId, medicalTagId);
    tagNote(db, noteId, otherPersonTagId);

    const adoption = new DocumentAdoption(db, ["Alice"]);

    expect(adoption.discoverCandidates()).toEqual([]);
  });
});
