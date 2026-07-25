import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ComboFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets: readonly string[];
  placeholder?: string;
}

export function ComboField({ label, value, onChange, presets, placeholder }: ComboFieldProps) {
  const listId = useId();

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        list={listId}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 bg-input/30"
      />
      <datalist id={listId}>
        {presets.map((preset) => (
          <option key={preset} value={preset} />
        ))}
      </datalist>
    </div>
  );
}
