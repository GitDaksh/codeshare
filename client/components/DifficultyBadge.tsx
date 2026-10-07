import type { Difficulty } from "@/lib/problems";

const LEVEL: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };

const TONE: Record<Difficulty, { badge: string; bar: string }> = {
  Easy: { badge: "border-success-line bg-success-soft text-success", bar: "bg-success-strong" },
  Medium: { badge: "border-warning-line bg-warning-soft text-warning", bar: "bg-warning-strong" },
  Hard: { badge: "border-danger-line bg-danger-soft text-danger", bar: "bg-danger-strong" },
};

// Difficulty in the colors everyone expects (green, amber, red), plus rising
// bars, so it reads at a glance and without relying on color alone.
export function DifficultyBadge({ difficulty, size = "sm" }: { difficulty: Difficulty; size?: "sm" | "md" }) {
  const level = LEVEL[difficulty];
  const tone = TONE[difficulty];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border font-medium ${tone.badge} ${
        size === "md" ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[11px]"
      }`}
    >
      <span aria-hidden="true" className="flex items-end gap-[2px]">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`w-[3px] rounded-full ${bar <= level ? tone.bar : "bg-current opacity-20"}`}
            style={{ height: 3 + bar * 2 }}
          />
        ))}
      </span>
      {difficulty}
    </span>
  );
}