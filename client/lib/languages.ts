export const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
] as const;

export function getLanguageBadgeClasses(): string {
  return "border-ink-700 bg-ink-900 text-ink-400";
}