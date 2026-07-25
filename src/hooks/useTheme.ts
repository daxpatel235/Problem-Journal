import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Applies the active theme to the document. In "system" mode it follows the OS
 * preference live; "light"/"dark" force a fixed theme. The resolved value is
 * stored so components (e.g. the Monaco editor) can match it.
 */
export function useTheme() {
  const theme = useSettingsStore((s) => s.theme);
  const setResolvedTheme = useSettingsStore((s) => s.setResolvedTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");

    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "light" : "dark") : theme;
      document.documentElement.setAttribute("data-theme", resolved);
      setResolvedTheme(resolved);
    };

    apply();
    if (theme !== "system") return;

    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, setResolvedTheme]);
}
