import type { Database } from "better-sqlite3";
import { SharedTags } from "../doctors/SharedTags.js";

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

interface CandidateRow {
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

    const byNoteId = new Map<number, CandidateRow>();
    for (const row of [...byTag, ...byKeyword]) {
      byNoteId.set(row.noteId, row);
    }

    return Array.from(byNoteId.values())
      .sort((a, b) => (a.createTime < b.createTime ? 1 : a.createTime > b.createTime ? -1 : b.noteId - a.noteId))
      .map((r) => ({ noteId: r.noteId, title: r.title, createTime: r.createTime }));
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
  private findByMedicalTag(personTagIds: number[]): CandidateRow[] {
    const medicalTag = this.tags.findByName("medical");
    if (!medicalTag) return [];
    const medicalTagIds = this.subtreeTagIds(medicalTag.tagId);

    const medicalPlaceholders = medicalTagIds.map(() => "?").join(",");
    const personPlaceholders = personTagIds.map(() => "?").join(",");
    return this.db
      .prepare(
        `SELECT n.noteId, n.title, n.createTime FROM Notes n
         JOIN NoteTags medicalNt ON medicalNt.noteId = n.noteId AND medicalNt.tagId IN (${medicalPlaceholders})
         JOIN NoteTags personNt ON personNt.noteId = n.noteId AND personNt.tagId IN (${personPlaceholders})
         LEFT JOIN DocumentMeta dm ON dm.noteId = n.noteId
         WHERE dm.noteId IS NULL`,
      )
      .all(...medicalTagIds, ...personTagIds) as CandidateRow[];
  }

  /** Source 2: Notes with no medical tag at all, whose title matches a medical keyword, owned by an in-scope person, not yet adopted. */
  private findByTitleKeyword(personTagIds: number[]): CandidateRow[] {
    if (this.titleKeywords.length === 0) return [];

    const personPlaceholders = personTagIds.map(() => "?").join(",");
    const keywordConditions = this.titleKeywords.map(() => `n.title LIKE ? COLLATE NOCASE`).join(" OR ");
    const keywordParams = this.titleKeywords.map((k) => `%${k}%`);
    return this.db
      .prepare(
        `SELECT n.noteId, n.title, n.createTime FROM Notes n
         JOIN NoteTags personNt ON personNt.noteId = n.noteId AND personNt.tagId IN (${personPlaceholders})
         LEFT JOIN DocumentMeta dm ON dm.noteId = n.noteId
         WHERE dm.noteId IS NULL AND (${keywordConditions})`,
      )
      .all(...personTagIds, ...keywordParams) as CandidateRow[];
  }

  /** A tag and every tag nested under it, transitively (the "medical" subtree may itself have sub-categories, e.g. a pre-existing "medical/legacy-scans"). */
  private subtreeTagIds(rootTagId: number): number[] {
    const ids = [rootTagId];
    const children = this.db.prepare(`SELECT tagId FROM Tags WHERE parentId = ?`).all(rootTagId) as {
      tagId: number;
    }[];
    for (const child of children) {
      ids.push(...this.subtreeTagIds(child.tagId));
    }
    return ids;
  }
}
