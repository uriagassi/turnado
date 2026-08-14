import type { Database, Statement } from "better-sqlite3";

export interface DoctorInput {
  name: string;
  specialty?: string;
  clinic?: string;
  phone?: string;
  address?: string;
  email?: string;
  notes: string;
}

export interface Doctor extends DoctorInput {
  id: number;
  /** The adopted/created row in the shared Tags table (see findOrCreateTag). */
  tagId: number;
}

/**
 * The household's doctor directory. Owns the `Doctors` table outright (unlike
 * `Tags`, which the sibling document-archive app owns — see docs/agents/domain.md
 * on the shared DB) in the same physical DB file, so it follows that app's
 * existing table-naming style (`Tags`, `Notes`, ...) for consistency.
 *
 * Every Doctor is backed by a row in the shared `Tags` table, so tagging a
 * document with a doctor's name in the sibling document-archive app links it
 * to that doctor transparently. `CREATE TABLE IF NOT EXISTS` for `Tags`
 * mirrors that app's own schema exactly (idempotent) so this app works even
 * if it's the first of the two to touch a fresh DB file.
 */
export class Doctors {
  private readonly insertDoctor: Statement;
  private readonly getDoctor: Statement;
  private readonly listDoctors: Statement;
  private readonly updateDoctor: Statement;
  private readonly findTagByName: Statement;
  private readonly insertTag: Statement;
  private readonly renameTag: Statement;

  private readonly parentTagName: string;

  constructor(db: Database, parentTagName: string) {
    this.parentTagName = parentTagName;
    db.exec(`
      CREATE TABLE IF NOT EXISTS "Tags" (
        "tagId" INTEGER NOT NULL CONSTRAINT "PK_Tags" PRIMARY KEY AUTOINCREMENT,
        "parentId" INTEGER NULL,
        "name" TEXT NOT NULL,
        "isExpanded" INTEGER NOT NULL,
        CONSTRAINT "FK_Tags_Tags_ParentTagTagId" FOREIGN KEY ("parentId") REFERENCES "Tags" ("tagId") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "IX_Tags_Name" ON "Tags" ("name");

      CREATE TABLE IF NOT EXISTS Doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialty TEXT,
        clinic TEXT,
        phone TEXT,
        address TEXT,
        email TEXT,
        notes TEXT NOT NULL,
        tagId INTEGER NOT NULL REFERENCES Tags(tagId)
      )
    `);
    this.insertDoctor = db.prepare(
      `INSERT INTO Doctors (name, specialty, clinic, phone, address, email, notes, tagId)
       VALUES ($name, $specialty, $clinic, $phone, $address, $email, $notes, $tagId)`,
    );
    this.getDoctor = db.prepare(`SELECT * FROM Doctors WHERE id = ?`);
    this.listDoctors = db.prepare(`SELECT * FROM Doctors ORDER BY name`);
    this.updateDoctor = db.prepare(
      `UPDATE Doctors
       SET name = $name, specialty = $specialty, clinic = $clinic, phone = $phone,
           address = $address, email = $email, notes = $notes
       WHERE id = $id`,
    );
    this.findTagByName = db.prepare(`SELECT tagId FROM Tags WHERE name = ?`);
    this.insertTag = db.prepare(`INSERT INTO Tags (name, parentId, isExpanded) VALUES ($name, $parentId, 0)`);
    this.renameTag = db.prepare(`UPDATE Tags SET name = ? WHERE tagId = ?`);
  }

  create(input: DoctorInput): Doctor {
    const tagId = this.findOrCreateTag(input.name);
    const result = this.insertDoctor.run({
      name: input.name,
      specialty: input.specialty ?? null,
      clinic: input.clinic ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      email: input.email ?? null,
      notes: input.notes,
      tagId,
    });
    return this.getDoctor.get(result.lastInsertRowid) as Doctor;
  }

  get(id: number): Doctor | undefined {
    return this.getDoctor.get(id) as Doctor | undefined;
  }

  list(): Doctor[] {
    return this.listDoctors.all() as Doctor[];
  }

  update(id: number, input: DoctorInput): Doctor {
    const existing = this.getDoctor.get(id) as Doctor;
    this.updateDoctor.run({
      id,
      name: input.name,
      specialty: input.specialty ?? null,
      clinic: input.clinic ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      email: input.email ?? null,
      notes: input.notes,
    });
    // Renames the adopted tag in place rather than adopting/creating a
    // different one for the new name, so existing tag links (e.g. from the
    // sibling document-archive app) never desync from this doctor.
    this.renameTag.run(input.name, existing.tagId);
    return this.getDoctor.get(id) as Doctor;
  }

  /**
   * Adopts an existing Tags row with this exact name (e.g. from prior manual
   * tagging in the sibling document-archive app) instead of creating a
   * duplicate, so a Doctor and a pre-existing tag of the same name converge
   * on one tagId. An adopted tag's existing parent (or lack of one) is left
   * untouched — only a newly created tag is nested under the configured
   * parent tag.
   */
  private findOrCreateTag(name: string): number {
    const existing = this.findTagByName.get(name) as { tagId: number } | undefined;
    if (existing) return existing.tagId;
    const parentId = this.findOrCreateParentTag();
    return this.insertTag.run({ name, parentId }).lastInsertRowid as number;
  }

  /** Every newly created doctor tag nests under this shared parent tag (adopted-or-created the same way). */
  private findOrCreateParentTag(): number {
    const existing = this.findTagByName.get(this.parentTagName) as { tagId: number } | undefined;
    if (existing) return existing.tagId;
    return this.insertTag.run({ name: this.parentTagName, parentId: null }).lastInsertRowid as number;
  }
}
