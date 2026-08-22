import { describe, it, expect } from "vitest";
import { guessDoctorFromTitle } from "../src/documents/guessDoctor.js";
import type { Doctor } from "../src/doctors/Doctors.js";

function doctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 1,
    name: "Dr. Cohen",
    tagId: 1,
    photoPath: null,
    ...overrides,
  };
}

describe("guessDoctorFromTitle", () => {
  it("matches a doctor whose name appears as a substring of the title", () => {
    const drCohen = doctor({ id: 1, name: "Dr. Cohen" });
    const drLevi = doctor({ id: 2, name: "Dr. Levi", tagId: 2 });

    expect(guessDoctorFromTitle("Referral letter from Dr. Cohen", [drCohen, drLevi])).toBe(drCohen);
  });

  it("returns null when no known doctor's name appears in the title", () => {
    const drCohen = doctor({ id: 1, name: "Dr. Cohen" });

    expect(guessDoctorFromTitle("Quarterly pension statement", [drCohen])).toBeNull();
  });
});
