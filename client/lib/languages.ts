export const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
] as const;

const LANGUAGE_BADGE_CLASSES: Record<string, string> = {
  javascript: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  typescript: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  python: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  cpp: "border-pink-500/30 bg-pink-500/10 text-pink-400",
  java: "border-orange-500/30 bg-orange-500/10 text-orange-400",
};

export function getLanguageBadgeClasses(language: string): string {
  return LANGUAGE_BADGE_CLASSES[language] || "border-neutral-700 bg-neutral-900 text-neutral-400";
}