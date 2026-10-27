import { useTranslation } from "react-i18next";
import type { UploadedFile } from "../api";

async function saveBlob(blob: Blob, fileName: string, mime: string) {
  const shareFile = new File([blob], fileName, { type: blob.type || mime });
  if (navigator.canShare?.({ files: [shareFile] })) {
    try {
      await navigator.share({ files: [shareFile], title: fileName });
    } catch (err) {
      if ((err as Error).name !== "AbortError") throw err;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DocumentPreview({ file }: { file: UploadedFile }) {
  const { t } = useTranslation();
  const attachmentUrl = `/api/body/attachments/${encodeURIComponent(file.uniqueFilename)}`;

  const isImage =
    file.mime?.toLowerCase().startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|svg|avif|heic|bmp|tiff)$/i.test(file.fileName || "") ||
    /\.(jpe?g|png|webp|gif|svg|avif|heic|bmp|tiff)$/i.test(file.uniqueFilename || "");

  const isPdf =
    file.mime?.toLowerCase().includes("pdf") ||
    (file.fileName || "").toLowerCase().endsWith(".pdf") ||
    (file.uniqueFilename || "").toLowerCase().endsWith(".pdf");

  const download = async () => {
    try {
      const res = await fetch(attachmentUrl);
      if (!res.ok) throw new Error(String(res.status));
      await saveBlob(await res.blob(), file.fileName, file.mime ?? "");
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  return (
    <div className="document-preview">
      {isImage && (
        <img className="document-preview-image" src={attachmentUrl} alt={file.fileName} />
      )}
      {isPdf && (
        <embed
          className="document-preview-embed"
          src={attachmentUrl}
          type="application/pdf"
        />
      )}
      <div className="document-preview-actions">
        <button type="button" className="btn-download" onClick={download}>
          {t("documentPreview.download")}
        </button>
      </div>
    </div>
  );
}
