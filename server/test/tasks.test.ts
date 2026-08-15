import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  Tasks,
  TaskNotFoundError,
  InvalidTaskInputError,
  TaskInput,
} from "../src/tasks/Tasks.js";

describe("Tasks domain model", () => {
  let db: Database.Database;
  let tasks: Tasks;

  beforeEach(() => {
    db = new Database(":memory:");
    tasks = new Tasks(db);
  });

  describe("create & get", () => {
    it("creates and retrieves a flexible test task with day-based recurrence window", () => {
      const input: TaskInput = {
        type: "test",
        title: "Blood test (CBC)",
        status: "open",
        dueDate: "2026-08-25",
        doctorId: null,
        requiresAdvanceScheduling: false,
        recurrenceWindow: "1-2 weeks",
        approximateDateWindow: "Late August",
      };

      const created = tasks.create(input);
      expect(created.id).toBeTypeOf("number");
      expect(created.type).toBe("test");
      expect(created.title).toBe("Blood test (CBC)");
      expect(created.status).toBe("open");
      expect(created.requiresAdvanceScheduling).toBe(false);
      expect(created.recurrenceWindow).toBe("1-2 weeks");
      expect(created.approximateDateWindow).toBe("Late August");

      const fetched = tasks.get(created.id);
      expect(fetched).toEqual(created);
    });

    it("creates and retrieves a doctor_visit task with required doctorId", () => {
      const input: TaskInput = {
        type: "doctor_visit",
        title: "Follow-up visit with neurologist",
        doctorId: 42,
        status: "open",
      };

      const created = tasks.create(input);
      expect(created.id).toBeTypeOf("number");
      expect(created.type).toBe("doctor_visit");
      expect(created.doctorId).toBe(42);
      expect(created.status).toBe("open");
    });

    it("creates and retrieves a form_17 task with specific fields", () => {
      const input: TaskInput = {
        type: "form_17",
        title: "Form 17 for MRI",
        institution: "Sheba Medical Center",
        department: "Radiology",
        healthFund: "Maccabi",
        codeNumber: "L0123",
        codeName: "Brain MRI with contrast",
        status: "in-progress",
      };

      const created = tasks.create(input);
      expect(created.type).toBe("form_17");
      expect(created.institution).toBe("Sheba Medical Center");
      expect(created.department).toBe("Radiology");
      expect(created.healthFund).toBe("Maccabi");
      expect(created.codeNumber).toBe("L0123");
      expect(created.codeName).toBe("Brain MRI with contrast");
      expect(created.status).toBe("in-progress");
    });

    it("creates and retrieves a general_approval task with issuing body and purpose", () => {
      const input: TaskInput = {
        type: "general_approval",
        title: "Travel insurance approval",
        issuingBody: "Harel Insurance",
        purpose: "Pre-existing condition coverage approval",
        status: "open",
      };

      const created = tasks.create(input);
      expect(created.type).toBe("general_approval");
      expect(created.issuingBody).toBe("Harel Insurance");
      expect(created.purpose).toBe("Pre-existing condition coverage approval");
    });

    it("rejects task creation if title or type is missing or invalid", () => {
      expect(() =>
        tasks.create({
          type: "test",
          title: "",
        } as TaskInput)
      ).toThrow(InvalidTaskInputError);

      expect(() =>
        tasks.create({
          type: "invalid_kind" as any,
          title: "Some task",
        })
      ).toThrow(InvalidTaskInputError);
    });

    it("rejects doctor_visit task if doctorId is missing", () => {
      expect(() =>
        tasks.create({
          type: "doctor_visit",
          title: "Schedule appointment",
          doctorId: null,
        })
      ).toThrow(InvalidTaskInputError);
    });
  });

  describe("list & filter", () => {
    it("lists tasks filtered by doctorId and by status", () => {
      tasks.create({ type: "test", title: "Task 1", status: "open", doctorId: 1 });
      tasks.create({ type: "doctor_visit", title: "Task 2", status: "in-progress", doctorId: 1 });
      tasks.create({ type: "test", title: "Task 3", status: "done", doctorId: 2 });

      expect(tasks.list()).toHaveLength(3);
      expect(tasks.list({ doctorId: 1 })).toHaveLength(2);
      expect(tasks.list({ status: "open" })).toHaveLength(1);
      expect(tasks.list({ doctorId: 1, status: "in-progress" })).toHaveLength(1);
      expect(tasks.list({ doctorId: 3 })).toHaveLength(0);
    });

    it("sorts tasks with no due date first, followed by earliest due date", () => {
      tasks.create({ type: "test", title: "Task with later due date", dueDate: "2026-09-15" });
      tasks.create({ type: "test", title: "Task with no due date", dueDate: null });
      tasks.create({ type: "test", title: "Task with earlier due date", dueDate: "2026-08-20" });

      const list = tasks.list();
      expect(list[0].title).toBe("Task with no due date");
      expect(list[1].title).toBe("Task with earlier due date");
      expect(list[2].title).toBe("Task with later due date");
    });
  });

  describe("update & status transitions", () => {
    it("updates task fields", () => {
      const created = tasks.create({
        type: "test",
        title: "Initial title",
        status: "open",
      });

      const updated = tasks.update(created.id, {
        type: "test",
        title: "Updated title",
        status: "in-progress",
        dueDate: "2026-09-01",
      });

      expect(updated.title).toBe("Updated title");
      expect(updated.status).toBe("in-progress");
      expect(updated.dueDate).toBe("2026-09-01");
    });

    it("transitions status between open, in-progress, and done", () => {
      const created = tasks.create({
        type: "general_approval",
        title: "Permit",
        status: "open",
      });

      const inProgress = tasks.setStatus(created.id, "in-progress");
      expect(inProgress.status).toBe("in-progress");

      const done = tasks.setStatus(created.id, "done");
      expect(done.status).toBe("done");

      expect(() => tasks.setStatus(created.id, "invalid_status" as any)).toThrow(
        InvalidTaskInputError
      );
    });

    it("throws TaskNotFoundError when updating non-existent task", () => {
      expect(() =>
        tasks.update(999, { type: "test", title: "Does not exist" })
      ).toThrow(TaskNotFoundError);
      expect(() => tasks.setStatus(999, "done")).toThrow(TaskNotFoundError);
    });
  });

  describe("resolving advance-scheduling test or doctor visit into appointment", () => {
    it("links task to an appointment and marks task as done or sets pendingAppointmentId", () => {
      const task = tasks.create({
        type: "doctor_visit",
        title: "Schedule dermatologist checkup",
        doctorId: 10,
        status: "open",
      });

      const resolved = tasks.setPendingAppointment(task.id, 501);
      expect(resolved.pendingAppointmentId).toBe(501);

      const completed = tasks.setStatus(task.id, "done");
      expect(completed.status).toBe("done");
      expect(completed.pendingAppointmentId).toBe(501);
    });
  });
});

