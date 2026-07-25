import { useState } from "react";
import { GripVerticalIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface DynamicListProps {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
}

export function DynamicList({ title, items, onChange }: DynamicListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function updateItem(index: number, value: string) {
    const next = [...items];
    next[index] = value;
    onChange(next);
  }

  function addItem() {
    onChange([...items, ""]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved as string);
    onChange(next);
    setDragIndex(null);
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground/70 italic">No entries yet.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
            className={cn(
              "group flex items-start gap-2 rounded-md",
              dragIndex === index && "opacity-50",
            )}
          >
            <GripVerticalIcon className="mt-2 size-3.5 shrink-0 cursor-grab text-muted-foreground/50" />
            <span className="mt-1.5 w-4 shrink-0 text-right text-xs text-muted-foreground">
              {index + 1}.
            </span>
            <Textarea
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              rows={2}
              className="min-h-0 flex-1 resize-none bg-input/30 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeItem(index)}
              className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100"
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="mt-1 w-fit gap-1"
      >
        <PlusIcon className="size-3.5" />
        Add
      </Button>
    </div>
  );
}
