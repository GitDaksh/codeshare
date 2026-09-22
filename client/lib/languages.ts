export const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
] as const;

export function getLanguageBadgeClasses(_language: string): string {
  return "border-ink-700 bg-ink-900 text-ink-400";
}

const STARTER_COMMENTS: Record<string, string> = {
  javascript: "// Welcome to CodeShare — start typing and everyone in the room sees it live.",
  typescript: "// Welcome to CodeShare — start typing and everyone in the room sees it live.",
  python: "# Welcome to CodeShare — start typing and everyone in the room sees it live.",
  cpp: "// Welcome to CodeShare — start typing and everyone in the room sees it live.",
  java: "// Welcome to CodeShare — start typing and everyone in the room sees it live.",
};

export function getStarterCode(language: string): string {
  return STARTER_COMMENTS[language] ?? STARTER_COMMENTS.javascript;
}