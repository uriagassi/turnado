import { describe, it, expect } from "vitest";
import { areSimilarTasks, findSimilarTasks, withSimilarTaskIds, type SimilarityCandidate } from "../src/tasks/duplicateTasks.js";

function task(overrides: Partial<SimilarityCandidate> & { id: number }): SimilarityCandidate {
  return {
    type: "test",
    status: "open",
    doctorId: 1,
    dueDate: "2026-09-01",
    ...overrides,
  };
}

describe("areSimilarTasks", () => {
  it("matches same type + same doctor + due dates within 30 days", () => {
    const a = task({ id: 1, dueDate: "2026-09-01" });
    const b = task({ id: 2, dueDate: "2026-09-25" });
    expect(areSimilarTasks(a, b)).toBe(true);
  });

  it("does not match once due dates are more than 30 days apart", () => {
    const a = task({ id: 1, dueDate: "2026-09-01" });
    const b = task({ id: 2, dueDate: "2026-10-05" });
    expect(areSimilarTasks(a, b)).toBe(false);
  });

  it("matches on the exact 30-day boundary", () => {
    const a = task({ id: 1, dueDate: "2026-09-01" });
    const b = task({ id: 2, dueDate: "2026-10-01" });
    expect(areSimilarTasks(a, b)).toBe(true);
  });

  it("does not match a different task type, even with the same doctor and date", () => {
    const a = task({ id: 1, type: "test" });
    const b = task({ id: 2, type: "doctor_visit" });
    expect(areSimilarTasks(a, b)).toBe(false);
  });

  it("does not match a different doctor", () => {
    const a = task({ id: 1, doctorId: 1 });
    const b = task({ id: 2, doctorId: 2 });
    expect(areSimilarTasks(a, b)).toBe(false);
  });

  it("excludes a pair where either side has no doctor linked (NULL-doctor exclusion)", () => {
    const a = task({ id: 1, doctorId: null });
    const b = task({ id: 2, doctorId: 1 });
    expect(areSimilarTasks(a, b)).toBe(false);
    expect(areSimilarTasks(b, a)).toBe(false);
  });

  it("excludes a pair where both sides have no doctor linked", () => {
    const a = task({ id: 1, doctorId: null });
    const b = task({ id: 2, doctorId: null });
    expect(areSimilarTasks(a, b)).toBe(false);
  });

  it("compares on type + doctor only when either side has no due date", () => {
    const a = task({ id: 1, dueDate: null });
    const b = task({ id: 2, dueDate: "2099-01-01" });
    expect(areSimilarTasks(a, b)).toBe(true);
  });

  it("compares on type + doctor only when both sides have no due date", () => {
    const a = task({ id: 1, dueDate: null });
    const b = task({ id: 2, dueDate: null });
    expect(areSimilarTasks(a, b)).toBe(true);
  });
});

describe("findSimilarTasks", () => {
  it("only draws candidates from open/in-progress tasks, never done", () => {
    const candidate = task({ id: 1 });
    const pool = [
      task({ id: 2, status: "open" }),
      task({ id: 3, status: "in-progress" }),
      task({ id: 4, status: "done" }),
    ];

    const result = findSimilarTasks(candidate, pool).map((t) => t.id);

    expect(result).toEqual([2, 3]);
  });

  it("never matches the candidate against itself", () => {
    const candidate = task({ id: 1 });
    const pool = [candidate, task({ id: 2 })];

    const result = findSimilarTasks(candidate, pool).map((t) => t.id);

    expect(result).toEqual([2]);
  });

  it("returns an empty array when nothing in the pool matches", () => {
    const candidate = task({ id: 1, doctorId: 1 });
    const pool = [task({ id: 2, doctorId: 2 })];

    expect(findSimilarTasks(candidate, pool)).toEqual([]);
  });
});

describe("withSimilarTaskIds", () => {
  it("attaches the ids of every current candidate to each open/in-progress task", () => {
    const a = task({ id: 1, status: "open", dueDate: "2026-09-01" });
    const b = task({ id: 2, status: "open", dueDate: "2026-09-10" });
    const c = task({ id: 3, status: "in-progress", doctorId: 2 });

    const result = withSimilarTaskIds([a, b, c], [a, b, c]);

    expect(result.find((t) => t.id === 1)?.similarTaskIds).toEqual([2]);
    expect(result.find((t) => t.id === 2)?.similarTaskIds).toEqual([1]);
    expect(result.find((t) => t.id === 3)?.similarTaskIds).toEqual([]);
  });

  it("never flags a done task, even if an open counterpart still matches it", () => {
    const done = task({ id: 1, status: "done" });
    const open = task({ id: 2, status: "open" });

    const result = withSimilarTaskIds([done, open], [done, open]);

    expect(result.find((t) => t.id === 1)?.similarTaskIds).toEqual([]);
    expect(result.find((t) => t.id === 2)?.similarTaskIds).toEqual([]);
  });

  it("computes against the full pool even when only a filtered subset of items is passed in", () => {
    const a = task({ id: 1, status: "open" });
    const b = task({ id: 2, status: "open" });
    const pool = [a, b];

    const result = withSimilarTaskIds([a], pool);

    expect(result[0].similarTaskIds).toEqual([2]);
  });
});
