import type { Database } from "better-sqlite3";
import { SharedTags } from "../doctors/SharedTags.js";
import { guessDoctorFromTitle } from "./guessDoctor.js";

/**
 * Default title keywords for the second candidate-discovery source (issue
 * #14): catches a medical-looking document that was never tagged at all in
 * the existing archive. Bilingual (en/he), matching this app's own i18n
 * scope. Deliberately just the ladder's cheapest rung — a plain
 * case-insensitive substring match — since a human reviews every match
 * before anything commits, so false positives cost a "skip", not a bad
 * write.
 */
const DEFAULT_TITLE_KEYWORDS = [
  "referral",
  "prescription",
  "diagnosis",
  "clinic",
  "hospital",
  "doctor",
  "blood test",
  "x-ray",
  "mri",
  "form 17",
  "הפניה",
  "מרשם",
  "אבחון",
  "מרפאה",
  "בית חולים",
  "רופא",
  "בדיקת דם",
  "רנטגן",
  "טופס 17",
];

/** One historical Note the reviewer hasn't yet confirmed, corrected, or skipped (issue #14). */
export interface AdoptionCandidate {
  noteId: number;
  title: string;
  createTime: string;
}

/**
 * One-time discovery of historical medical documents already sitting in the
 * shared document archive, not yet promoted into this app's Document model
 * (issue #14). Reads the archive's `Notes`/`NoteTags`/`Tags`/`DocumentMeta`
 * tables directly rather than going through `Documents`, since a candidate
 * is by definition a Note `Documents` doesn't know about yet (no
 * `DocumentMeta` row).
 */
export class DocumentAdoption {
  private readonly db: Database;
  private readonly tags: SharedTags;
  private readonly personTagNames: string[];
  private readonly titleKeywords: string[];

  constructor(db: Database, personTagNames: string[], titleKeywords: string[] = DEFAULT_TITLE_KEYWORDS) {
    this.db = db;
    this.tags = new SharedTags(db);
    this.personTagNames = personTagNames;
    this.titleKeywords = titleKeywords;
  }

  /**
   * Unions the two candidate sources the AC calls for — everything under
   * the existing "medical" tag subtree, plus a title-keyword scan for
   * medical-looking Notes with no tag at all — filtered to in-scope
   * owners and not-yet-adopted Notes, newest-first.
   */
  discoverCandidates(): AdoptionCandidate[] {
    const personTagIds = this.inScopePersonTagIds();
    if (personTagIds.length === 0) return [];

    const byTag = this.findByMedicalTag(personTagIds);
    const byKeyword = this.findByTitleKeyword(personTagIds);

    const byNoteId = new Map<number, AdoptionCandidate>();
    for (const candidate of [...byTag, ...byKeyword]) {
      byNoteId.set(candidate.noteId, candidate);
    }

    return Array.from(byNoteId.values()).sort((a, b) =>
      a.createTime < b.createTime ? 1 : a.createTime > b.createTime ? -1 : b.noteId - a.noteId,
    );
  }

  /**
   * Guesses which doctor a candidate belongs to (issue #14): an existing
   * doctor-tag already on the Note wins first — it reflects a real prior
   * link, not a guess — falling back to matching a known doctor's name
   * against the free-text title only when no such tag is present.
   */
  guessDoctorId(noteId: number, title: string): number | null {
    const tagMatch = this.db
      .prepare(
        `SELECT d.id FROM Doctors d
         JOIN NoteTags nt ON nt.tagId = d.tagId
         WHERE nt.noteId = ?
         LIMIT 1`,
      )
      .get(noteId) as { id: number } | undefined;
    if (tagMatch) return tagMatch.id;

    const doctors = this.db.prepare(`SELECT id, name, tagId FROM Doctors`).all() as {
      id: number;
      name: string;
      tagId: number;
    }[];
    return guessDoctorFromTitle(title, doctors)?.id ?? null;
  }

  // Tag names are globally unique (Tags.name has a unique index — see
  // SharedTags.ts), so a person tag is looked up by its bare display name
  // regardless of where it's nested (e.g. under a "person" parent) — same
  // exact-name-match convention Doctors.ts already uses to adopt
  // pre-existing tags.
  private inScopePersonTagIds(): number[] {
    return this.personTagNames
      .map((name) => this.tags.findByName(name)?.tagId)
      .filter((id): id is number => id !== undefined);
  }

  /** Source 1: Notes under the existing "medical" tag subtree, owned by an in-scope person, not yet adopted. */
  private findByMedicalTag(personTagIds: number[]): AdoptionCandidate[] {
    const medicalTag = this.tags.findByName("medical");
    if (!medicalTag) return [];
    const medicalTagIds = this.tags.descendantIds(medicalTag.tagId);
    const medicalPlaceholders = medicalTagIds.map(() => "?").join(",");

    return this.findUnadoptedOwnedNotes(
      personTagIds,
      `JOIN NoteTags medicalNt ON medicalNt.noteId = n.noteId AND medicalNt.tagId IN (${medicalPlaceholders})`,
      medicalTagIds,
    );
  }

  /**
   * Source 2: Notes whose title matches a medical keyword, owned by an
   * in-scope person, not yet adopted. Doesn't itself exclude Notes that
   * also carry the "medical" tag — `discoverCandidates()`'s noteId-keyed
   * merge with source 1 is what keeps a doubly-matching Note from
   * appearing twice, rather than this query filtering it out.
   */
  private findByTitleKeyword(personTagIds: number[]): AdoptionCandidate[] {
    if (this.titleKeywords.length === 0) return [];

    const keywordConditions = this.titleKeywords.map(() => `n.title LIKE ? COLLATE NOCASE`).join(" OR ");
    const keywordParams = this.titleKeywords.map((k) => `%${k}%`);

    return this.findUnadoptedOwnedNotes(personTagIds, "", [], `AND (${keywordConditions})`, keywordParams);
  }

  /** Shared query shape both discovery sources need: unadopted Notes owned by an in-scope person, plus whatever extra join/predicate distinguishes the source. */
  private findUnadoptedOwnedNotes(
    personTagIds: number[],
    extraJoinSql: string,
    extraJoinParams: unknown[],
    extraWhereSql = "",
    extraWhereParams: unknown[] = [],
  ): AdoptionCandidate[] {
    const personPlaceholders = personTagIds.map(() => "?").join(",");
    return this.db
      .prepare(
        `SELECT n.noteId, n.title, n.createTime FROM Notes n
         ${extraJoinSql}
         JOIN NoteTags personNt ON personNt.noteId = n.noteId AND personNt.tagId IN (${personPlaceholders})
         LEFT JOIN DocumentMeta dm ON dm.noteId = n.noteId
         WHERE dm.noteId IS NULL ${extraWhereSql}`,
      )
      .all(...extraJoinParams, ...personTagIds, ...extraWhereParams) as AdoptionCandidate[];
  }
}
