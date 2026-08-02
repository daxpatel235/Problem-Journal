import { Textarea } from "@/components/ui/textarea";

interface ProblemStatementProps {
  statement: string;
  onChange: (value: string) => void;
}

export function ProblemStatement({ statement, onChange }: ProblemStatementProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Problem Statement
      </h3>

      {!statement.trim() && (
        <p className="text-sm text-muted-foreground/70 italic">No statement yet.</p>
      )}

      <Textarea
        value={statement}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the problem..."
        rows={4}
        className="min-h-0 flex-1 resize-none bg-input/30 text-sm"
      />
    </div>
  );
}
