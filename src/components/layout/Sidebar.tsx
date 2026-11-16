import type { ComponentType } from "react";
import {
  BarChart3Icon,
  FolderTreeIcon,
  GraduationCapIcon,
  ListTreeIcon,
  SettingsIcon,
  ShareIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useExportStore } from "@/stores/exportStore";
import { useProblemStore } from "@/stores/problemStore";
import { useFolderStore } from "@/stores/folderStore";
import { useUiStore } from "@/stores/uiStore";

interface SidebarItem {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}

function SidebarButton({ item }: { item: SidebarItem }) {
  return (
    <button
      type="button"
      title={item.label}
      aria-label={item.label}
      aria-current={item.active ? "page" : undefined}
      onClick={item.onClick}
      className={cn(
        "relative flex size-10 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        item.active && "bg-sidebar-accent text-sidebar-foreground",
      )}
    >
      {item.active && <span className="absolute left-0 h-5 w-0.5 rounded-r bg-primary" />}
      <item.icon className="size-4.5" />
    </button>
  );
}

export function Sidebar() {
  const filters = useProblemStore((s) => s.filters);
  const setFilters = useProblemStore((s) => s.setFilters);
  const openSettings = useUiStore((s) => s.openSettings);
  const openTrash = useUiStore((s) => s.openTrash);
  const openStats = useUiStore((s) => s.openStats);
  const openReview = useUiStore((s) => s.openReview);
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const focusOpen = useFolderStore((s) => s.focusOpen);
  const closeProblem = useFolderStore((s) => s.closeProblem);
  const openFolder = useFolderStore((s) => s.openFolder);
  const openExport = useExportStore((s) => s.openExport);

  const favoritesActive = filters.favoritesOnly === true;
  const inTimeline = view === "timeline";
  const inFolders = view === "folders";
  const inExport = view === "export";

  // Leaving the explorer keeps whatever problem was open, so the timeline
  // view simply shows it in the editor.
  function showTimeline(nextFilters: typeof filters) {
    if (!inTimeline) {
      if (inFolders && focusOpen) void closeProblem();
      setView("timeline");
    }
    void setFilters(nextFilters);
  }

  function showFolders() {
    if (inFolders) {
      // Clicking Folders again jumps back to the top level, like a home button.
      if (focusOpen) void closeProblem();
      void openFolder(null);
      return;
    }
    setView("folders");
    void openFolder(useFolderStore.getState().currentFolderId);
  }

  const topItems: SidebarItem[] = [
    {
      key: "problems",
      label: "All Problems",
      icon: ListTreeIcon,
      active: inTimeline && !favoritesActive,
      onClick: () => showTimeline({ ...filters, favoritesOnly: undefined }),
    },
    {
      key: "favorites",
      label: "Favorites",
      icon: StarIcon,
      active: inTimeline && favoritesActive,
      onClick: () => showTimeline({ ...filters, favoritesOnly: true }),
    },
    {
      key: "folders",
      label: "Folders",
      icon: FolderTreeIcon,
      active: inFolders,
      onClick: showFolders,
    },
    {
      key: "review",
      label: "Review",
      icon: GraduationCapIcon,
      active: false,
      onClick: openReview,
    },
    {
      key: "stats",
      label: "Statistics",
      icon: BarChart3Icon,
      active: false,
      onClick: openStats,
    },
    {
      key: "trash",
      label: "Trash",
      icon: Trash2Icon,
      active: false,
      onClick: openTrash,
    },
  ];

  // Pinned to the bottom, VS Code style.
  const bottomItems: SidebarItem[] = [
    {
      key: "export",
      label: "Export (Ctrl+Shift+E)",
      icon: ShareIcon,
      active: inExport,
      // Clicking it while already there starts a fresh export.
      onClick: () => void openExport(),
    },
    {
      key: "settings",
      label: "Settings",
      icon: SettingsIcon,
      active: false,
      onClick: openSettings,
    },
  ];

  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-2">
      {topItems.map((item) => (
        <SidebarButton key={item.key} item={item} />
      ))}
      <div className="flex-1" aria-hidden />
      {bottomItems.map((item) => (
        <SidebarButton key={item.key} item={item} />
      ))}
    </nav>
  );
}
