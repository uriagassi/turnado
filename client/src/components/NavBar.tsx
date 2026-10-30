import { ArrowLeft, Menu, Moon, Stethoscope, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWideLayout } from "../hooks/useWideLayout";
import { applyTheme, getStoredTheme, type Theme } from "../theme";

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
  current,
  onNavigate,
  onBack,
}: {
  /** The top-level destination the current screen belongs to, marked in the menu. */
  current?: NavDestination;
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
  const wide = useWideLayout();
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

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

  const themeToggle = (
    <div className="nav-drawer-footer">
      <span className="nav-drawer-footer-label">{t("nav.theme.label")}</span>
      <button
        type="button"
        role="switch"
        aria-checked={theme === "dark"}
        aria-label={t("nav.theme.toggle")}
        className="theme-toggle"
        onClick={toggleTheme}
      >
        <span className="theme-toggle-thumb" aria-hidden="true">
          {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
        </span>
      </button>
    </div>
  );

  const menu = (onSelect: (d: NavDestination) => void, className: string) => (
    <nav className={className} aria-label={t("nav.menu")}>
      <div className="nav-drawer-header">
        <span className="nav-drawer-logo" aria-hidden="true">
          <Stethoscope size={24} />
        </span>
        <span className="nav-drawer-app-name">{t("app.title")}</span>
      </div>
      <ul>
        {DESTINATIONS.map((d) => (
          <li key={d.id}>
            <button type="button" aria-current={d.id === current ? "page" : undefined} onClick={() => onSelect(d.id)}>
              {t(d.titleKey)}
            </button>
          </li>
        ))}
      </ul>
      {themeToggle}
    </nav>
  );

  return (
    <header className="nav-bar">
      {!wide && (
        <button
          type="button"
          className="nav-bar-menu-toggle"
          aria-label={t("nav.menu")}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Menu aria-hidden="true" />
        </button>
      )}
      {onBack && (
        <button type="button" className="nav-bar-back" aria-label={t("nav.back")} onClick={onBack}>
          <ArrowLeft className="back-link-arrow" aria-hidden="true" />
        </button>
      )}
      <h1 className="nav-bar-title">{title}</h1>
      {wide && menu(onNavigate, "nav-sidebar")}
      {!wide && open && (
        <>
          {/* Click-outside-to-dismiss, same pattern as ConfirmationModal's backdrop. */}
          <div className="nav-drawer-backdrop" onClick={() => setOpen(false)} role="presentation" />
          {menu(selectDestination, "nav-drawer")}
        </>
      )}
    </header>
  );
}
