import type { Database, Statement } from "better-sqlite3";

export interface SharedTag {
  tagId: number;
  parentId: number | null;
}

/**
 * Thin wrapper around the shared `Tags` table — owned by the sibling
 * document-archive app (see docs/agents/domain.md on the shared DB), not by
 * this app. Extracted out of Doctors.ts, which originally issued this SQL
 * directly on top of its own Doctors-table statements: code review flagged
 * that as reaching into a shared primitive from multiple places, the same
 * smell AllowList.ts's own header comment records being fixed the same way
 * (a small wrapper class) for the allow-list config.
 *
 * `CREATE TABLE IF NOT EXISTS` mirrors that app's own schema exactly
 * (idempotent) so this app works even if it's the first of the two to touch
 * a fresh DB file.
 */
export class SharedTags {
  private readonly findByNameStmt: Statement;
  private readonly insertStmt: Statement;
  private readonly renameStmt: Statement;

  constructor(db: Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "Tags" (
        "tagId" INTEGER NOT NULL CONSTRAINT "PK_Tags" PRIMARY KEY AUTOINCREMENT,
        "parentId" INTEGER NULL,
        "name" TEXT NOT NULL,
        "isExpanded" INTEGER NOT NULL,
        CONSTRAINT "FK_Tags_Tags_ParentTagTagId" FOREIGN KEY ("parentId") REFERENCES "Tags" ("tagId") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "IX_Tags_Name" ON "Tags" ("name");
    `);
    this.findByNameStmt = db.prepare(`SELECT tagId, parentId FROM Tags WHERE name = ?`);
    this.insertStmt = db.prepare(`INSERT INTO Tags (name, parentId, isExpanded) VALUES ($name, $parentId, 0)`);
    this.renameStmt = db.prepare(`UPDATE Tags SET name = ? WHERE tagId = ?`);
  }

  findByName(name: string): SharedTag | undefined {
    return this.findByNameStmt.get(name) as SharedTag | undefined;
  }

  create(name: string, parentId: number | null): number {
    return this.insertStmt.run({ name, parentId }).lastInsertRowid as number;
  }

  rename(tagId: number, name: string): void {
    this.renameStmt.run(name, tagId);
  }

  /**
   * Resolves a hierarchy of tags represented as a slash-separated path or array of names.
   * e.g. "medical/document-type" or ["medical", "document-type"]
   * 1. Finds or creates "medical" with parentId = null
   * 2. Finds or creates "document-type" with parentId = medical.tagId
   * Returns the tagId of the leaf tag ("document-type").
   */
  findOrCreatePath(pathOrNames: string | string[], rootParentId: number | null = null): number {
    const parts = Array.isArray(pathOrNames)
      ? pathOrNames.filter((p) => p && p.trim().length > 0)
      : pathOrNames.split("/").map((p) => p.trim()).filter((p) => p.length > 0);

    if (parts.length === 0) {
      throw new Error("Cannot create tag with empty path");
    }

    let currentParentId: number | null = rootParentId;
    for (const part of parts) {
      const existing = this.findByName(part);
      if (existing) {
        currentParentId = existing.tagId;
      } else {
        currentParentId = this.create(part, currentParentId);
      }
    }
    return currentParentId!;
  }
}
