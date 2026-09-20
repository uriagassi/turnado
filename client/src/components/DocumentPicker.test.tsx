import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentPicker } from "./DocumentPicker";
import type { MedicalDocument } from "../api";

function doc(overrides: Partial<MedicalDocument> = {}): MedicalDocument {
  return {
    id: 1,
    notebookId: 0,
    title: "Blood test results",
    type: "test result",
    documentDate: null,
    doctorId: null,
    notes: null,
    file: { fileName: "blood.pdf", uniqueFilename: "u_blood.pdf", mime: "application/pdf", hash: "h", size: 10 },
    appointmentIds: [],
    taskIds: [],
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-10T09:00:00.000Z",
    ...overrides,
  };
}

describe("DocumentPicker", () => {
  it("is closed until the toggle button is clicked", () => {
    render(<DocumentPicker allDocuments={[doc()]} excludedIds={new Set()} onPick={() => {}} />);

    expect(screen.queryByLabelText("Search documents")).not.toBeInTheDocument();
  });

  it("shows every non-excluded document with its upload date, filters by search, and calls onPick", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const bloodTest = doc({ id: 1, title: "Blood test results" });
    const referral = doc({ id: 2, title: "Cardiology referral" });

    render(<DocumentPicker allDocuments={[bloodTest, referral]} excludedIds={new Set()} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "Attach existing document" }));

    expect(screen.getByText("Blood test results")).toBeInTheDocument();
    expect(screen.getByText("Cardiology referral")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search documents"), "referral");
    expect(screen.queryByText("Blood test results")).not.toBeInTheDocument();
    expect(screen.getByText("Cardiology referral")).toBeInTheDocument();

    await user.click(screen.getByText("Cardiology referral"));
    expect(onPick).toHaveBeenCalledWith(referral);
  });

  it("excludes documents whose id is in excludedIds", async () => {
    const user = userEvent.setup();
    const bloodTest = doc({ id: 1, title: "Blood test results" });
    const referral = doc({ id: 2, title: "Cardiology referral" });

    render(<DocumentPicker allDocuments={[bloodTest, referral]} excludedIds={new Set([1])} onPick={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Attach existing document" }));

    expect(screen.queryByText("Blood test results")).not.toBeInTheDocument();
    expect(screen.getByText("Cardiology referral")).toBeInTheDocument();
  });

  it("shows the empty state when no document matches the search", async () => {
    const user = userEvent.setup();

    render(<DocumentPicker allDocuments={[doc()]} excludedIds={new Set()} onPick={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Attach existing document" }));
    await user.type(screen.getByLabelText("Search documents"), "nothing matches this");

    expect(screen.getByText("No matching documents.")).toBeInTheDocument();
  });

  it("stays open after a pick, so several documents can be picked in a row", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const bloodTest = doc({ id: 1, title: "Blood test results" });

    render(<DocumentPicker allDocuments={[bloodTest]} excludedIds={new Set()} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "Attach existing document" }));
    await user.click(screen.getByText("Blood test results"));

    expect(onPick).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Search documents")).toBeInTheDocument();
  });
});
