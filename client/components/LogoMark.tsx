type LogoMarkProps = {
  className?: string;
};

// The CodeShare mark: </> in a rounded square, matching the favicon.
// Put the "group" class on the parent link to get the hover spread.
export function LogoMark({ className = "h-7 w-7" }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" className="fill-ink-900 stroke-ink-700" />
      <path
        d="M12.5 10.5 8 16l4.5 5.5"
        className="stroke-ink-100 transition-transform duration-300 group-hover:-translate-x-[1.5px]"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17.5 9.5 14.5 22.5" className="stroke-ink-500" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M19.5 10.5 24 16l-4.5 5.5"
        className="stroke-ink-100 transition-transform duration-300 group-hover:translate-x-[1.5px]"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}