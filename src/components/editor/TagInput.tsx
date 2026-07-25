import { useId, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  presets?: readonly string[];
  className?: string;
}

/**
 * Compact, inline editor for a free-form list of tags (e.g. companies).
 * Existing tags render as removable badges; a "+ Tag" affordance reveals an
 * input with preset autocomplete. Enter adds, Backspace on an empty input
 * removes the last tag. Duplicates are ignored case-insensitively.
 */
export function TagInput({ tags, onChange, presets = [], className }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const listId = useId();

  function addTag(raw: string) {
    const value = raw.trim();
    setDraft("");
    if (!value) return;
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    onChange([...tags, value]);
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {tags.map((tag, index) => (
        <Badge key={`${tag}-${index}`} variant="secondary" className="gap-1 pr-1">
          <span className="max-w-[120px] truncate">{tag}</span>
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => removeTag(index)}
            className="rounded-full text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}

      {adding ? (
        <Input
          autoFocus
          list={listId}
          value={draft}
          placeholder="Add tag…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(draft);
            } else if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
              removeTag(tags.length - 1);
            }
          }}
          onBlur={() => {
            addTag(draft);
            setAdding(false);
          }}
          className="h-6 w-28 bg-input/30 px-2 text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-5 shrink-0 items-center gap-0.5 rounded-full border border-dashed border-border px-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          <PlusIcon className="size-3" />
          Tag
        </button>
      )}

      <datalist id={listId}>
        {presets.map((preset) => (
          <option key={preset} value={preset} />
        ))}
      </datalist>
    </div>
  );
}
