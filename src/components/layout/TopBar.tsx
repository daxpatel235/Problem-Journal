import { SearchIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClock } from "@/hooks/useClock";
import { useUiStore } from "@/stores/uiStore";

export function TopBar() {
  const { day, date, time } = useClock();
  const openSearch = useUiStore((s) => s.openSearch);
  const openSettings = useUiStore((s) => s.openSettings);

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-sidebar px-3">
      <div className="flex min-w-0 flex-col leading-none">
        <span className="text-xs font-semibold text-foreground">Problem Journal</span>
        <span className="hidden text-[10px] text-muted-foreground sm:block">
          Every problem. Every pattern. Every insight.
        </span>
      </div>

      <div className="flex items-baseline gap-2 font-mono text-xs text-muted-foreground">
        <span>{day}</span>
        <span className="opacity-50">&middot;</span>
        <span>{date}</span>
        <span className="opacity-50">&middot;</span>
        <span className="tabular-nums text-foreground">{time}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Search"
          onClick={openSearch}
        >
          <SearchIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Settings"
          onClick={openSettings}
        >
          <SettingsIcon className="size-4" />
        </Button>
      </div>
    </header>
  );
}
