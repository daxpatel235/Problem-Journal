import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { TimelineItem } from "@/components/timeline/TimelineItem";
import type { ProblemGroup } from "@/lib/dateGroups";

interface TimelineGroupProps {
  group: ProblemGroup;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TimelineGroup({ group, selectedId, onSelect }: TimelineGroupProps) {
  const [collapsed, setCollapsed] = useState(group.collapsedByDefault);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRightIcon className="size-3" />
        ) : (
          <ChevronDownIcon className="size-3" />
        )}
        {group.label}
        <span className="font-normal normal-case opacity-60">({group.items.length})</span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-0.5">
          {group.items.map((item) => (
            <TimelineItem
              key={item.id}
              problem={item}
              selected={item.id === selectedId}
              onSelect={() => onSelect(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
