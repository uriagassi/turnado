import "@testing-library/jest-dom/vitest";
// Same side-effect import main.tsx uses to initialize the app's i18n
// singleton — components using useTranslation() need it initialized before
// they render, and there's no provider wrapping tests.
import "./i18n";
