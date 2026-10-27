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
  it("is closed until the Add document button is clicked, then offers existing documents and Upload new together", async () => {
    const user = userEvent.setup();
    render(<AddDocument allDocuments={[doc()]} excludedIds={new Set()} onPick={() => {}} onUpload={() => {}} />);

    expect(screen.queryByLabelText("Search documents")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Upload new")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add document" }));

    expect(screen.getByLabelText("Search documents")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload new")).toBeInTheDocument();
    expect(screen.getByText("Blood test results")).toBeInTheDocument();
  });

  it("filters by search and leaves out excluded documents", async () => {
    const user = userEvent.setup();
    const referral = doc({ id: 2, title: "Cardiology referral" });
    render(<AddDocument allDocuments={[doc(), referral, doc({ id: 3, title: "Excluded referral" })]} excludedIds={new Set([3])} onPick={() => {}} onUpload={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Add document" }));
    expect(screen.queryByText("Excluded referral")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Search documents"), "referral");
    expect(screen.queryByText("Blood test results")).not.toBeInTheDocument();
    expect(screen.getByText("Cardiology referral")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search documents"));
    await user.type(screen.getByLabelText("Search documents"), "nothing matches this");
    expect(screen.getByText("No matching documents.")).toBeInTheDocument();
  });

  it("stays open after a pick, so several documents can be picked in a row", async () => {
    const user = userEvent.setup();
    render(<AddDocument allDocuments={[doc()]} excludedIds={new Set()} onPick={() => {}} onUpload={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Add document" }));
    await user.click(screen.getByText("Blood test results"));

    expect(screen.getByLabelText("Search documents")).toBeInTheDocument();
  });

  it("passes every selected file to onUpload", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const files = [new File(["a"], "a.pdf", { type: "application/pdf" }), new File(["b"], "b.pdf", { type: "application/pdf" })];

    render(<AddDocument allDocuments={[]} excludedIds={new Set()} onPick={() => {}} onUpload={onUpload} />);
    await user.click(screen.getByRole("button", { name: "Add document" }));
    await user.upload(screen.getByLabelText("Upload new"), files);

    expect(onUpload).toHaveBeenCalledWith(files);
  });

  it("passes a chosen existing document to onPick", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const bloodTest = doc();

    render(<AddDocument allDocuments={[bloodTest]} excludedIds={new Set()} onPick={onPick} onUpload={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Add document" }));
    await user.click(screen.getByText("Blood test results"));

    expect(onPick).toHaveBeenCalledWith(bloodTest);
  });
});
