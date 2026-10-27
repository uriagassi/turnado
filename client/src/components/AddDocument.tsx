import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { MedicalDocument } from "../api";
import { DocumentPicker } from "./DocumentPicker";

/** The one "add a document" action — upload new or choose existing — shared by every screen that manages documents, so the wording and behavior stay identical. */
export function AddDocument({
  allDocuments,
  excludedIds,
  onPick,
  onUpload,
}: {
  allDocuments: MedicalDocument[];
  excludedIds: Set<number>;
  onPick: (document: MedicalDocument) => void;
  onUpload: (files: File[]) => void;
}) {
  const { t } = useTranslation();

  const onFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) onUpload(files);
  };

  return (
    <div className="add-document">
      <DocumentPicker allDocuments={allDocuments} excludedIds={excludedIds} onPick={onPick} />
      <label className="btn-small btn-secondary add-document-upload">
        {t("taskForm.documents.upload")}
        <input type="file" multiple accept="image/*,application/pdf" className="visually-hidden" onChange={onFilesSelected} />
      </label>
    </div>
  );
}
