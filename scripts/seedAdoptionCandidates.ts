// Dev-only fixture data for exercising scripts/adoptDocuments.ts (issue
// #14) against the real configured dev DB (config/local.json's db.path) —
// same idea as scripts/seedDemo.ts, but for the archive-side data the
// adoption tool discovers rather than this app's own Appointments/Tasks.
//
// Inserts a handful of "pre-existing archive Note" rows directly (bypassing
// Documents.create(), since a genuine adoption candidate is by definition a
// Note this app never wrote), covering each discovery/guessing path:
//   - tag-subtree source (direct "medical" tag, and a nested descendant)
//   - title-keyword source (English "referral", Hebrew "אישור")
//   - existing doctor-tag vs. title-parsed doctor guess
//   - an out-of-scope person (should never surface)
//   - an already-adopted note (should never resurface)
//
// Idempotent: every fixture Note also carries a "dev-fixture/adoption-
// candidates" marker tag, and re-running this script deletes anything
// already carrying that tag before inserting fresh rows — re-running it
// (by hand, or by anything else that decides to) can't silently double up
// fixtures the way a plain unconditional INSERT would.
//
// Run: npx tsx scripts/seedAdoptionCandidates.ts
import config from "../server/src/config.js";
import { createDb } from "../server/src/db.js";
import { expandHome } from "../server/src/paths.js";
import { SharedTags } from "../server/src/doctors/SharedTags.js";
import { Doctors } from "../server/src/doctors/Doctors.js";
import { isolate } from "./terminalText.js";

const dbPath = expandHome(config.get<string>("db.path"));
const db = createDb(dbPath, config.get<number>("db.busyTimeoutMs"));

const tags = new SharedTags(db);
const doctors = new Doctors(db, "medical/doctors");

const fixtureMarkerTagId = tags.findOrCreatePath("dev-fixture/adoption-candidates");

const previouslySeededNoteIds = (
  db.prepare(`SELECT noteId FROM NoteTags WHERE tagId = ?`).all(fixtureMarkerTagId) as { noteId: number }[]
).map((r) => r.noteId);

if (previouslySeededNoteIds.length > 0) {
  const placeholders = previouslySeededNoteIds.map(() => "?").join(",");
  db.prepare(`DELETE FROM NoteTags WHERE noteId IN (${placeholders})`).run(...previouslySeededNoteIds);
  db.prepare(`DELETE FROM DocumentMeta WHERE noteId IN (${placeholders})`).run(...previouslySeededNoteIds);
  db.prepare(`DELETE FROM Notes WHERE noteId IN (${placeholders})`).run(...previouslySeededNoteIds);
  console.log(`Removed ${previouslySeededNoteIds.length} previously-seeded fixture Note(s) before reseeding.`);
}

// The "person/Dana" tag matches config/local.json's security.allowList
// .user-one.personTagName ("Dana") — see docs/handover-issue-14.md.
const danaTagId = tags.findOrCreatePath("person/Dana");
const guyTagId = tags.findOrCreatePath("person/Guy"); // deliberately NOT in personTagName scope

const medicalTagId = tags.findOrCreatePath("medical");
const legacyScansTagId = tags.findOrCreatePath("medical/legacy-scans");

// Reuse the existing "Dr. Dan Cohen" doctor if seedDemo/manual testing
// already created one; otherwise adopt-or-create it fresh.
const drCohen = doctors.list().find((d) => d.name === "Dr. Dan Cohen") ?? doctors.create({ name: "Dr. Dan Cohen" });

const archiveNotebookId = (
  db.prepare(`SELECT notebookId FROM Notebooks WHERE name = 'Archive'`).get() as { notebookId: number } | undefined
)?.notebookId ?? 1;

function insertNote(title: string, createTime: string): number {
  const noteId = Number(
    db
      .prepare(`INSERT INTO Notes (notebookId, title, createTime, updateTime) VALUES (?, ?, ?, ?)`)
      .run(archiveNotebookId, title, createTime, createTime).lastInsertRowid,
  );
  tagNote(noteId, fixtureMarkerTagId);
  return noteId;
}

function tagNote(noteId: number, tagId: number): void {
  db.prepare(`INSERT OR IGNORE INTO NoteTags (noteId, tagId) VALUES (?, ?)`).run(noteId, tagId);
}

// 1. Tag-subtree source, direct "medical" tag — no title keyword, so this
//    one is only findable via the tag scan.
const bloodTest = insertNote("Old lab printout", "2025-02-10");
tagNote(bloodTest, medicalTagId);
tagNote(bloodTest, danaTagId);

// 2. Tag-subtree source, nested descendant tag ("medical/legacy-scans").
const legacyScan = insertNote("2019 imaging, box 3", "2019-06-01");
tagNote(legacyScan, legacyScansTagId);
tagNote(legacyScan, danaTagId);

// 3. Title-keyword source (English) — untagged, and the title also
//    contains the existing doctor's name, exercising guessDoctorFromTitle's
//    title-parsing fallback (no doctor-tag on this Note at all).
const referral = insertNote("Referral letter from Dr. Dan Cohen", "2025-11-02");
tagNote(referral, danaTagId);

// 4. Title-keyword source (Hebrew).
const approval = insertNote("אישור ביטוח נסיעות לחו\"ל", "2026-01-15");
tagNote(approval, danaTagId);

// 5. Existing doctor-tag wins over title parsing: tagged directly with
//    Dr. Cohen's tag, title carries no name at all.
const taggedToDoctor = insertNote("Old test report", "2025-07-20");
tagNote(taggedToDoctor, medicalTagId);
tagNote(taggedToDoctor, danaTagId);
tagNote(taggedToDoctor, drCohen.tagId);

// 6. Out of scope: owned by "Guy", not an in-scope personTagName — must
//    never appear in discoverCandidates().
const otherPerson = insertNote("Guy's old scan", "2025-05-05");
tagNote(otherPerson, medicalTagId);
tagNote(otherPerson, guyTagId);

// 7. Already adopted: matches the tag-subtree source, but already has a
//    DocumentMeta row — must not resurface.
const alreadyAdopted = insertNote("Already-handled letter", "2025-03-03");
tagNote(alreadyAdopted, medicalTagId);
tagNote(alreadyAdopted, danaTagId);
db.prepare(`INSERT INTO DocumentMeta (noteId, documentDate, doctorId) VALUES (?, ?, ?)`).run(
  alreadyAdopted,
  "2025-03-03",
  drCohen.id,
);

console.log("Seeded adoption-candidate fixtures:");
console.log(`  ${bloodTest} "Old lab printout" — tag-subtree ("medical")`);
console.log(`  ${legacyScan} "2019 imaging, box 3" — tag-subtree (nested "medical/legacy-scans")`);
console.log(`  ${referral} "Referral letter from Dr. Dan Cohen" — title keyword, doctor guessed from title`);
console.log(`  ${approval} ${isolate("אישור ביטוח נסיעות לחו\"ל")} — title keyword (Hebrew)`);
console.log(`  ${taggedToDoctor} "Old test report" — tag-subtree, doctor guessed from existing doctor-tag`);
console.log(`  ${otherPerson} "Guy's old scan" — should NOT appear (out-of-scope person)`);
console.log(`  ${alreadyAdopted} "Already-handled letter" — should NOT appear (already adopted)`);
console.log(`\nExpect 5 candidates from: npx tsx scripts/adoptDocuments.ts`);

db.close();
