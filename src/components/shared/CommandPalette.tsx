import { useEffect, useState } from "react";
import {
  BarChart3Icon,
  CopyIcon,
  FolderTreeIcon,
  GraduationCapIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  StarIcon,
  SunIcon,
  Trash2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useZoom } from "@/hooks/useZoom";
import { useProblemStore } from "@/stores/problemStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useFolderStore } from "@/stores/folderStore";
import { useUiStore } from "@/stores/uiStore";

export function CommandPalette() {
  const commandOpen = useUiStore((s) => s.commandOpen);
  const closeCommand = useUiStore((s) => s.closeCommand);
  const openSearch = useUiStore((s) => s.openSearch);
  const openReview = useUiStore((s) => s.openReview);
  const openStats = useUiStore((s) => s.openStats);
  const openTrash = useUiStore((s) => s.openTrash);
  const openSettings = useUiStore((s) => s.openSettings);
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const setView = useUiStore((s) => s.setView);

  const problems = useProblemStore((s) => s.problems);
  const selectedId = useProblemStore((s) => s.selectedId);
  const selectedProblem = useProblemStore((s) => s.selectedProblem);
  const newProblem = useProblemStore((s) => s.newProblem);
  const duplicateProblem = useProblemStore((s) => s.duplicateProblem);
  const toggleFavorite = useProblemStore((s) => s.toggleFavorite);
  const deleteProblem = useProblemStore((s) => s.deleteProblem);
  const selectProblem = useProblemStore((s) => s.selectProblem);

  const setTheme = useSettingsStore((s) => s.setTheme);
  const { zoomIn, zoomOut, resetZoom } = useZoom();

  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!commandOpen) setSearch("");
  }, [commandOpen]);

  // Close the palette first, then run the action, so a follow-up dialog
  // (search, settings, confirm…) isn't immediately dismissed by this one.
  function run(action: () => void) {
    closeCommand();
    action();
  }

  return (
    <CommandDialog
      open={commandOpen}
      onOpenChange={(open: boolean) => !open && closeCommand()}
      title="Command Palette"
      description="Run a command or jump to a problem"
    >
      <CommandInput value={search} onValueChange={setSearch} placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem value="new problem create" onSelect={() => run(() => void newProblem())}>
            <PlusIcon />
            New problem
          </CommandItem>
          <CommandItem value="search problems find" onSelect={() => run(openSearch)}>
            <SearchIcon />
            Search problems
          </CommandItem>
          {selectedId && selectedProblem && (
            <>
              <CommandItem
                value="favorite star current"
                onSelect={() => run(() => void toggleFavorite(selectedId))}
              >
                <StarIcon />
                {selectedProblem.favorite ? "Unfavorite current problem" : "Favorite current problem"}
              </CommandItem>
              <CommandItem
                value="duplicate current copy"
                onSelect={() => run(() => void duplicateProblem(selectedId))}
              >
                <CopyIcon />
                Duplicate current problem
              </CommandItem>
              <CommandItem
                value="delete trash current remove"
                onSelect={() =>
                  run(() =>
                    requestConfirm({
                      title: "Move problem to trash?",
                      description: "You can restore it later from Settings.",
                      confirmLabel: "Move to Trash",
                      destructive: true,
                      onConfirm: () => void deleteProblem(selectedId),
                    }),
                  )
                }
              >
                <Trash2Icon />
                Move current problem to trash
              </CommandItem>
            </>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Go to">
          <CommandItem
            value="folders explorer organize directory"
            onSelect={() =>
              run(() => {
                setView("folders");
                void useFolderStore.getState().openFolder(null);
              })
            }
          >
            <FolderTreeIcon />
            Folders
          </CommandItem>
          <CommandItem value="review spaced repetition" onSelect={() => run(openReview)}>
            <GraduationCapIcon />
            Review
          </CommandItem>
          <CommandItem value="statistics stats dashboard" onSelect={() => run(openStats)}>
            <BarChart3Icon />
            Statistics
          </CommandItem>
          <CommandItem value="trash deleted" onSelect={() => run(openTrash)}>
            <Trash2Icon />
            Trash
          </CommandItem>
          <CommandItem value="settings preferences" onSelect={() => run(openSettings)}>
            <SettingsIcon />
            Settings
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Appearance">
          <CommandItem value="theme system auto" onSelect={() => run(() => setTheme("system"))}>
            <MonitorIcon />
            Theme: System
          </CommandItem>
          <CommandItem value="theme light" onSelect={() => run(() => setTheme("light"))}>
            <SunIcon />
            Theme: Light
          </CommandItem>
          <CommandItem value="theme dark" onSelect={() => run(() => setTheme("dark"))}>
            <MoonIcon />
            Theme: Dark
          </CommandItem>
          <CommandItem value="zoom in bigger" onSelect={() => run(zoomIn)}>
            <ZoomInIcon />
            Zoom in
          </CommandItem>
          <CommandItem value="zoom out smaller" onSelect={() => run(zoomOut)}>
            <ZoomOutIcon />
            Zoom out
          </CommandItem>
          <CommandItem value="zoom reset default" onSelect={() => run(resetZoom)}>
            <ZoomInIcon />
            Reset zoom
          </CommandItem>
        </CommandGroup>

        {problems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Jump to problem">
              {problems.map((problem) => (
                <CommandItem
                  key={problem.id}
                  value={`${problem.problemName} ${problem.id}`}
                  onSelect={() => run(() => void selectProblem(problem.id))}
                >
                  <span className="flex-1 truncate">
                    {problem.problemName || "Untitled problem"}
                  </span>
                  <span className="text-xs text-muted-foreground">{problem.difficulty}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
