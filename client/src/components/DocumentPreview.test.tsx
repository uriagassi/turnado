import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentPreview } from "./DocumentPreview";
import type { UploadedFile } from "../api";

describe("DocumentPreview", () => {
  it("renders an img tag for image files pointed at the attachment endpoint", () => {
    const file: UploadedFile = {
      fileName: "scan.jpg",
      uniqueFilename: "123_scan.jpg",
      mime: "image/jpeg",
      hash: "abc",
      size: 1024,
    };

    const { container } = render(<DocumentPreview file={file} />);

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/api/body/attachments/123_scan.jpg");
    expect(img).toHaveAttribute("alt", "scan.jpg");

    const downloadLink = screen.getByRole("link", { name: "Download file" });
    expect(downloadLink).toHaveAttribute("href", "/api/body/attachments/123_scan.jpg");
  });

  it("renders an embed tag for PDF files pointed at the attachment endpoint", () => {
    const file: UploadedFile = {
      fileName: "report.pdf",
      uniqueFilename: "456_report.pdf",
      mime: "application/pdf",
      hash: "def",
      size: 2048,
    };

    const { container } = render(<DocumentPreview file={file} />);

    const embed = container.querySelector("embed");
    expect(embed).toBeInTheDocument();
    expect(embed).toHaveAttribute("src", "/api/body/attachments/456_report.pdf");
    expect(embed).toHaveAttribute("type", "application/pdf");

    const downloadLink = screen.getByRole("link", { name: "Download file" });
    expect(downloadLink).toHaveAttribute("href", "/api/body/attachments/456_report.pdf");
  });
});
