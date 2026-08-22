import { describe, it, expect } from "vitest";
import { guessDocumentType } from "../src/documents/guessDocumentType.js";

describe("guessDocumentType", () => {
  it("guesses 'referral' from an English title containing 'referral'", () => {
    expect(guessDocumentType("Referral to cardiology")).toBe("referral");
  });

  it("guesses 'approval' from a Hebrew title containing 'אישור'", () => {
    expect(guessDocumentType("אישור ביטוח נסיעות")).toBe("approval");
  });

  it("defaults to 'other' when no keyword matches", () => {
    expect(guessDocumentType("Quarterly pension statement")).toBe("other");
  });
});
