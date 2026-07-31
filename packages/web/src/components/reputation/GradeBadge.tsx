import { Badge } from "@/components/ui/Badge";
import { gradeLabel, gradeTone } from "@/lib/directory";

/**
 * Renders a supplier's composite risk grade (ScoreOracle) as a coloured badge:
 * A+/A → success, B/C → brand, D → warn, E/F → danger, ungraded → neutral.
 */
export function GradeBadge({ grade }: { grade: number }) {
  return (
    <Badge tone={gradeTone(grade)}>
      Grade {gradeLabel(grade)}
    </Badge>
  );
}
