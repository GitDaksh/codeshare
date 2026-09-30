const ITEMS = [
  "Lens visualizer",
  "100 practice problems",
  "Big-O meter",
  "Conflict-free editing",
  "Follow mode",
  "Live cursors",
  "Shared runs",
  "Room chat",
  "Activity streaks",
  "⌘K palette",
  "Python",
  "JavaScript",
  "TypeScript",
];

// Two identical copies side by side, scrolled by exactly -50%, make the loop
// seamless. Each item carries its own right padding (instead of a flex gap)
// so both halves are exactly equal in width.
export function Marquee() {
  return (
    <div className="marquee-mask overflow-hidden">
      <div className="animate-marquee flex w-max">
        {[...ITEMS, ...ITEMS].map((item, i) => (
          <span
            key={i}
            aria-hidden={i >= ITEMS.length ? true : undefined}
            className="flex items-center gap-8 whitespace-nowrap pr-8 font-[family-name:var(--font-mono)] text-sm text-ink-500"
          >
            {item}
            <span className="text-ink-700">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}