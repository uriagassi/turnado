import { useTranslation } from "react-i18next";
import type { UploadedFile } from "../api";

export function DocumentPreview({ file }: { file: UploadedFile }) {
  const { t } = useTranslation();
  const attachmentUrl = `/api/body/attachments/${file.uniqueFilename}`;

  const isImage = file.mime.startsWith("image/");
  const isPdf = file.mime.includes("pdf");

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
