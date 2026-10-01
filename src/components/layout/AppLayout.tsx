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
import { FolderExplorer } from "@/components/folders/FolderExplorer";
import { FocusedProblemView } from "@/components/folders/FocusedProblemView";
import { useSettingsStore } from "@/stores/settingsStore";
import { useFolderStore } from "@/stores/folderStore";
import { useProblemStore } from "@/stores/problemStore";
import { useUiStore } from "@/stores/uiStore";

const MIN_TIMELINE_WIDTH = 18;
const MAX_TIMELINE_WIDTH = 55;

/**
 * In the folder view the editor is only visible while a problem is open full
 * screen. Keep that in sync with selection changes made from elsewhere
 * (search, command palette, Ctrl+N…): a newly chosen problem opens full
 * screen, and if the open one goes away (trashed) we fall back to the folder.
 */
function useFolderFocusSync() {
  const view = useUiStore((s) => s.view);
  const selectedProblem = useProblemStore((s) => s.selectedProblem);
  const selectedId = useProblemStore((s) => s.selectedId);
  const isNew = useProblemStore((s) => s.isNew);
  const focusOpen = useFolderStore((s) => s.focusOpen);
  const setFocusOpen = useFolderStore((s) => s.setFocusOpen);
  const previous = useRef({ selectedId, isNew });

  useEffect(() => {
    const prev = previous.current;
    previous.current = { selectedId, isNew };
    if (view !== "folders") return;
    if (!selectedProblem) {
      if (focusOpen) setFocusOpen(false);
      return;
    }
    const switched = selectedId !== prev.selectedId || (isNew && !prev.isNew);
    // A brand-new problem getting its id on first save is the same problem.
    const firstSave = prev.isNew && !isNew && prev.selectedId === null;
    if (switched && !firstSave && !focusOpen) setFocusOpen(true);
  }, [view, selectedProblem, selectedId, isNew, focusOpen, setFocusOpen]);
}

export function AppLayout() {
  const view = useUiStore((s) => s.view);
  const focusOpen = useFolderStore((s) => s.focusOpen);
  useFolderFocusSync();
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
        {view === "folders" ? (
          <div className="flex flex-1 overflow-hidden">
            {focusOpen ? <FocusedProblemView /> : <FolderExplorer />}
          </div>
        ) : (
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
        )}
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
