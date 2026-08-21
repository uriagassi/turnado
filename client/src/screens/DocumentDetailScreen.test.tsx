import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentDetailScreen } from "./DocumentDetailScreen";
import type { Doctor, MedicalDocument } from "../api";

const mockDoc: MedicalDocument = {
  id: 1,
  notebookId: 42,
  title: "MRI Scan Brain",
  type: "test result",
  documentDate: "2026-08-01",
  doctorId: 1,
  notes: "No acute abnormalities",
  file: {
    fileName: "mri.pdf",
    uniqueFilename: "unique_mri.pdf",
    mime: "application/pdf",
    hash: "hash_mri",
    size: 2048,
  },
  appointmentIds: [],
  taskIds: [],
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const mockDoctors: Doctor[] = [
  { id: 1, name: "Dr. Jane Smith", notes: "", photoPath: null },
];

describe("DocumentDetailScreen", () => {
  it("renders document title, type, date, doctor, notes, and preview", () => {
    render(
      <DocumentDetailScreen
        document={mockDoc}
        doctors={mockDoctors}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "MRI Scan Brain" })).toBeInTheDocument();
    expect(screen.getByText("Test result")).toBeInTheDocument();
    expect(screen.getByText("2026-08-01")).toBeInTheDocument();
    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("No acute abnormalities")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download file" })).toBeInTheDocument();
  });
});
