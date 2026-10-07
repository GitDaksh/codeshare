// The shared building blocks of the interface, as class lists. Pages and
// components use these instead of inventing their own, so every button,
// card and field looks and behaves the same everywhere.

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const ui = {
  // Buttons: one look per role, at two sizes (default 36px, small 32px).
  primary: `${BUTTON_BASE} h-9 bg-ink-100 px-3.5 text-ink-950 shadow-xs hover:bg-ink-200`,
  secondary: `${BUTTON_BASE} h-9 border border-ink-700 bg-ink-900 px-3.5 text-ink-100 shadow-xs hover:bg-ink-950 hover:border-ink-600`,
  ghost: `${BUTTON_BASE} h-9 px-3 text-ink-400 hover:bg-ink-800 hover:text-ink-100`,
  danger: `${BUTTON_BASE} h-9 border border-danger-line bg-ink-900 px-3.5 text-danger shadow-xs hover:bg-danger-soft`,
  primarySm: `${BUTTON_BASE} h-8 bg-ink-100 px-3 text-xs text-ink-950 shadow-xs hover:bg-ink-200`,
  secondarySm: `${BUTTON_BASE} h-8 border border-ink-700 bg-ink-900 px-3 text-xs text-ink-100 shadow-xs hover:bg-ink-950 hover:border-ink-600`,
  ghostSm: `${BUTTON_BASE} h-8 px-2.5 text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100`,
  icon: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-100",

  // Surfaces.
  card: "rounded-xl border border-ink-800 bg-ink-900 shadow-xs",
  cardHover: "rounded-xl border border-ink-800 bg-ink-900 shadow-xs transition-all hover:border-ink-700 hover:shadow-card",
  inset: "rounded-lg border border-ink-800 bg-ink-950",

  // Fields.
  input:
    "h-9 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 text-sm text-ink-100 shadow-xs placeholder:text-ink-500 transition-colors focus:border-ink-500 focus:outline-none focus:ring-4 focus:ring-ink-100/[0.06]",
  textarea:
    "w-full resize-none rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm leading-relaxed text-ink-100 shadow-xs placeholder:text-ink-500 transition-colors focus:border-ink-500 focus:outline-none focus:ring-4 focus:ring-ink-100/[0.06]",
  label: "mb-1.5 block text-sm font-medium text-ink-200",

  // Small labels.
  badge: "inline-flex items-center gap-1 rounded-md border border-ink-800 bg-ink-950 px-1.5 py-0.5 text-[11px] font-medium text-ink-400",
  badgeDark: "inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-950",
  sectionTitle: "text-sm font-semibold text-ink-100",
  eyebrow: "text-xs font-medium uppercase tracking-wider text-ink-500",
} as const;