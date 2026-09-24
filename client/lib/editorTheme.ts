import type { Monaco } from "@monaco-editor/react";

type ThemeData = Parameters<Monaco["editor"]["defineTheme"]>[1];

// Token colors are 6-digit hex without "#" (Monaco's format for rules).
// `selection` is 8-digit hex (with alpha) because it's drawn over code.
type Palette = {
  foreground: string;
  keyword: string;
  keywordBold?: boolean;
  string: string;
  number: string;
  type: string;
  regexp: string;
  comment: string;
  delimiter: string;
  operator: string;
  cursor: string;
  selection: string;
  activeLineNumber: string;
};

export type EditorThemeOption = {
  id: string;
  label: string;
  description: string;
  swatches: string[];
  palette: Palette;
};

// Every theme shares the room's near-black background, so switching themes
// only recolors the code and never clashes with the rest of the interface.
const BACKGROUND = "#0d0d0d";

export const EDITOR_THEMES: EditorThemeOption[] = [
  {
    id: "codeshare-dark",
    label: "CodeShare",
    description: "Soft tones that match the app",
    swatches: ["#ffffff", "#a6d19b", "#e3b77e", "#8fc6db"],
    palette: {
      foreground: "d4d4d4",
      keyword: "ffffff",
      keywordBold: true,
      string: "a6d19b",
      number: "e3b77e",
      type: "8fc6db",
      regexp: "d7a6d7",
      comment: "5f5f5f",
      delimiter: "8a8a8a",
      operator: "a3a3a3",
      cursor: "ffffff",
      selection: "ffffff26",
      activeLineNumber: "cfcfcf",
    },
  },
  {
    id: "codeshare-mono",
    label: "Mono",
    description: "Pure grayscale",
    swatches: ["#ffffff", "#d6d6d6", "#b0b0b0", "#555555"],
    palette: {
      foreground: "cfcfcf",
      keyword: "ffffff",
      keywordBold: true,
      string: "b0b0b0",
      number: "d6d6d6",
      type: "e6e6e6",
      regexp: "bdbdbd",
      comment: "555555",
      delimiter: "7a7a7a",
      operator: "9a9a9a",
      cursor: "ffffff",
      selection: "ffffff26",
      activeLineNumber: "e6e6e6",
    },
  },
  {
    id: "codeshare-midnight",
    label: "Midnight",
    description: "Classic, balanced colors",
    swatches: ["#c678dd", "#98c379", "#d19a66", "#e5c07b"],
    palette: {
      foreground: "abb2bf",
      keyword: "c678dd",
      string: "98c379",
      number: "d19a66",
      type: "e5c07b",
      regexp: "56b6c2",
      comment: "5c6370",
      delimiter: "8b93a1",
      operator: "56b6c2",
      cursor: "528bff",
      selection: "528bff33",
      activeLineNumber: "d7dae0",
    },
  },
  {
    id: "codeshare-glacier",
    label: "Glacier",
    description: "Cool, calm blues",
    swatches: ["#81a1c1", "#a3be8c", "#b48ead", "#8fbcbb"],
    palette: {
      foreground: "d8dee9",
      keyword: "81a1c1",
      string: "a3be8c",
      number: "b48ead",
      type: "8fbcbb",
      regexp: "ebcb8b",
      comment: "616e88",
      delimiter: "a7b1c2",
      operator: "81a1c1",
      cursor: "d8dee9",
      selection: "88c0d033",
      activeLineNumber: "eceff4",
    },
  },
  {
    id: "codeshare-ember",
    label: "Ember",
    description: "Warm rose and gold",
    swatches: ["#eb6f92", "#f6c177", "#ea9a97", "#9ccfd8"],
    palette: {
      foreground: "e0def4",
      keyword: "eb6f92",
      string: "f6c177",
      number: "ea9a97",
      type: "9ccfd8",
      regexp: "c4a7e7",
      comment: "6e6a86",
      delimiter: "908caa",
      operator: "ebbcba",
      cursor: "f6c177",
      selection: "f6c17733",
      activeLineNumber: "e0def4",
    },
  },
  {
    id: "codeshare-neon",
    label: "Neon",
    description: "Bright and vivid",
    swatches: ["#bb9af7", "#9ece6a", "#ff9e64", "#7dcfff"],
    palette: {
      foreground: "c0caf5",
      keyword: "bb9af7",
      string: "9ece6a",
      number: "ff9e64",
      type: "7dcfff",
      regexp: "b4f9f8",
      comment: "565f89",
      delimiter: "89ddff",
      operator: "89ddff",
      cursor: "c0caf5",
      selection: "7aa2f733",
      activeLineNumber: "c0caf5",
    },
  },
];

export const DEFAULT_EDITOR_THEME = EDITOR_THEMES[0].id;

export function isEditorTheme(id: string): boolean {
  return EDITOR_THEMES.some((theme) => theme.id === id);
}

function buildTheme(p: Palette): ThemeData {
  return {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: p.foreground },
      { token: "comment", foreground: p.comment, fontStyle: "italic" },
      { token: "comment.doc", foreground: p.comment, fontStyle: "italic" },
      { token: "keyword", foreground: p.keyword, ...(p.keywordBold ? { fontStyle: "bold" } : {}) },
      { token: "identifier", foreground: p.foreground },
      { token: "variable", foreground: p.foreground },
      { token: "variable.predefined", foreground: p.type },
      { token: "type", foreground: p.type },
      { token: "type.identifier", foreground: p.type },
      { token: "annotation", foreground: p.type },
      { token: "string", foreground: p.string },
      { token: "string.escape", foreground: p.regexp },
      { token: "number", foreground: p.number },
      { token: "number.float", foreground: p.number },
      { token: "number.hex", foreground: p.number },
      { token: "constant", foreground: p.number },
      { token: "regexp", foreground: p.regexp },
      { token: "delimiter", foreground: p.delimiter },
      { token: "delimiter.bracket", foreground: p.delimiter },
      { token: "operator", foreground: p.operator },
      { token: "tag", foreground: p.keyword },
      { token: "attribute.name", foreground: p.type },
      { token: "attribute.value", foreground: p.string },
    ],
    colors: {
      "editor.background": BACKGROUND,
      "editor.foreground": `#${p.foreground}`,
      "editorGutter.background": BACKGROUND,
      "editorLineNumber.foreground": "#3a3a3a",
      "editorLineNumber.activeForeground": `#${p.activeLineNumber}`,
      "editor.lineHighlightBackground": "#151515",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": `#${p.selection}`,
      "editor.inactiveSelectionBackground": "#ffffff14",
      "editor.selectionHighlightBackground": "#ffffff12",
      "editor.wordHighlightBackground": "#ffffff10",
      "editor.findMatchBackground": "#ffffff33",
      "editor.findMatchHighlightBackground": "#ffffff1a",
      "editorCursor.foreground": `#${p.cursor}`,
      "editorWhitespace.foreground": "#2a2a2a",
      "editorIndentGuide.background": "#1c1c1c",
      "editorIndentGuide.activeBackground": "#3a3a3a",
      "editorIndentGuide.background1": "#1c1c1c",
      "editorIndentGuide.activeBackground1": "#3a3a3a",
      "editorBracketMatch.background": "#ffffff14",
      "editorBracketMatch.border": "#ffffff40",
      "editorWidget.background": "#111111",
      "editorWidget.border": "#262626",
      "editorSuggestWidget.background": "#111111",
      "editorSuggestWidget.border": "#262626",
      "editorSuggestWidget.foreground": `#${p.foreground}`,
      "editorSuggestWidget.highlightForeground": `#${p.keyword}`,
      "editorSuggestWidget.selectedBackground": "#1f1f1f",
      "editorHoverWidget.background": "#111111",
      "editorHoverWidget.border": "#262626",
      "editorOverviewRuler.border": "#00000000",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#ffffff14",
      "scrollbarSlider.hoverBackground": "#ffffff24",
      "scrollbarSlider.activeBackground": "#ffffff33",
      "minimap.background": BACKGROUND,
      focusBorder: "#00000000",
    },
  };
}

// Registers every theme with Monaco. Called once, before the editor mounts.
export function defineEditorThemes(monaco: Monaco) {
  for (const theme of EDITOR_THEMES) {
    monaco.editor.defineTheme(theme.id, buildTheme(theme.palette));
  }
}