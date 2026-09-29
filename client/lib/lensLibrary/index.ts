import { ARRAY_CONCEPTS } from "./arrays";
import { RECURSION_CONCEPTS } from "./recursion";
import { SORTING_CONCEPTS } from "./sorting";
import { STRUCTURE_CONCEPTS } from "./structures";
import { TREE_CONCEPTS } from "./trees";

// The Lens library: classic algorithms and data structures, each written in
// Python, JavaScript and TypeScript with small inputs, so every run is short
// and the pictures stay readable. Every program prints the same result in all
// three languages.

export type LensLanguage = "python" | "javascript" | "typescript";

export type LensCategoryId =
  | "arrays"
  | "searching"
  | "hashing"
  | "sorting"
  | "stacks"
  | "linked"
  | "heaps"
  | "trees"
  | "graphs"
  | "recursion"
  | "dp";

export type LensConcept = {
  id: string;
  title: string;
  category: LensCategoryId;
  // One sentence: what you'll watch happen.
  summary: string;
  // Time complexity, as a short label.
  complexity: string;
  code: Record<LensLanguage, string>;
};

export const LENS_CATEGORIES: { id: LensCategoryId; label: string }[] = [
  { id: "arrays", label: "Arrays & pointers" },
  { id: "searching", label: "Searching" },
  { id: "hashing", label: "Hashing" },
  { id: "sorting", label: "Sorting" },
  { id: "stacks", label: "Stacks & queues" },
  { id: "linked", label: "Linked lists" },
  { id: "heaps", label: "Heaps" },
  { id: "trees", label: "Trees" },
  { id: "graphs", label: "Graphs" },
  { id: "recursion", label: "Recursion & backtracking" },
  { id: "dp", label: "Dynamic programming" },
];

export const LENS_CONCEPTS: LensConcept[] = [
  ...ARRAY_CONCEPTS,
  ...SORTING_CONCEPTS,
  ...STRUCTURE_CONCEPTS,
  ...TREE_CONCEPTS,
  ...RECURSION_CONCEPTS,
].sort(
  (a, b) =>
    LENS_CATEGORIES.findIndex((category) => category.id === a.category) -
    LENS_CATEGORIES.findIndex((category) => category.id === b.category),
);

export function findConcept(id: string): LensConcept | undefined {
  return LENS_CONCEPTS.find((concept) => concept.id === id);
}

export function categoryLabel(id: LensCategoryId): string {
  return LENS_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}