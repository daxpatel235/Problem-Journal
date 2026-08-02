import { ComboField } from "@/components/editor/ComboField";
import { COMPLEXITY_PRESETS } from "@/lib/presets";

interface ComplexityFieldsProps {
  bruteForceTimeComplexity: string;
  bruteForceSpaceComplexity: string;
  timeComplexity: string;
  spaceComplexity: string;
  onChange: (patch: {
    bruteForceTimeComplexity?: string;
    bruteForceSpaceComplexity?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
  }) => void;
}

export function ComplexityFields({
  bruteForceTimeComplexity,
  bruteForceSpaceComplexity,
  timeComplexity,
  spaceComplexity,
  onChange,
}: ComplexityFieldsProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Complexity
      </h3>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ComboField
          label="Brute Force Time"
          value={bruteForceTimeComplexity}
          onChange={(value) => onChange({ bruteForceTimeComplexity: value })}
          presets={COMPLEXITY_PRESETS}
          placeholder="e.g. O(n^2)"
        />
        <ComboField
          label="Brute Force Space"
          value={bruteForceSpaceComplexity}
          onChange={(value) => onChange({ bruteForceSpaceComplexity: value })}
          presets={COMPLEXITY_PRESETS}
          placeholder="e.g. O(1)"
        />
        <ComboField
          label="Optimal Time"
          value={timeComplexity}
          onChange={(value) => onChange({ timeComplexity: value })}
          presets={COMPLEXITY_PRESETS}
          placeholder="e.g. O(n)"
        />
        <ComboField
          label="Optimal Space"
          value={spaceComplexity}
          onChange={(value) => onChange({ spaceComplexity: value })}
          presets={COMPLEXITY_PRESETS}
          placeholder="e.g. O(1)"
        />
      </div>
    </div>
  );
}
