import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/** Every top-level destination the nav drawer can jump to — matches the AppState phases App.tsx wires this into (see App.tsx). */
export type NavDestination = "home" | "doctors" | "documents" | "appointment-upcoming" | "appointment-history";

// Order matches the AC's own listing (Home, Doctors, Documents, Upcoming appointments, Appointment history).
// Labels reuse each destination screen's own title key rather than duplicating the string.
const DESTINATIONS: { id: NavDestination; titleKey: string }[] = [
  { id: "home", titleKey: "home.title" },
  { id: "doctors", titleKey: "doctors.title" },
  { id: "documents", titleKey: "documentsScreen.title" },
  { id: "appointment-upcoming", titleKey: "upcomingAppointments.title" },
  { id: "appointment-history", titleKey: "appointmentHistory.title" },
];

export function NavBar({
  title,
  onNavigate,
  onBack,
}: {
  /** The current screen's title, shown in the title bar (AC: "showing at least the current screen's title"). */
  title: string;
  onNavigate: (destination: NavDestination) => void;
  /**
   * Set only on drill-in screens (doctor detail, document detail, task
   * detail) — replaces those screens' own former "back-link" button
   * (issue #27 follow-up). Top-level screens (Home, Doctors, Documents,
   * Upcoming, History) pass nothing and get no back control, since the
   * hamburger drawer already reaches every one of them directly.
   */
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Escape-to-close matches ConfirmationModal's own convention elsewhere in
  // this app (see components/ConfirmationModal.tsx) — only listens while
  // the drawer is actually open.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const selectDestination = (destination: NavDestination) => {
    setOpen(false);
    onNavigate(destination);
  };

  return (
    <header className="nav-bar">
      <button
        type="button"
        className="nav-bar-menu-toggle"
        aria-label={t("nav.menu")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ☰
      </button>
      {/* Reuses .back-link-arrow, the same glyph + RTL-mirror rule the
          former per-screen back-links used (see index.css) — the arrow
          itself isn't translatable text, so this is the one part of the
          old back-link markup worth keeping verbatim. */}
      {onBack && (
        <button type="button" className="nav-bar-back" aria-label={t("nav.back")} onClick={onBack}>
          <span className="back-link-arrow" aria-hidden="true">
            ←
          </span>
        </button>
      )}
      <span className="nav-bar-title">{title}</span>
      {open && (
        <>
          {/* Click-outside-to-dismiss, same pattern as ConfirmationModal's backdrop. */}
          <div className="nav-drawer-backdrop" onClick={() => setOpen(false)} role="presentation" />
          <nav className="nav-drawer" aria-label={t("nav.menu")}>
            <div className="nav-drawer-header">
              <span className="nav-drawer-logo" aria-hidden="true">
                🩺
              </span>
              <span className="nav-drawer-app-name">{t("app.title")}</span>
            </div>
            <ul>
              {DESTINATIONS.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => selectDestination(d.id)}>
                    {t(d.titleKey)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </header>
  );
}
