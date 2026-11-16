import type { ComponentType } from "react";
import {
  FileCodeIcon,
  FolderTreeIcon,
  LibraryIcon,
  ListChecksIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useExportStore, type ExportMode } from "@/stores/exportStore";
import { useFolderStore } from "@/stores/folderStore";
import { useProblemStore } from "@/stores/problemStore";

interface ModeCard {
  mode: ExportMode;
  title: string;
  description: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function ExportModeStep() {
  const index = useExportStore((s) => s.index);
  const mode = useExportStore((s) => s.mode);
  const chooseMode = useExportStore((s) => s.chooseMode);
  const folders = useFolderStore((s) => s.folders);
  const openProblem = useProblemStore((s) => s.selectedProblem);
  const timelineProblems = useProblemStore((s) => s.problems);
  const filters = useProblemStore((s) => s.filters);

  const total = index?.problemById.size ?? 0;
  const filtersActive = Object.entries(filters).some(
    ([key, v]) => key !== "sort" && v !== undefined && v !== "" && v !== false,
  );
  const filteredCount = timelineProblems.filter((p) => index?.problemById.has(p.id)).length;

  const cards: ModeCard[] = [
    {
      mode: "one",
      title: "One problem",
      description: "A single problem as its own PDF.",
      hint:
        openProblem?.id && openProblem.problemName
          ? `Starts with "${openProblem.problemName}"`
          : "Pick it on the next step",
      icon: FileCodeIcon,
    },
    {
      mode: "selected",
      title: "Selected problems",
      description: "Tick any problems from any folder and export them together.",
      hint: "Choose freely on the next step",
      icon: ListChecksIcon,
    },
    {
      mode: "folder",
      title: "A folder",
      description: "Everything in a folder, including its subfolders.",
      hint: folders.length > 0 ? plural(folders.length, "folder") : "You have no folders yet",
      icon: FolderTreeIcon,
      disabled: folders.length === 0,
    },
    {
      mode: "filtered",
      title: "Filtered results",
      description: "What your problem list shows right now with its filters.",
      hint: filtersActive
        ? `${plural(filteredCount, "problem")} match your filters`
        : "No filters set: starts with every problem",
      icon: SlidersHorizontalIcon,
    },
    {
      mode: "all",
      title: "Everything",
      description: "Your whole journal in one PDF.",
      hint: plural(total, "problem"),
      icon: LibraryIcon,
    },
  ];

  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
        <p className="text-sm font-medium">Nothing to export yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Log a problem first, then come back here to turn it into a PDF.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 p-6">
        <div>
          <h2 className="text-base font-semibold">What do you want to export?</h2>
          <p className="text-sm text-muted-foreground">
            You can still add or remove problems on the next step.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <button
              key={card.mode}
              type="button"
              disabled={card.disabled}
              onClick={() => chooseMode(card.mode)}
              className={cn(
                "group flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-colors",
                "hover:border-primary/60 hover:bg-hover focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-surface",
                mode === card.mode && "border-primary",
              )}
            >
              <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <card.icon className="size-4" />
              </span>
              <span className="text-sm font-medium">{card.title}</span>
              <span className="text-xs text-muted-foreground">{card.description}</span>
              <span className="mt-auto pt-1 text-[11px] text-muted-foreground/80">{card.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
