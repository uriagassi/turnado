import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import he from "./locales/he.json";

// One flat locale-strings file per language (no per-feature namespaces —
// the app is a handful of screens). Language is never chosen via a
// switcher; App.tsx calls applyLocale() with the locale the server
// resolved from the logged-in username (see server/src/i18n/locale.ts).
const RTL_LOCALES = new Set(["he"]);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function applyLocale(locale: string): void {
  void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

export default i18n;
