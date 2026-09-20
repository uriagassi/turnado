import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MedicalDocument } from "../api";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";

/**
 * The searchable "attach an existing document" picker, shared by every
 * screen that lets you link an already-uploaded document to something
 * (an appointment's checklist, a task's own documents) — same toggle
 * button, same search-and-list panel, same excluded/picked behavior,
 * so the two don't drift into two different pickers for what is, to the
 * user, one and the same action. Renders as a fragment (button, then the
 * panel once open) rather than a wrapping element, so a caller can lay the
 * toggle button out next to its own other controls; give `.document-picker`
 * (below) a flex-basis of 100% wherever that matters so the panel still
 * drops to its own full-width line inside a flex-wrap row.
 */
export function DocumentPicker({
  allDocuments,
  excludedIds,
  onPick,
}: {
  allDocuments: MedicalDocument[];
  /** Documents to leave out of the results — already attached/staged elsewhere, so re-offering them would just invite a confusing duplicate pick. */
  excludedIds: Set<number>;
  onPick: (document: MedicalDocument) => void;
}) {
  const { t } = useTranslation();
  const formatRelative = useRelativeDateTime();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = allDocuments
    .filter((d) => !excludedIds.has(d.id))
    .filter((d) => d.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <button type="button" className="btn-small btn-secondary" onClick={() => setOpen((o) => !o)}>
        {t("documentPicker.toggle")}
      </button>

      {open && (
        <div className="card document-picker">
          <label>
            {t("documentPicker.search.label")}
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
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
    </>
  );
}
