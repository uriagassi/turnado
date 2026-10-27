import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { UploadedFile } from "../api";

function saveViaAnchor(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function saveOrShareBlob(blob: Blob, fileName: string, mime: string) {
  const shareFile = new File([blob], fileName, { type: blob.type || mime });
  if (navigator.canShare?.({ files: [shareFile] })) {
    try {
      await navigator.share({ files: [shareFile], title: fileName });
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
  }
  saveViaAnchor(blob, fileName);
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

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const download = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(attachmentUrl);
      if (!res.ok) throw new Error(String(res.status));
      await saveOrShareBlob(await res.blob(), file.fileName, file.mime ?? "");
    } catch (err) {
      console.error("Download failed", err);
      setFailed(true);
    } finally {
      setBusy(false);
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
        <button type="button" className="btn-download" onClick={download} disabled={busy}>
          {t("documentPreview.download")}
        </button>
        {failed && <p role="alert">{t("documentPreview.downloadFailed")}</p>}
      </div>
    </div>
  );
}
