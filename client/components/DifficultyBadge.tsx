import type { Difficulty } from "@/lib/problems";

const LEVEL: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };

// Difficulty as rising "signal bars" rather than traffic-light colors, so it
// stays readable in the black-and-white theme.
export function DifficultyBadge({ difficulty, size = "sm" }: { difficulty: Difficulty; size?: "sm" | "md" }) {
  const level = LEVEL[difficulty];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-700 bg-ink-800 font-medium text-ink-100 ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      <span aria-hidden="true" className="flex items-end gap-[2px]">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`w-[3px] rounded-full ${bar <= level ? "bg-ink-100" : "bg-ink-600"}`}
            style={{ height: 3 + bar * 2 }}
          />
        ))}
      </span>
      {difficulty}
    </span>
  );
}