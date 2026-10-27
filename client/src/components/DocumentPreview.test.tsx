import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

    expect(screen.getByRole("button", { name: "Download file" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Download file" })).not.toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: "Download file" })).toBeInTheDocument();
  });
});

describe("DocumentPreview download", () => {
  const file: UploadedFile = {
    fileName: "report.pdf",
    uniqueFilename: "456_report.pdf",
    mime: "application/pdf",
    hash: "def",
    size: 2048,
  };
  const blob = new Blob(["x"], { type: "application/pdf" });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  });

  it("fetches the file and opens the share sheet when sharing files is supported", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    vi.stubGlobal("fetch", fetchMock);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });

    render(<DocumentPreview file={file} />);
    await userEvent.click(screen.getByRole("button", { name: "Download file" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/body/attachments/456_report.pdf");
    expect(share).toHaveBeenCalledTimes(1);
    const shared = share.mock.calls[0][0].files[0] as File;
    expect(shared.name).toBe("report.pdf");
  });

  it("saves via a blob URL anchor without a new tab when sharing is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    URL.createObjectURL = vi.fn().mockReturnValue("blob:x");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("report.pdf");
      expect(this.href).toBe("blob:x");
      expect(this.target).toBe("");
    });

    render(<DocumentPreview file={file} />);
    await userEvent.click(screen.getByRole("button", { name: "Download file" }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("does nothing further when the user cancels the share sheet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    Object.defineProperty(navigator, "share", { value: vi.fn().mockRejectedValue(abort), configurable: true });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<DocumentPreview file={file} />);
    await userEvent.click(screen.getByRole("button", { name: "Download file" }));

    expect(click).not.toHaveBeenCalled();
  });
});
