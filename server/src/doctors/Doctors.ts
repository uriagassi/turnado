import type { Database, Statement } from "better-sqlite3";
import { SharedTags } from "./SharedTags.js";

export interface DoctorInput {
  name: string;
  specialty?: string;
  clinic?: string;
  phone?: string;
  address?: string;
  email?: string;
  notes?: string;
}

export interface Doctor extends DoctorInput {
  id: number;
  /** The adopted/created row in the shared Tags table (see findOrCreateDoctorTag). */
  tagId: number;
  /**
   * Path to the doctor's photo on disk, relative to the configured photos
   * directory (see setPhoto / the /api/doctors/:id/photo route) — null until
   * one's been uploaded. Deliberately separate from DoctorInput: unlike the
   * shared-system Attachments the sibling app manages, this app owns the
   * file directly, so it's set only via setPhoto, not create/update.
   */
  photoPath: string | null;
}

export class DoctorNotFoundError extends Error {
  constructor(id: number) {
    super(`Doctor ${id} not found`);
    this.name = "DoctorNotFoundError";
  }
}

export class InvalidDoctorInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDoctorInputError";
  }
}

/**
 * The household's doctor directory. Owns the `Doctors` table outright (unlike
 * the shared `Tags` table — see SharedTags.ts) in the same physical DB file,
 * so it follows the sibling app's existing table-naming style (`Tags`,
 * `Notes`, ...) for consistency.
 *
 * Every Doctor is backed by a row in the shared `Tags` table (via SharedTags),
 * so tagging a document with a doctor's name in the sibling document-archive
 * app links it to that doctor transparently.
 */
export class Doctors {
  private readonly tags: SharedTags;
  private readonly insertDoctor: Statement;
  private readonly getDoctor: Statement;
  private readonly listDoctors: Statement;
  private readonly updateDoctor: Statement;
  private readonly updatePhotoStmt: Statement;

  private readonly parentTagName: string;

  constructor(db: Database, parentTagName: string) {
    this.parentTagName = parentTagName;
    this.tags = new SharedTags(db);
    db.exec(`
      CREATE TABLE IF NOT EXISTS Doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialty TEXT,
        clinic TEXT,
        phone TEXT,
        address TEXT,
        email TEXT,
        notes TEXT,
        tagId INTEGER NOT NULL REFERENCES Tags(tagId),
        photoPath TEXT
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
    this.updatePhotoStmt = db.prepare(`UPDATE Doctors SET photoPath = $photoPath WHERE id = $id`);
  }

  create(input: DoctorInput): Doctor {
    this.validate(input);
    const tagId = this.findOrCreateDoctorTag(input.name);
    const result = this.insertDoctor.run({
      name: input.name,
      specialty: input.specialty ?? null,
      clinic: input.clinic ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
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
    const existing = this.getOrThrow(id);
    this.validate(input);
    this.updateDoctor.run({
      id,
      name: input.name,
      specialty: input.specialty ?? null,
      clinic: input.clinic ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
    });
    // Renames the adopted tag in place rather than adopting/creating a
    // different one for the new name, so existing tag links (e.g. from the
    // sibling document-archive app) never desync from this doctor.
    this.tags.rename(existing.tagId, input.name);
    return this.getDoctor.get(id) as Doctor;
  }

  /** Records where this doctor's uploaded photo lives on disk (see the /api/doctors/:id/photo route, which owns the actual file write, including removing the previous file). */
  setPhoto(id: number, photoPath: string): Doctor {
    this.getOrThrow(id);
    this.updatePhotoStmt.run({ id, photoPath });
    return this.getDoctor.get(id) as Doctor;
  }

  private getOrThrow(id: number): Doctor {
    const existing = this.getDoctor.get(id) as Doctor | undefined;
    if (!existing) throw new DoctorNotFoundError(id);
    return existing;
  }

  private validate(input: DoctorInput): void {
    if (!input.name?.trim()) throw new InvalidDoctorInputError("name is required");
  }

  /**
   * Adopts an existing Tags row with this exact name (e.g. from prior manual
   * tagging in the sibling document-archive app) instead of creating a
   * duplicate, so a Doctor and a pre-existing tag of the same name converge
   * on one tagId. An adopted tag's existing parent (or lack of one) is left
   * untouched — only a newly created tag is nested under the configured
   * parent tag.
   */
  private findOrCreateDoctorTag(name: string): number {
    const existing = this.tags.findByName(name);
    if (existing) return existing.tagId;
    const parentId = this.findOrCreateParentTagId();
    return this.tags.create(name, parentId);
  }

  /** Every newly created doctor tag nests under this shared parent tag (adopted-or-created the same way). */
  private findOrCreateParentTagId(): number {
    return this.tags.findOrCreatePath(this.parentTagName);
  }
}
