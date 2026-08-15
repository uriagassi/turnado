import { useTranslation } from "react-i18next";
import type { UploadedFile } from "../api";

export function DocumentPreview({ file }: { file: UploadedFile }) {
  const { t } = useTranslation();
  const attachmentUrl = `/api/body/attachments/${file.uniqueFilename}`;

  const isImage =
    file.mime?.toLowerCase().startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|svg|avif|heic|bmp|tiff)$/i.test(file.fileName || "") ||
    /\.(jpe?g|png|webp|gif|svg|avif|heic|bmp|tiff)$/i.test(file.uniqueFilename || "");

  const isPdf =
    file.mime?.toLowerCase().includes("pdf") ||
    (file.fileName || "").toLowerCase().endsWith(".pdf") ||
    (file.uniqueFilename || "").toLowerCase().endsWith(".pdf");

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
        <a
          href={attachmentUrl}
          download={file.fileName}
          className="btn-download"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("documentPreview.download")}
        </a>
      </div>
    </div>
  );
}
