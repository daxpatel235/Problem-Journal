import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ResizableDivider } from "@/components/layout/ResizableDivider";
import { TimelinePanel } from "@/components/timeline/TimelinePanel";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { SearchDialog } from "@/components/shared/SearchDialog";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { SettingsPanel } from "@/components/shared/SettingsPanel";
import { StatsPanel } from "@/components/shared/StatsPanel";
import { ReviewPanel } from "@/components/shared/ReviewPanel";
import { TrashDialog } from "@/components/shared/TrashDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useSettingsStore } from "@/stores/settingsStore";

const MIN_TIMELINE_WIDTH = 18;
const MAX_TIMELINE_WIDTH = 55;

export function AppLayout() {
  const storedWidth = useSettingsStore((s) => s.timelineWidth);
  const persistTimelineWidth = useSettingsStore((s) => s.setTimelineWidth);

  const [width, setWidth] = useState(storedWidth);
  const widthRef = useRef(storedWidth);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWidth(storedWidth);
    widthRef.current = storedWidth;
  }, [storedWidth]);

  function handleDrag(deltaX: number) {
    const containerWidth = containerRef.current?.offsetWidth ?? 1000;
    const deltaPercent = (deltaX / containerWidth) * 100;
    setWidth((w) => {
      const next = Math.min(MAX_TIMELINE_WIDTH, Math.max(MIN_TIMELINE_WIDTH, w + deltaPercent));
      widthRef.current = next;
      return next;
    });
  }

  function handleDragEnd() {
    persistTimelineWidth(widthRef.current);
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div ref={containerRef} className="flex flex-1 overflow-hidden">
          <div
            style={{ width: `${width}%` }}
            className="flex min-w-[220px] flex-col overflow-hidden"
          >
            <TimelinePanel />
          </div>
          <ResizableDivider onDrag={handleDrag} onDragEnd={handleDragEnd} />
          <EditorPanel />
        </div>
      </div>

      <SearchDialog />
      <CommandPalette />
      <SettingsPanel />
      <StatsPanel />
      <ReviewPanel />
      <TrashDialog />
      <ConfirmDialog />
    </div>
  );
}
