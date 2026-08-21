import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DOCUMENT_TYPES, type Appointment, type Doctor, type DocumentType, type MedicalDocument, type Task } from "../api";

export interface DocumentFilters {
  query: string;
  type: DocumentType | "";
  doctorId: number | "";
  dateFrom: string;
  dateTo: string;
}

interface DocumentsScreenProps {
  documents: MedicalDocument[];
  doctors: Doctor[];
  appointments?: Appointment[];
  openItems?: Task[];
  filters: DocumentFilters;
  onFiltersChange: (filters: DocumentFilters) => void;
  onSelectDocument: (document: MedicalDocument) => void;
}

interface FilterChip {
  key: keyof DocumentFilters;
  label: string;
}

function buildChips(filters: DocumentFilters, doctors: Doctor[], t: (key: string) => string): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.query) {
    chips.push({ key: "query", label: filters.query });
  }
  if (filters.type) {
    chips.push({ key: "type", label: t(`document.type.${filters.type}`) });
  }
  if (filters.doctorId !== "") {
    const doctor = doctors.find((d) => d.id === filters.doctorId);
    chips.push({ key: "doctorId", label: doctor?.name ?? String(filters.doctorId) });
  }
  if (filters.dateFrom) {
    chips.push({ key: "dateFrom", label: `${t("documentsScreen.filters.dateFrom.label")}: ${filters.dateFrom}` });
  }
  if (filters.dateTo) {
    chips.push({ key: "dateTo", label: `${t("documentsScreen.filters.dateTo.label")}: ${filters.dateTo}` });
  }
  return chips;
}

const EMPTY_FILTER_VALUES: DocumentFilters = { query: "", type: "", doctorId: "", dateFrom: "", dateTo: "" };

interface DocumentTypeGroup {
  type: DocumentType;
  documents: MedicalDocument[];
}

/** Groups documents by type in DOCUMENT_TYPES declaration order (types with no matches are omitted), preserving each document's relative order within its group. */
function groupByType(documents: MedicalDocument[]): DocumentTypeGroup[] {
  return DOCUMENT_TYPES.map((type) => ({ type, documents: documents.filter((d) => d.type === type) })).filter(
    (group) => group.documents.length > 0,
  );
}

/** Human-readable name for a chip's remove-button aria-label — "query"/"type"/"dateFrom"/"dateTo" read fine as-is, "doctorId" reads as "doctor". */
function chipFieldName(key: keyof DocumentFilters): string {
  return key === "doctorId" ? "doctor" : key;
}

/** Resolves a document's linked appointments/tasks out of the full lists the screen was handed — the badge's expanded detail. */
function selectLinkedItems(
  document: MedicalDocument,
  appointments: Appointment[],
  openItems: Task[],
): { linkedAppointments: Appointment[]; linkedTasks: Task[] } {
  return {
    linkedAppointments: appointments.filter((a) => document.appointmentIds.includes(a.id)),
    linkedTasks: openItems.filter((task) => document.taskIds.includes(task.id)),
  };
}

function DocumentRow({
  document,
  appointments,
  openItems,
  onSelect,
}: {
  document: MedicalDocument;
  appointments: Appointment[];
  openItems: Task[];
  onSelect: (document: MedicalDocument) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  // Badge count comes from the document's own link counts, not the
  // resolved appointments/openItems arrays — those may be a partial list
  // the caller happened to pass in.
  const linkedCount = document.appointmentIds.length + document.taskIds.length;
  const { linkedAppointments, linkedTasks } = selectLinkedItems(document, appointments, openItems);

  return (
    <li>
      <button type="button" className="document-row" onClick={() => onSelect(document)}>
        {document.title}
      </button>

      {linkedCount > 1 && (
        <div className="linked-items">
          <button type="button" className="linked-badge" onClick={() => setExpanded((e) => !e)}>
            {t("documentsScreen.linkedBadge", { count: linkedCount })}
          </button>

          {expanded && (
            <div className="card linked-detail">
              {linkedAppointments.map((appt) => (
                <p key={`appointment-${appt.id}`} className="item-row-sub">
                  {appt.notes}
                </p>
              ))}
              {linkedTasks.map((task) => (
                <p key={`task-${task.id}`} className="item-row-sub">
                  {task.title}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function DocumentsScreen({
  documents,
  doctors,
  appointments = [],
  openItems = [],
  filters,
  onFiltersChange,
  onSelectDocument,
}: DocumentsScreenProps) {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const chips = buildChips(filters, doctors, t);
  const groups = groupByType(documents);

  return (
    <main className="screen documents-screen">
      <h1>{t("documentsScreen.title")}</h1>

      <button
        type="button"
        className="btn-small btn-secondary filters-toggle"
        onClick={() => setFiltersOpen((open) => !open)}
      >
        {t("documentsScreen.filters.toggle")}
      </button>

      {filtersOpen && (
        <div className="filters-panel">
          <div className="form-field">
            <label>
              {t("documentsScreen.filters.query.label")}
              <input
                type="text"
                value={filters.query}
                onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
              />
            </label>
          </div>

          <div className="form-field">
            <label>
              {t("documentsScreen.filters.type.label")}
              <select
                value={filters.type}
                onChange={(e) => onFiltersChange({ ...filters, type: e.target.value as DocumentType | "" })}
              >
                <option value="">{t("documentsScreen.filters.type.any")}</option>
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`document.type.${type}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-field">
            <label>
              {t("documentsScreen.filters.doctor.label")}
              <select
                value={filters.doctorId}
                onChange={(e) =>
                  onFiltersChange({ ...filters, doctorId: e.target.value ? Number(e.target.value) : "" })
                }
              >
                <option value="">{t("documentsScreen.filters.doctor.any")}</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="filters-date-range">
            <div className="form-field">
              <label>
                {t("documentsScreen.filters.dateFrom.label")}
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                />
              </label>
            </div>

            <div className="form-field">
              <label>
                {t("documentsScreen.filters.dateTo.label")}
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div className="filter-chips">
          {chips.map((chip) => (
            <span key={chip.key} className="filter-chip">
              {chip.label}
              <button
                type="button"
                aria-label={`Remove ${chipFieldName(chip.key)} filter`}
                onClick={() => onFiltersChange({ ...filters, [chip.key]: EMPTY_FILTER_VALUES[chip.key] })}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="clear-all" onClick={() => onFiltersChange(EMPTY_FILTER_VALUES)}>
            {t("documentsScreen.filters.clearAll")}
          </button>
        </div>
      )}

      <div className="document-results">
        {groups.map((group) => (
          <section key={group.type}>
            <h2 className="section-title">{t(`document.type.${group.type}`)}</h2>
            <ul className="document-list">
              {group.documents.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  appointments={appointments}
                  openItems={openItems}
                  onSelect={onSelectDocument}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
