import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { ZOOM_LEVELS, type ZoomLevel } from "@/types/settings";

export function useZoom() {
  const zoomLevel = useSettingsStore((s) => s.zoomLevel);
  const setZoom = useSettingsStore((s) => s.setZoom);

  useEffect(() => {
    document.documentElement.style.fontSize = `${zoomLevel}%`;
  }, [zoomLevel]);

  const step = (direction: 1 | -1) => {
    const idx = ZOOM_LEVELS.indexOf(zoomLevel);
    const safeIdx = idx === -1 ? ZOOM_LEVELS.indexOf(100) : idx;
    const nextIdx = Math.min(Math.max(safeIdx + direction, 0), ZOOM_LEVELS.length - 1);
    const next = ZOOM_LEVELS[nextIdx] as ZoomLevel;
    setZoom(next);
  };

  return {
    zoomLevel,
    zoomIn: () => step(1),
    zoomOut: () => step(-1),
    resetZoom: () => setZoom(100),
  };
}
