import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddDocument } from "./AddDocument";
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

describe("AddDocument", () => {
  it("offers both uploading a new document and choosing an existing one", () => {
    render(<AddDocument allDocuments={[]} excludedIds={new Set()} onPick={() => {}} onUpload={() => {}} />);

    expect(screen.getByLabelText("Upload new document")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attach existing document" })).toBeInTheDocument();
  });

  it("passes every selected file to onUpload", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const files = [new File(["a"], "a.pdf", { type: "application/pdf" }), new File(["b"], "b.pdf", { type: "application/pdf" })];

    render(<AddDocument allDocuments={[]} excludedIds={new Set()} onPick={() => {}} onUpload={onUpload} />);
    await user.upload(screen.getByLabelText("Upload new document"), files);

    expect(onUpload).toHaveBeenCalledWith(files);
  });

  it("passes a chosen existing document to onPick", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const bloodTest = doc();

    render(<AddDocument allDocuments={[bloodTest]} excludedIds={new Set()} onPick={onPick} onUpload={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Attach existing document" }));
    await user.click(screen.getByText("Blood test results"));

    expect(onPick).toHaveBeenCalledWith(bloodTest);
  });
});
