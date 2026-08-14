import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { createDb } from "../src/db.js";
import { Doctors, DoctorNotFoundError, InvalidDoctorInputError } from "../src/doctors/Doctors.js";

const PARENT_TAG_NAME = "Physicians";

describe("Doctors", () => {
  const tmpFiles: string[] = [];
  const openDbs: Database[] = [];

  afterEach(() => {
    for (const db of openDbs.splice(0)) {
      db.close();
    }
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

  function tmpDoctors() {
    return new Doctors(tmpDb(), PARENT_TAG_NAME);
  }

  /**
   * `expect(fn).toThrow(SomeClass)` passes vacuously (matches *any* thrown
   * error) if `SomeClass` isn't actually the constructor it looks like —
   * this captures the real thrown value so `toBeInstanceOf` checks it for real.
   */
  function catchError(fn: () => void): unknown {
    try {
      fn();
    } catch (e) {
      return e;
    }
    return undefined;
  }

  describe("create", () => {
    it("stores the given fields and returns them back with a generated id", () => {
      const doctors = tmpDoctors();

      const created = doctors.create({
        name: "Dr. Jane Smith",
        specialty: "Cardiology",
        clinic: "Riverside Clinic",
        phone: "555-1234",
        address: "12 Elm St",
        email: "jane.smith@example.com",
        notes: "Prefers morning appointments",
      });

      expect(created.id).toBeTypeOf("number");
      expect(created).toMatchObject({
        name: "Dr. Jane Smith",
        specialty: "Cardiology",
        clinic: "Riverside Clinic",
        phone: "555-1234",
        address: "12 Elm St",
        email: "jane.smith@example.com",
        notes: "Prefers morning appointments",
      });
    });
  });

  describe("list", () => {
    it("returns every created doctor", () => {
      const doctors = tmpDoctors();
      const smith = doctors.create({ name: "Dr. Jane Smith", notes: "Family physician" });
      const lee = doctors.create({ name: "Dr. Amy Lee", notes: "Pediatrician" });

      const all = doctors.list();

      expect(all).toHaveLength(2);
      expect(all.map((d) => d.id).sort()).toEqual([smith.id, lee.id].sort());
    });

    it("returns an empty list when no doctors exist yet", () => {
      const doctors = tmpDoctors();

      expect(doctors.list()).toEqual([]);
    });
  });

  describe("update", () => {
    it("overwrites the doctor's fields and keeps its id", () => {
      const doctors = tmpDoctors();
      const created = doctors.create({ name: "Dr. Jane Smith", notes: "Family physician" });

      const updated = doctors.update(created.id, {
        name: "Dr. Jane A. Smith",
        specialty: "Cardiology",
        notes: "Now sees cardiology patients only",
      });

      expect(updated).toMatchObject({
        id: created.id,
        name: "Dr. Jane A. Smith",
        specialty: "Cardiology",
        notes: "Now sees cardiology patients only",
      });
      expect(doctors.list()).toHaveLength(1);
    });

    it("throws DoctorNotFoundError for an id that doesn't exist, instead of crashing", () => {
      const doctors = tmpDoctors();

      const thrown = catchError(() => doctors.update(999, { name: "Dr. Nobody", notes: "n/a" }));

      expect(thrown).toBeInstanceOf(DoctorNotFoundError);
    });
  });

  describe("validation", () => {
    it("create rejects a missing name", () => {
      const doctors = tmpDoctors();

      const thrown = catchError(() => doctors.create({ name: "", notes: "Family physician" }));

      expect(thrown).toBeInstanceOf(InvalidDoctorInputError);
    });

    it("create rejects missing notes", () => {
      const doctors = tmpDoctors();

      const thrown = catchError(() => doctors.create({ name: "Dr. Jane Smith", notes: "" }));

      expect(thrown).toBeInstanceOf(InvalidDoctorInputError);
    });

    it("update rejects a missing name the same way", () => {
      const doctors = tmpDoctors();
      const created = doctors.create({ name: "Dr. Jane Smith", notes: "Family physician" });

      const thrown = catchError(() => doctors.update(created.id, { name: "  ", notes: "Family physician" }));

      expect(thrown).toBeInstanceOf(InvalidDoctorInputError);
    });
  });

  describe("tag lifecycle", () => {
    it("creates a new shared tag when no tag with the doctor's name exists yet", () => {
      const db = tmpDb();
      const doctors = new Doctors(db, PARENT_TAG_NAME);

      const created = doctors.create({ name: "Dr. Jane Smith", notes: "Family physician" });

      const tag = db.prepare("SELECT tagId, name FROM Tags WHERE tagId = ?").get(created.tagId);
      expect(tag).toEqual({ tagId: created.tagId, name: "Dr. Jane Smith" });
    });

    it("nests a newly created tag under the configured parent tag, creating the parent tag if needed", () => {
      const db = tmpDb();
      const doctors = new Doctors(db, PARENT_TAG_NAME);

      const created = doctors.create({ name: "Dr. Jane Smith", notes: "Family physician" });

      const tags = db.prepare("SELECT tagId, name, parentId FROM Tags").all() as {
        tagId: number;
        name: string;
        parentId: number | null;
      }[];
      const parentTag = tags.find((t) => t.name === PARENT_TAG_NAME);
      expect(parentTag).toBeDefined();
      expect(parentTag!.parentId).toBeNull();
      const doctorTag = tags.find((t) => t.tagId === created.tagId);
      expect(doctorTag!.parentId).toBe(parentTag!.tagId);
    });

    it("reuses the same parent tag across multiple doctors instead of creating a duplicate", () => {
      const db = tmpDb();
      const doctors = new Doctors(db, PARENT_TAG_NAME);

      doctors.create({ name: "Dr. Jane Smith", notes: "Family physician" });
      doctors.create({ name: "Dr. Amy Lee", notes: "Pediatrician" });

      const parentTags = db.prepare("SELECT tagId FROM Tags WHERE name = ?").all(PARENT_TAG_NAME);
      expect(parentTags).toHaveLength(1);
    });

    it("adopts an existing tag with a matching name instead of creating a duplicate", () => {
      const db = tmpDb();
      const doctors = new Doctors(db, PARENT_TAG_NAME);
      // Simulate prior manual tagging in the sibling document-archive app:
      // a "Dr. Jane Smith" tag already exists before the Doctor record does.
      const existingTagId = db
        .prepare("INSERT INTO Tags (name, isExpanded) VALUES (?, 0)")
        .run("Dr. Jane Smith").lastInsertRowid;

      const created = doctors.create({ name: "Dr. Jane Smith", notes: "Family physician" });

      expect(created.tagId).toBe(Number(existingTagId));
      const tags = db.prepare("SELECT tagId, name FROM Tags").all();
      expect(tags).toHaveLength(1);
    });

    it("leaves an adopted tag's existing parent untouched instead of reparenting it under the configured parent tag", () => {
      const db = tmpDb();
      const doctors = new Doctors(db, PARENT_TAG_NAME);
      // A prior manual tag, already filed under some other parent.
      const otherParentId = db.prepare("INSERT INTO Tags (name, isExpanded) VALUES (?, 0)").run("Household").lastInsertRowid;
      db.prepare("INSERT INTO Tags (name, parentId, isExpanded) VALUES (?, ?, 0)").run("Dr. Jane Smith", otherParentId);

      doctors.create({ name: "Dr. Jane Smith", notes: "Family physician" });

      const tag = db.prepare("SELECT parentId FROM Tags WHERE name = ?").get("Dr. Jane Smith") as {
        parentId: number | null;
      };
      expect(tag.parentId).toBe(Number(otherParentId));
      const parentTags = db.prepare("SELECT tagId FROM Tags WHERE name = ?").all(PARENT_TAG_NAME);
      expect(parentTags).toHaveLength(0);
    });

    it("renaming a doctor updates the adopted tag's name without changing its id", () => {
      const db = tmpDb();
      const doctors = new Doctors(db, PARENT_TAG_NAME);
      const created = doctors.create({ name: "Dr. Jane Smith", notes: "Family physician" });

      const updated = doctors.update(created.id, {
        name: "Dr. Jane A. Smith",
        notes: "Family physician",
      });

      expect(updated.tagId).toBe(created.tagId);
      const tag = db.prepare("SELECT tagId, name FROM Tags WHERE tagId = ?").get(created.tagId);
      expect(tag).toEqual({ tagId: created.tagId, name: "Dr. Jane A. Smith" });
    });
  });
});
