import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { MedicalDocument } from "../api";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";

/** The one "add a document" action shared by every screen that manages documents: a button opening a searchable list of existing documents, with an "Upload new" button inside it. */
export function AddDocument({
  allDocuments,
  excludedIds,
  onPick,
  onUpload,
}: {
  allDocuments: MedicalDocument[];
  /** Documents already attached/staged, left out of the list so they can't be picked twice. */
  excludedIds: Set<number>;
  onPick: (document: MedicalDocument) => void;
  onUpload: (files: File[]) => void;
}) {
  const { t } = useTranslation();
  const formatRelative = useRelativeDateTime();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = allDocuments
    .filter((d) => !excludedIds.has(d.id))
    .filter((d) => d.title.toLowerCase().includes(query.trim().toLowerCase()));

  const onFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    onUpload(files);
    setOpen(false);
  };

  return (
    <div className="add-document">
      <button type="button" className="btn-small btn-secondary" onClick={() => setOpen((o) => !o)}>
        {t("addDocument.toggle")}
      </button>

      {open && (
        <div className="card add-document-panel">
          <div className="add-document-panel-header">
            <label className="add-document-search">
              {t("documentPicker.search.label")}
              <input type="text" dir="auto" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="btn-small btn-secondary add-document-upload">
              {t("addDocument.upload")}
              <input type="file" multiple accept="image/*,application/pdf" className="visually-hidden" onChange={onFilesSelected} />
            </label>
          </div>
          {results.length > 0 ? (
            <ul className="item-row-list">
              {results.map((document) => (
                <li
                  key={document.id}
                  className="card item-row clickable picker-result"
                  role="button"
                  tabIndex={0}
                  onClick={() => onPick(document)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick(document);
                    }
                  }}
                >
                  <div>
                    <p className="item-row-notes">{document.title}</p>
                    <p className="item-row-sub">{formatRelative(document.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="section-empty">{t("documentPicker.empty")}</p>
          )}
        </div>
      )}
    </div>
  );
}
